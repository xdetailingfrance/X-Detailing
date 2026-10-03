import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/server/db";
import { getJobInvoice } from "@/server/job-invoice";
import { BUSINESS, isPlaceholder } from "@/lib/business";
import { formatEuros } from "@/server/pricing";
import { formatLocalDate } from "@/server/time";

/**
 * Facture d'une prestation, côté client (§24).
 *
 * Accessible par le jeton public de la réservation : le client n'a pas de compte, et
 * un jeton aléatoire vaut mieux qu'un identifiant énumérable.
 *
 * Mise en page pensée pour l'impression autant que pour l'écran — c'est un document
 * qu'on transmet à un comptable ou à un employeur.
 */

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

/** Mentions légales obligatoires qui manquent encore à l'identité de l'entreprise. */
function missingMentions(): string[] {
  const missing: string[] = [];
  if (isPlaceholder(BUSINESS.legalName)) missing.push("raison sociale");
  if (isPlaceholder(BUSINESS.address.street)) missing.push("adresse du siège");
  if (isPlaceholder(BUSINESS.phone)) missing.push("téléphone");
  missing.push("SIRET", "numéro de TVA intracommunautaire");
  return missing;
}

export default async function InvoicePage({ params }: PageProps<"/reservation/[token]/facture">) {
  const { token } = await params;

  const appointment = await prisma.appointment.findUnique({
    where: { publicToken: token },
    select: { id: true },
  });
  if (!appointment) notFound();

  const invoice = await getJobInvoice(appointment.id);
  if (!invoice) notFound();

  const client = invoice.customer;
  const clientName =
    client.companyName ?? `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim();

  const paid = invoice.appointment.payments.filter((p) => p.status === "PAID");
  const missing = missingMentions();

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-28">
      {/*
        Avertissement à l'écran, absent à l'impression : tant que les mentions
        obligatoires manquent, ce document n'a pas de valeur fiscale. Le dire ici vaut
        mieux que de laisser croire le contraire à celui qui le transmet.
      */}
      {missing.length > 0 && (
        <p className="mb-8 rounded-[--radius-xd-md] bg-xd-warn/12 px-4 py-3 text-meta leading-relaxed text-xd-warn print:hidden">
          Document incomplet : il manque {missing.join(", ")}. Renseignez-les dans
          l&apos;identité de l&apos;entreprise avant toute remise à un client.
        </p>
      )}

      <article className="rounded-[--radius-xd-xl] p-8 m-polished print:bg-white print:p-0 print:text-black">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-h2 font-semibold tracking-[-0.02em] text-xd-text print:text-black">
              {BUSINESS.name}
            </p>
            <p className="mt-2 text-meta leading-relaxed text-xd-text-3 print:text-black">
              {BUSINESS.legalName}
              <br />
              {BUSINESS.address.street}
              <br />
              {BUSINESS.address.postalCode} {BUSINESS.address.city}
              <br />
              SIRET [À RENSEIGNER] · TVA [À RENSEIGNER]
            </p>
          </div>

          <div className="text-right">
            <p className="eyebrow text-xd-text-4 print:text-black">Facture</p>
            <p className="tabular mt-1 text-h3 font-semibold text-xd-text print:text-black">
              {invoice.number}
            </p>
            <p className="mt-2 text-meta text-xd-text-3 print:text-black">
              Émise le {formatLocalDate(invoice.issuedAt)}
            </p>
          </div>
        </header>

        <section className="hairline-t mt-8 pt-6">
          <p className="eyebrow text-xd-text-4 print:text-black">Client</p>
          <p className="mt-1.5 text-body font-medium text-xd-text print:text-black">
            {clientName}
          </p>
          <p className="mt-0.5 text-meta text-xd-text-3 print:text-black">
            {invoice.appointment.addressLine1}, {invoice.appointment.postalCode}{" "}
            {invoice.appointment.city}
            {client.siret && <> · SIRET {client.siret}</>}
          </p>
          <p className="mt-3 text-meta text-xd-text-3 print:text-black">
            Prestation {invoice.appointment.reference}, réalisée le{" "}
            {formatLocalDate(invoice.appointment.finishedAt ?? invoice.appointment.scheduledStart)}.
          </p>
        </section>

        {/* ── Le détail ───────────────────────────────────────────────────── */}
        <table className="mt-8 w-full border-separate border-spacing-0 text-body">
          <thead>
            <tr>
              <th className="eyebrow hairline-b py-2 text-left font-medium text-xd-text-4 print:text-black">
                Désignation
              </th>
              <th className="eyebrow hairline-b py-2 text-right font-medium text-xd-text-4 print:text-black">
                Montant TTC
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, index) => (
              <tr key={`${line.label}-${index}`}>
                <td className="hairline-b py-3 text-xd-text-2 print:text-black">{line.label}</td>
                <td className="tabular hairline-b py-3 text-right text-xd-text print:text-black">
                  {formatEuros(line.amountCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-6 ml-auto max-w-xs space-y-2 text-body">
          <div className="flex justify-between gap-6">
            <dt className="text-xd-text-3 print:text-black">Total HT</dt>
            <dd className="tabular text-xd-text-2 print:text-black">{invoice.formatted.subtotal}</dd>
          </div>
          <div className="flex justify-between gap-6">
            <dt className="text-xd-text-3 print:text-black">
              TVA {(Number(invoice.vatRate) * 100).toFixed(0)} %
            </dt>
            <dd className="tabular text-xd-text-2 print:text-black">{invoice.formatted.vat}</dd>
          </div>
          <div className="hairline-t flex justify-between gap-6 pt-2">
            <dt className="font-semibold text-xd-text print:text-black">Total TTC</dt>
            <dd className="tabular text-h3 font-semibold text-xd-text print:text-black">
              {invoice.formatted.total}
            </dd>
          </div>
        </dl>

        {paid.length > 0 && (
          <p className="hairline-t mt-6 pt-5 text-meta text-xd-text-3 print:text-black">
            Réglée : {paid.map((p) => `${formatEuros(p.amountCents)} (${p.method === "CASH" ? "espèces" : "carte"})`).join(" · ")}.
          </p>
        )}
      </article>

      <div className="mt-6 flex flex-wrap gap-3 print:hidden">
        <Link
          href={`/reservation/${token}`}
          className="glass glass-interactive press rounded-full px-6 py-3 text-body font-medium text-xd-text"
        >
          ← Ma réservation
        </Link>
      </div>
    </div>
  );
}
