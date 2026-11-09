"use client";

// Envoi de contrôle de la facture. Sans lui, vérifier que la chaîne
// fonctionne — Brevo, pièce jointe, lien d'avis — obligerait à clôturer une
// vraie prestation.
import { useState } from "react";

export default function TestEnvoiFacture() {
  const [email, setEmail] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [envoi, setEnvoi] = useState<{ envoye: boolean; erreur?: string } | null>(null);

  async function envoyer() {
    setEnCours(true);
    setEnvoi(null);
    const res = await fetch("/api/facturation/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    setEnvoi(res.ok ? data : { envoye: false, erreur: data.error ?? "Envoi impossible." });
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
      <div>
        <h2 className="font-medium">Tester l&apos;envoi d&apos;une facture</h2>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          Envoie à l&apos;adresse de votre choix la facture type, PDF joint et lien d&apos;avis compris, sur un
          dossier fictif. Aucune donnée d&apos;un vrai client n&apos;est transmise.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          inputMode="email"
          placeholder="adresse@exemple.fr"
          className="min-w-[16rem] flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
        />
        <button
          onClick={envoyer}
          disabled={enCours || !email.includes("@")}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--accent-2)] disabled:opacity-50"
        >
          {enCours ? "Envoi…" : "Envoyer le test"}
        </button>
      </div>
      {envoi && (
        <p className={`text-sm ${envoi.envoye ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>
          {envoi.envoye
            ? `Envoyé à ${email.trim()}. Vérifiez la boîte de réception, et les indésirables au besoin.`
            : `Non envoyé : ${envoi.erreur ?? "raison non précisée"}.`}
        </p>
      )}
    </div>
  );
}
