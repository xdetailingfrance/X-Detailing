"use client";

// Décaler, annuler ou supprimer un rendez-vous. Le client est prévenu par
// défaut (e-mail + SMS) : c'est le sens même de l'opération. La case se
// décoche quand on vient de l'avoir au téléphone.
import { useState } from "react";
import { useRouter } from "next/navigation";

type Envoi = { email?: { envoye: boolean; erreur?: string }; sms?: { statut: string; erreur?: string | null } | null };

export default function GestionPanel({
  rendezVousId,
  packId,
  jourActuel,
  heureActuelle,
  statut,
  suppressionPossible,
  peutSupprimer,
}: {
  rendezVousId: string;
  packId: string;
  jourActuel: string;
  heureActuelle: string;
  statut: string;
  // Faux dès qu'une facture ou un encaissement est attaché : la pièce
  // comptable se conserve, le RDV ne peut alors qu'être annulé.
  suppressionPossible: boolean;
  peutSupprimer: boolean;
}) {
  const router = useRouter();
  const [jour, setJour] = useState(jourActuel);
  const [heure, setHeure] = useState(heureActuelle);
  const [notifier, setNotifier] = useState(true);
  const [motif, setMotif] = useState("");
  const [creneaux, setCreneaux] = useState<string[] | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [forcable, setForcable] = useState(false);
  const [armeSuppression, setArmeSuppression] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const annule = statut === "ANNULE";

  function resume(envois?: Record<string, Envoi | undefined>) {
    const envoi = envois && (envois.decalage ?? envois.annulation ?? (envois as unknown as Envoi));
    if (!envoi || !notifier) return null;
    const parts: string[] = [];
    if (envoi.email) parts.push(envoi.email.envoye ? "e-mail envoyé" : `e-mail non envoyé (${envoi.email.erreur ?? "erreur"})`);
    if (envoi.sms) parts.push(envoi.sms.statut === "ENVOYE" ? "SMS envoyé" : `SMS non envoyé (${envoi.sms.erreur ?? envoi.sms.statut})`);
    return parts.length > 0 ? `Client prévenu : ${parts.join(", ")}.` : null;
  }

  async function chargerCreneaux(nouveauJour: string) {
    setJour(nouveauJour);
    setCreneaux(null);
    const res = await fetch(`/api/reservation/creneaux?packId=${encodeURIComponent(packId)}&jour=${encodeURIComponent(nouveauJour)}`);
    if (!res.ok) return;
    const data = await res.json();
    setCreneaux(Array.isArray(data.creneaux) ? data.creneaux : []);
  }

  async function appeler(action: string, init: RequestInit, chemin = `/api/rendez-vous/${rendezVousId}`) {
    setEnCours(action);
    setErreur(null);
    setMessage(null);
    const res = await fetch(chemin, init);
    const data = await res.json().catch(() => ({}));
    setEnCours(null);
    if (!res.ok) {
      setErreur(data.error ?? "L'opération a échoué.");
      setForcable(data.forcable === true);
      return null;
    }
    setForcable(false);
    return data;
  }

  async function decaler(forcer = false) {
    const data = await appeler("decaler", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jour, heure, notifier, forcer }),
    });
    if (!data) return;
    setMessage(resume(data.envois) ?? "Rendez-vous décalé.");
    router.refresh();
  }

  async function annuler() {
    const data = await appeler("annuler", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: "ANNULE", motif: motif.trim() || undefined, notifier }),
    });
    if (!data) return;
    setMessage(resume(data.envois) ?? "Rendez-vous annulé.");
    router.refresh();
  }

  async function supprimer() {
    const data = await appeler("supprimer", { method: "DELETE" }, `/api/rendez-vous/${rendezVousId}?notifier=${notifier}`);
    setArmeSuppression(false);
    if (!data) return;
    router.push("/back-office/planning");
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-5">
      <h2 className="font-medium">Modifier le rendez-vous</h2>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={notifier} onChange={(e) => setNotifier(e.target.checked)} className="mt-0.5" />
        <span>
          Prévenir le client par e-mail et SMS
          <span className="block text-xs text-[var(--muted)]">À décocher seulement si vous venez de le joindre.</span>
        </span>
      </label>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-[var(--muted)] uppercase tracking-wide">Décaler</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-[var(--muted)]">Jour</span>
            <input
              type="date"
              value={jour}
              onChange={(e) => chargerCreneaux(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-[var(--muted)]">Heure</span>
            <input
              type="time"
              value={heure}
              onChange={(e) => setHeure(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2"
            />
          </label>
          <button
            onClick={() => decaler()}
            disabled={enCours !== null || (jour === jourActuel && heure === heureActuelle)}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50"
          >
            {enCours === "decaler" ? "Décalage…" : "Décaler"}
          </button>
        </div>
        {creneaux != null && (
          <p className="text-xs text-[var(--muted)]">
            {creneaux.length > 0 ? (
              <>
                Créneaux encore libres ce jour-là :{" "}
                {creneaux.map((c) => (
                  <button key={c} onClick={() => setHeure(c)} className="underline mr-2 hover:text-[var(--fg)]">
                    {c}
                  </button>
                ))}
              </>
            ) : (
              "Aucun créneau libre ce jour-là — vous pouvez tout de même imposer une heure."
            )}
          </p>
        )}
      </div>

      {!annule && (
        <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4">
          <p className="text-xs text-[var(--muted)] uppercase tracking-wide">Annuler</p>
          <input
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Motif communiqué au client (facultatif)"
            className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
          />
          <button
            onClick={annuler}
            disabled={enCours !== null}
            className="self-start rounded-md border border-[var(--warning)] px-4 py-2 text-sm font-medium text-[var(--warning)] transition hover:bg-[var(--warning)]/10 disabled:opacity-50"
          >
            {enCours === "annuler" ? "Annulation…" : "Annuler le rendez-vous"}
          </button>
          <p className="text-xs text-[var(--muted)]">Le rendez-vous reste consultable, son créneau est libéré.</p>
        </div>
      )}

      {peutSupprimer && (
        <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4">
          <p className="text-xs text-[var(--muted)] uppercase tracking-wide">Supprimer</p>
          {suppressionPossible ? (
            armeSuppression ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={supprimer}
                  disabled={enCours !== null}
                  className="rounded-md bg-[var(--danger)] px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
                >
                  {enCours === "supprimer" ? "Suppression…" : "Confirmer la suppression définitive"}
                </button>
                <button onClick={() => setArmeSuppression(false)} className="text-sm underline">
                  Revenir
                </button>
              </div>
            ) : (
              <button
                onClick={() => setArmeSuppression(true)}
                className="self-start rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--surface-2)]"
              >
                Supprimer définitivement
              </button>
            )
          ) : (
            <p className="text-xs text-[var(--muted)]">
              Ce rendez-vous porte une facture ou un paiement encaissé : il doit être annulé, pas supprimé. La pièce
              comptable se conserve.
            </p>
          )}
          {suppressionPossible && (
            <p className="text-xs text-[var(--muted)]">
              Efface la ligne du planning. La trace de la suppression reste au journal d&apos;audit.
            </p>
          )}
        </div>
      )}

      {erreur && (
        <div className="text-sm text-[var(--warning)]">
          <p>{erreur}</p>
          {forcable && (
            <button onClick={() => decaler(true)} disabled={enCours !== null} className="mt-1 underline">
              Décaler quand même
            </button>
          )}
        </div>
      )}
      {message && <p className="text-sm text-[var(--success)]">{message}</p>}
    </div>
  );
}
