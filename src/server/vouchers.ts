import { randomInt } from "node:crypto";
import { prisma } from "./db";

/**
 * Bons de remise (§23).
 *
 * Un code annoncé par e-mail doit être honoré par le tunnel de réservation : c'est la
 * raison d'être de ce module. La remise n'existe pas dans le texte du message, elle
 * existe en base, nominative, à usage unique et datée.
 */

/** Remise accordée par la relance d'entretien, un mois après un lavage. */
export const FOLLOW_UP_PERCENT = 10;

/** Durée de validité d'un bon de relance. */
export const FOLLOW_UP_VALID_DAYS = 45;

/**
 * Alphabet sans `0/O` ni `1/I/L` : le code se lit au téléphone et se recopie à la main.
 * Les confusions classiques coûtent un appel au standard.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

/** Émet un bon nominatif. Réessaie si le code tiré existe déjà. */
export async function issueVoucher(input: {
  customerId: string;
  percentOff: number;
  reason: string;
  validDays: number;
}): Promise<{ code: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + input.validDays * 24 * 3600_000);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `XD${randomCode()}`;
    try {
      await prisma.voucher.create({
        data: {
          code,
          customerId: input.customerId,
          percentOff: input.percentOff,
          reason: input.reason,
          expiresAt,
        },
      });
      return { code, expiresAt };
    } catch {
      // Collision sur le code : on retire. Au bout de cinq essais, le problème est ailleurs.
    }
  }

  throw new Error("Impossible d'émettre un bon : trop de collisions de code.");
}

export type VoucherCheck =
  | { ok: true; id: string; percentOff: number; discountCents: number }
  | { ok: false; error: string };

/**
 * Vérifie un code pour un total donné, sans le consommer.
 *
 * Volontairement séparé de la consommation : le client voit la remise appliquée pendant
 * qu'il remplit le reste du formulaire, et le bon n'est brûlé qu'à la confirmation.
 */
export async function checkVoucher(
  code: string,
  totalCents: number,
  customerEmail?: string | null,
): Promise<VoucherCheck> {
  const voucher = await prisma.voucher.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { customer: { select: { email: true } } },
  });

  if (!voucher) return { ok: false, error: "Ce code n'existe pas." };
  if (voucher.usedAt) return { ok: false, error: "Ce code a déjà été utilisé." };
  if (voucher.expiresAt < new Date()) return { ok: false, error: "Ce code a expiré." };

  // Le bon est nominatif : il suit le client à qui il a été envoyé. On ne bloque que
  // si l'adresse est connue et différente — un client qui réserve sans se connecter
  // n'a pas à être rejeté pour autant.
  if (
    customerEmail &&
    voucher.customer.email &&
    voucher.customer.email.toLowerCase() !== customerEmail.trim().toLowerCase()
  ) {
    return { ok: false, error: "Ce code appartient à un autre compte." };
  }

  return {
    ok: true,
    id: voucher.id,
    percentOff: voucher.percentOff,
    discountCents: Math.round((totalCents * voucher.percentOff) / 100),
  };
}

/**
 * Consomme le bon au profit d'un rendez-vous.
 *
 * L'écriture est conditionnée à `usedAt: null` : deux réservations simultanées avec le
 * même code ne peuvent pas le dépenser deux fois.
 */
export async function redeemVoucher(voucherId: string, appointmentId: string): Promise<boolean> {
  const { count } = await prisma.voucher.updateMany({
    where: { id: voucherId, usedAt: null },
    data: { usedAt: new Date(), appointmentId },
  });
  return count === 1;
}
