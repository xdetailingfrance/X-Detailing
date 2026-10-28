"use client";

// Un numéro, un bouton, et le verdict en clair : « ENVOYE », « SIMULE »
// (aucun fournisseur branché) ou « ECHEC » avec la raison rendue par le
// fournisseur. C'est ce dernier cas qui compte : un SMS qu'on croit parti
// et qui ne l'est pas coûte un rendez-vous.
import { useState } from "react";
import { useRouter } from "next/navigation";

type Resultat = { statut: string; erreur: string | null; fournisseur: string | null; numero: string };

export default function TestSmsForm() {
  const router = useRouter();
  const [telephone, setTelephone] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer() {
    setEnCours(true);
    setErreur(null);
    setResultat(null);
    const res = await fetch("/api/sms/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telephone }),
    });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) {
      setErreur(data.error ?? "L'envoi a échoué.");
      return;
    }
    setResultat(data);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
      <div>
        <h2 className="font-medium">Tester l&apos;envoi</h2>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          Un SMS de contrôle vers le numéro de votre choix, pour vérifier la configuration sans
          créer de réservation.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          placeholder="06 49 36 83 28"
          inputMode="tel"
          className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
        />
        <button
          onClick={envoyer}
          disabled={enCours || telephone.trim().length < 9}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50"
        >
          {enCours ? "Envoi…" : "Envoyer un SMS de test"}
        </button>
      </div>
      {erreur && <p className="text-sm text-[var(--warning)]">{erreur}</p>}
      {resultat && (
        <p
          className={`text-sm ${
            resultat.statut === "ENVOYE" ? "text-[var(--success)]" : "text-[var(--warning)]"
          }`}
        >
          {resultat.statut === "ENVOYE" &&
            `Envoyé à ${resultat.numero} via ${resultat.fournisseur === "brevo" ? "Brevo" : "Twilio"}. Vérifiez la réception sur le téléphone.`}
          {resultat.statut === "SIMULE" &&
            "Aucun fournisseur n'est configuré : le message a été consigné sans être envoyé. Pour Brevo, il faut BREVO_API_KEY et BREVO_SMS_SENDER."}
          {resultat.statut === "ECHEC" && `Échec : ${resultat.erreur ?? "raison non précisée"}.`}
        </p>
      )}
    </div>
  );
}
