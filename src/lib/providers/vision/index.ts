import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

/**
 * Analyse des photos envoyées par le client (§19, §32).
 *
 * « La partie IA doit devenir un moment "wow". Pas un gadget. »
 *
 * Deux garde-fous de conception, qui viennent directement du §19 :
 *
 *   1. Le modèle **observe**, il ne facture pas. Il rend des constats et des
 *      suggestions ; l'ajout au devis reste un geste du client.
 *   2. Il ne peut proposer que des options qui existent réellement au catalogue —
 *      la liste lui est fournie, et tout code inconnu est écarté à la lecture.
 *
 * Comme le reste du système, le fournisseur est derrière une interface : sans clé
 * d'API, l'application fonctionne, l'étape photo reste disponible, et aucune
 * suggestion n'est affichée.
 */

export const ZONES = [
  "EXTERIEUR",
  "JANTES",
  "VITRES",
  "SIEGES",
  "TAPIS",
  "PLASTIQUES",
  "COFFRE",
] as const;

export const ZONE_LABEL: Record<(typeof ZONES)[number], string> = {
  EXTERIEUR: "Carrosserie",
  JANTES: "Jantes",
  VITRES: "Vitres",
  SIEGES: "Sièges",
  TAPIS: "Tapis et moquette",
  PLASTIQUES: "Plastiques",
  COFFRE: "Coffre",
};

export const SEVERITIES = ["LEGER", "MODERE", "IMPORTANT"] as const;
export const CLEANLINESS = ["PROPRE", "NORMAL", "SALE", "TRES_SALE"] as const;

export const CLEANLINESS_LABEL: Record<(typeof CLEANLINESS)[number], string> = {
  PROPRE: "Véhicule déjà propre",
  NORMAL: "Salissures habituelles",
  SALE: "Salissures marquées",
  TRES_SALE: "Salissures importantes",
};

const AnalysisSchema = z.object({
  cleanliness: z.enum(CLEANLINESS),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
  findings: z.array(
    z.object({
      zone: z.enum(ZONES),
      observation: z.string(),
      severity: z.enum(SEVERITIES),
    }),
  ),
  suggestions: z.array(
    z.object({
      optionCode: z.string(),
      reason: z.string(),
    }),
  ),
});

export type VisionAnalysis = z.infer<typeof AnalysisSchema>;

export type VisionImage = { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };

export type AnalysisRequest = {
  images: VisionImage[];
  /** Options réellement disponibles : le modèle ne peut proposer que celles-ci. */
  availableOptions: Array<{ code: string; name: string; description?: string | null }>;
  serviceName: string;
  vehicleLabel: string;
};

export type AnalysisResult = {
  analysis: VisionAnalysis;
  provider: string;
  model: string | null;
  durationMs: number;
};

export interface VisionProvider {
  readonly name: string;
  readonly available: boolean;
  analyze(request: AnalysisRequest): Promise<AnalysisResult | null>;
}

const SYSTEM = `Tu assistes un service de lavage automobile mobile en analysant les photos
qu'un client envoie avant sa prestation.

Ton rôle est d'OBSERVER, pas de vendre. Tu décris ce que montrent les photos, et tu
signales les options du catalogue qui répondraient à un constat précis.

Règles :
- Ne propose que des options de la liste fournie, par leur code exact.
- Une option ne se propose que si une observation la justifie. Pas de suggestion
  « au cas où » : le client verra tes raisons et doit les reconnaître sur ses photos.
- Si le véhicule est déjà propre, dis-le et ne propose rien.
- Une observation nomme ce que l'on voit, à l'endroit où on le voit. « Sable au niveau
  des tapis avant » et non « intérieur sale ».
- Si les photos sont floues, mal cadrées ou trop sombres pour juger, baisse la confiance
  en conséquence plutôt que d'inventer.
- Reste factuel et neutre. Le client lit ces constats : ils ne doivent jamais sonner
  comme un reproche sur l'état de sa voiture.`;

class ClaudeVisionProvider implements VisionProvider {
  readonly name = "claude";
  readonly available = true;

  constructor(private readonly client: Anthropic) {}

  async analyze(request: AnalysisRequest): Promise<AnalysisResult | null> {
    const startedAt = Date.now();

    const catalogue = request.availableOptions
      .map((o) => `- ${o.code} — ${o.name}${o.description ? ` : ${o.description}` : ""}`)
      .join("\n");

    const response = await this.client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { format: zodOutputFormat(AnalysisSchema) },
      messages: [
        {
          role: "user",
          content: [
            ...request.images.map((image) => ({
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: image.mediaType,
                data: image.base64,
              },
            })),
            {
              type: "text" as const,
              text:
                `Véhicule : ${request.vehicleLabel}\n` +
                `Prestation retenue : ${request.serviceName}\n\n` +
                `Options disponibles :\n${catalogue}\n\n` +
                `Analyse ces photos et rends tes constats.`,
            },
          ],
        },
      ],
    });

    if (!response.parsed_output) return null;

    return {
      analysis: response.parsed_output,
      provider: this.name,
      model: response.model,
      durationMs: Date.now() - startedAt,
    };
  }
}

/** Sans clé d'API : l'étape photo reste utilisable, aucune suggestion n'est produite. */
class NoVisionProvider implements VisionProvider {
  readonly name = "none";
  readonly available = false;
  async analyze(): Promise<AnalysisResult | null> {
    return null;
  }
}

let cached: VisionProvider | null = null;

export function visionProvider(): VisionProvider {
  if (cached) return cached;

  const configured = (process.env.VISION_PROVIDER ?? "claude") !== "none";
  const key = process.env.ANTHROPIC_API_KEY?.trim();

  cached = configured && key ? new ClaudeVisionProvider(new Anthropic({ apiKey: key })) : new NoVisionProvider();
  return cached;
}
