"use client";

// Renvoyer la facture par e-mail, et l'imprimer. L'envoi automatique à la
// clôture peut avoir échoué — adresse absente, expéditeur refusé — et sans
// ce bouton la facture ne repartirait jamais.
import { useState } from "react";

export default function RenvoyerFacture({
  rendezVousId,
  email,
  numero,
}: {
  rendezVousId: string;
  email: string | null;
  numero: string;
}) {
  const [enCours, setEnCours] = useState(false);
  const [envoi, setEnvoi] = useState<{ envoye: boolean; erreur?: string } | null>(null);

  async function renvoyer() {
    setEnCours(true);
    setEnvoi(null);
    const res = await fetch(`/api/facturation/${rendezVousId}/email`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    setEnvoi(res.ok ? data : { envoye: false, erreur: data.error ?? "Envoi impossible." });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          onClick={() => window.print()}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm transition hover:bg-[var(--surface-2)]"
        >
          Imprimer / PDF
        </button>
        <button
          onClick={renvoyer}
          disabled={enCours || !email}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium transition hover:bg-[var(--accent-2)] disabled:opacity-50"
          title={email ? `Envoyer à ${email}` : "Ce client n'a pas d'adresse e-mail"}
        >
          {enCours ? "Envoi…" : "Envoyer par e-mail"}
        </button>
      </div>
      {!email && (
        <p className="text-xs text-[var(--muted)]">
          Ce client n&apos;a pas d&apos;adresse e-mail : seule l&apos;impression est possible.
        </p>
      )}
      {envoi && (
        <p className={`text-xs ${envoi.envoye ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>
          {envoi.envoye
            ? `Facture ${numero} envoyée à ${email}.`
            : `Non envoyée : ${envoi.erreur ?? "raison non précisée"}.`}
        </p>
      )}
    </div>
  );
}
