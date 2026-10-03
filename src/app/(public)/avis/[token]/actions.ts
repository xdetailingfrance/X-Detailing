"use server";

import { z } from "zod";
import { submitReview } from "@/server/quality";

/** §25 — dépôt d'avis, sans compte : le jeton de réservation fait foi. */

const schema = z.object({
  token: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export type ReviewActionResult =
  | { ok: true; routedToGoogle: boolean }
  | { ok: false; error: string };

export async function postReview(
  input: z.input<typeof schema>,
): Promise<ReviewActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Avis invalide." };

  return submitReview({
    publicToken: parsed.data.token,
    rating: parsed.data.rating,
    comment: parsed.data.comment,
  });
}
