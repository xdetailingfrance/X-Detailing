import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { recordAudit } from "@/server/audit";

/**
 * Réception des leads publicitaires (§19).
 *
 * Meta n'est pas connecté à ce stade. L'endpoint accepte donc deux formes :
 * la charge utile Meta Lead Ads, et une charge normalisée qui permet de tester le flux
 * complet — et de brancher une autre régie sans réécrire le CRM.
 *
 * SÉCURITÉ : jamais ouvert. Signature HMAC de Meta si `META_APP_SECRET` est défini,
 * sinon jeton partagé `LEAD_WEBHOOK_SECRET`. Sans configuration, l'endpoint refuse tout.
 */

export const runtime = "nodejs";

const normalizedSchema = z.object({
  source: z.enum(["META", "GOOGLE", "PHONE", "REFERRAL", "WEBSITE", "OTHER"]).default("META"),
  externalId: z.string().min(1),
  fullName: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional(),
  city: z.string().max(80).optional(),
  campaign: z.string().max(160).optional(),
  adset: z.string().max(160).optional(),
  ad: z.string().max(160).optional(),
  costCents: z.number().int().min(0).optional(),
});

/** Forme Meta Lead Ads : les champs du formulaire arrivent en paires nom/valeur. */
const metaSchema = z.object({
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          field: z.string(),
          value: z.object({
            leadgen_id: z.string(),
            campaign_name: z.string().optional(),
            adset_name: z.string().optional(),
            ad_name: z.string().optional(),
            field_data: z
              .array(z.object({ name: z.string(), values: z.array(z.string()) }))
              .optional(),
          }),
        }),
      ),
    }),
  ),
});

function verify(raw: string, signature: string | null, bearer: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (appSecret) {
    if (!signature?.startsWith("sha256=")) return false;
    const expected = createHmac("sha256", appSecret).update(raw).digest();
    const received = Buffer.from(signature.slice(7), "hex");
    return expected.length === received.length && timingSafeEqual(expected, received);
  }

  const shared = process.env.LEAD_WEBHOOK_SECRET;
  if (!shared) return false;
  const a = Buffer.from(bearer ?? "");
  const b = Buffer.from(`Bearer ${shared}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Vérification d'abonnement Meta. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = process.env.META_VERIFY_TOKEN;

  if (token && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === token) {
    return new NextResponse(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const raw = await request.text();

  if (!verify(raw, request.headers.get("x-hub-signature-256"), request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const incoming: Array<z.infer<typeof normalizedSchema>> = [];

  const meta = metaSchema.safeParse(body);
  if (meta.success) {
    for (const entry of meta.data.entry) {
      for (const change of entry.changes) {
        if (change.field !== "leadgen") continue;
        const fields = new Map(
          (change.value.field_data ?? []).map((f) => [f.name, f.values[0] ?? ""]),
        );
        incoming.push({
          source: "META",
          externalId: change.value.leadgen_id,
          fullName: fields.get("full_name") ?? fields.get("nom") ?? undefined,
          phone: fields.get("phone_number") ?? fields.get("telephone") ?? undefined,
          email: fields.get("email") ?? undefined,
          city: fields.get("city") ?? fields.get("ville") ?? undefined,
          campaign: change.value.campaign_name,
          adset: change.value.adset_name,
          ad: change.value.ad_name,
        });
      }
    }
  } else {
    const normalized = normalizedSchema.safeParse(body);
    if (!normalized.success) {
      return NextResponse.json({ error: "Charge utile non reconnue" }, { status: 422 });
    }
    incoming.push(normalized.data);
  }

  let created = 0;

  for (const lead of incoming) {
    // `@@unique([source, externalId])` : Meta peut renvoyer le même lead plusieurs fois.
    const existing = await prisma.lead.findUnique({
      where: { source_externalId: { source: lead.source, externalId: lead.externalId } },
    });
    if (existing) continue;

    const record = await prisma.lead.create({
      data: {
        source: lead.source,
        externalId: lead.externalId,
        fullName: lead.fullName ?? null,
        phone: lead.phone ?? null,
        email: lead.email ?? null,
        city: lead.city ?? null,
        campaign: lead.campaign ?? null,
        adset: lead.adset ?? null,
        ad: lead.ad ?? null,
        costCents: lead.costCents ?? null,
        rawPayload: body as never,
        status: "NEW",
      },
      select: { id: true },
    });

    await recordAudit({
      actorUserId: null,
      actorLabel: `Webhook ${lead.source}`,
      action: "LEAD_RECU",
      entityType: "Lead",
      entityId: record.id,
      after: { externalId: lead.externalId, campaign: lead.campaign ?? null },
    });

    created += 1;
  }

  return NextResponse.json({ received: incoming.length, created });
}
