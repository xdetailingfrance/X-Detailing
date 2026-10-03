import { prisma } from "./db";
import { storageProvider } from "@/lib/providers/storage";
import {
  visionProvider,
  CLEANLINESS_LABEL,
  ZONE_LABEL,
  type VisionImage,
} from "@/lib/providers/vision";

/**
 * Analyse photo du devis (§19).
 *
 * « Le système ne doit jamais sembler imposer une facturation automatique. Visuellement
 * distinguer *Détecté par X Detailing* et *Option proposée*. »
 *
 * D'où la forme du résultat : deux listes séparées. Les **constats** sont des faits
 * observés sur les photos ; les **suggestions** sont des options du catalogue avec leur
 * justification. Rien n'est ajouté au devis ici — c'est un geste du client.
 */

const MAX_IMAGES = 6;
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);

/** En dessous, on n'affiche rien : une suggestion peu fiable vaut moins que le silence. */
const MIN_CONFIDENCE = 0.45;

export type Finding = {
  zone: string;
  zoneLabel: string;
  observation: string;
  severity: string;
};

export type Suggestion = {
  optionId: string;
  code: string;
  name: string;
  priceCents: number;
  durationMin: number;
  reason: string;
};

export type AnalysisOutcome =
  | { ok: false; reason: "UNAVAILABLE" | "TOO_UNSURE" | "NO_IMAGES" | "ERROR"; message: string }
  | {
      ok: true;
      analysisId: string;
      cleanliness: string;
      cleanlinessLabel: string;
      summary: string;
      confidence: number;
      findings: Finding[];
      suggestions: Suggestion[];
      durationMs: number;
    };

export type AnalyzeInput = {
  images: Array<{ buffer: Buffer; mediaType: string }>;
  serviceId: string;
  vehicleLabel: string;
  /** Rattachement au parcours avant qu'un rendez-vous existe. */
  quoteToken?: string | null;
  appointmentId?: string | null;
};

export async function analyzePhotos(input: AnalyzeInput): Promise<AnalysisOutcome> {
  if (input.images.length === 0) {
    return { ok: false, reason: "NO_IMAGES", message: "Aucune photo reçue." };
  }

  const provider = visionProvider();
  if (!provider.available) {
    return {
      ok: false,
      reason: "UNAVAILABLE",
      message: "L'analyse n'est pas disponible pour le moment.",
    };
  }

  const images = input.images.slice(0, MAX_IMAGES).filter(
    (image) => ACCEPTED.has(image.mediaType) && image.buffer.byteLength <= MAX_BYTES,
  );
  if (images.length === 0) {
    return { ok: false, reason: "NO_IMAGES", message: "Format d'image non accepté." };
  }

  const service = await prisma.service.findUnique({
    where: { id: input.serviceId },
    select: {
      name: true,
      options: {
        select: {
          option: {
            select: { id: true, code: true, name: true, description: true, priceCents: true, durationMin: true, active: true },
          },
        },
      },
    },
  });

  if (!service) return { ok: false, reason: "ERROR", message: "Prestation inconnue." };

  const catalogue = service.options.map((link) => link.option).filter((o) => o.active);

  let result;
  try {
    result = await provider.analyze({
      images: images.map(
        (image): VisionImage => ({
          base64: image.buffer.toString("base64"),
          mediaType: image.mediaType as VisionImage["mediaType"],
        }),
      ),
      availableOptions: catalogue.map((o) => ({
        code: o.code,
        name: o.name,
        description: o.description,
      })),
      serviceName: service.name,
      vehicleLabel: input.vehicleLabel,
    });
  } catch {
    // Une analyse indisponible ne doit jamais bloquer une réservation.
    return {
      ok: false,
      reason: "ERROR",
      message: "L'analyse n'a pas abouti. Vous pouvez poursuivre sans elle.",
    };
  }

  if (!result) {
    return { ok: false, reason: "ERROR", message: "L'analyse n'a rien renvoyé." };
  }

  const { analysis } = result;

  if (analysis.confidence < MIN_CONFIDENCE) {
    return {
      ok: false,
      reason: "TOO_UNSURE",
      message:
        "Les photos ne permettent pas de se prononcer. Reprenez-les à la lumière du jour, " +
        "ou poursuivez : votre opérateur constatera sur place.",
    };
  }

  // Un code inconnu est écarté : le modèle ne peut pas inventer une option facturable.
  const byCode = new Map(catalogue.map((o) => [o.code, o]));
  const suggestions: Suggestion[] = [];
  for (const suggestion of analysis.suggestions) {
    const option = byCode.get(suggestion.optionCode);
    if (!option) continue;
    if (suggestions.some((s) => s.optionId === option.id)) continue;

    suggestions.push({
      optionId: option.id,
      code: option.code,
      name: option.name,
      priceCents: option.priceCents,
      durationMin: option.durationMin,
      reason: suggestion.reason,
    });
  }

  const findings: Finding[] = analysis.findings.map((finding) => ({
    zone: finding.zone,
    zoneLabel: ZONE_LABEL[finding.zone] ?? finding.zone,
    observation: finding.observation,
    severity: finding.severity,
  }));

  const storage = storageProvider();
  const stored = await Promise.all(
    images.map((image) =>
      storage.put(image.buffer, {
        extension: image.mediaType === "image/png" ? "png" : image.mediaType === "image/webp" ? "webp" : "jpg",
        prefix: `analyses/${input.quoteToken ?? input.appointmentId ?? "anonyme"}`,
      }),
    ),
  );

  const record = await prisma.photoAnalysis.create({
    data: {
      appointmentId: input.appointmentId ?? null,
      quoteToken: input.quoteToken ?? null,
      findings: findings as never,
      suggestions: suggestions as never,
      provider: result.provider,
      model: result.model,
      durationMs: result.durationMs,
      confidence: analysis.confidence,
      images: {
        create: stored.map((file) => ({ path: file.key, bytes: file.bytes })),
      },
    },
    select: { id: true },
  });

  return {
    ok: true,
    analysisId: record.id,
    cleanliness: analysis.cleanliness,
    cleanlinessLabel: CLEANLINESS_LABEL[analysis.cleanliness] ?? analysis.cleanliness,
    summary: analysis.summary,
    confidence: analysis.confidence,
    findings,
    suggestions,
    durationMs: result.durationMs,
  };
}

/** Rattache une analyse faite pendant le parcours au rendez-vous finalement créé. */
export async function linkAnalysisToAppointment(quoteToken: string, appointmentId: string) {
  await prisma.photoAnalysis.updateMany({
    where: { quoteToken, appointmentId: null },
    data: { appointmentId },
  });
}
