"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guard";
import { issueInvoice, markInvoicePaid } from "@/server/invoicing";

/** §24 — émission et règlement des factures de flotte. Réservé au patron. */

export type InvoiceActionResult = { ok: true; number?: string } | { ok: false; error: string };

const issueSchema = z.object({
  customerId: z.string().min(1),
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export async function createInvoice(
  input: z.input<typeof issueSchema>,
): Promise<InvoiceActionResult> {
  const admin = await requireAdmin();

  const parsed = issueSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Période invalide." };

  const result = await issueInvoice({
    ...parsed.data,
    actor: { userId: admin.userId, label: admin.name },
  });

  if (!result.ok) return result;

  revalidatePath(`/admin/entreprises/${parsed.data.customerId}`);
  revalidatePath("/admin/entreprises");
  return { ok: true, number: result.number };
}

const paySchema = z.object({ invoiceId: z.string().min(1), customerId: z.string().min(1) });

export async function settleInvoice(
  input: z.input<typeof paySchema>,
): Promise<InvoiceActionResult> {
  const admin = await requireAdmin();

  const parsed = paySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Facture invalide." };

  const result = await markInvoicePaid({
    invoiceId: parsed.data.invoiceId,
    actor: { userId: admin.userId, label: admin.name },
  });

  if (!result.ok) return { ok: false, error: result.error ?? "Échec" };

  revalidatePath(`/admin/entreprises/${parsed.data.customerId}`);
  revalidatePath("/admin/entreprises");
  return { ok: true };
}
