"use client";

import { REQUIRED_SLOTS, SLOT_LABEL } from "@/server/workflow/types";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { advance, collectCash, deletePhoto, sendPaymentLink, uploadPhoto } from "./actions";
import { TrackingEmitter } from "./tracking-emitter";
import {
  SignaturePad, VehicleCheck,
  type Adjustment, type HandoverSummary,
} from "./arrival-steps";
import { declareUnpaid } from "./actions";
import { Button } from "@/components/controls";

/**
 * Le workflow verrouillé du §12, vu par l'opérateur.
 *
 * Une seule action possible à l'écran : celle de l'étape en cours. Cet écran ne décide de
 * rien — il reflète ce que le serveur autorise, et affiche tel quel le motif de refus.
 */

/**
 * Les angles à photographier, dans l'ordre du tour du véhicule.
 *
 * Dérivés de la règle serveur plutôt que recopiés : c'est elle qui décide si une
 * prestation peut démarrer. Une liste d'écran qui diverge de la garde produit un
 * opérateur bloqué sans savoir pourquoi.
 */
const SLOTS = REQUIRED_SLOTS.map(
  (slot) => [slot, SLOT_LABEL[slot].replace(/^./, (c) => c.toUpperCase())] as const,
);

const CHAIN = [
  { status: "EN_ROUTE", label: "Trajet" },
  { status: "ARRIVED", label: "Arrivé" },
  { status: "PHOTOS_BEFORE", label: "Photos avant" },
  { status: "IN_PROGRESS", label: "Prestation" },
  { status: "PHOTOS_AFTER", label: "Photos après" },
  { status: "PAYMENT", label: "Encaissement" },
  { status: "COMPLETED", label: "Terminé" },
] as const;

const euros = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

type Photo = { id: string; phase: string; slot: string };

type Props = {
  appointmentId: string;
  status: string;
  startedAt: string | null;
  durationMin: number;
  photos: Photo[];
  payment: {
    totalCents: number;
    depositPaidCents: number;
    paidCents: number;
    balanceCents: number;
    discrepancyCents: number;
  };
  vehicle: {
    currentClass: string;
    currentLabel: string;
    label: string;
    adjustment: Adjustment | null;
  };
  handover: {
    signed: boolean;
    signerName: string | null;
    /** Chemins SVG du paraphe, pour le rejouer à l'écran une fois signé. */
    paths: string | null;
    signedAt: string | null;
    summary: HandoverSummary;
  };
  job: {
    serviceName: string;
    addressLabel: string;
    /** Photos envoyées par le client à la réservation (§13). */
    clientPhotoCount: number;
  };
};

const primaryButton =
  "w-full rounded-xl bg-brand-600 px-5 py-4 text-base font-semibold text-white [box-shadow:inset_0_1px_0_0_rgb(255_255_255/0.22),0_8px_24px_-12px_rgb(0_0_0/0.7)] transition hover:bg-brand-500 disabled:bg-xd-graphite disabled:text-chrome-500 disabled:shadow-none";

/** Position best-effort : une photo sans coordonnées reste acceptable (§13). */
function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 30_000 },
    );
  });
}

function ElapsedTimer({ startedAt, durationMin }: { startedAt: string; durationMin: number }) {
  const [elapsed, setElapsed] = useState(() =>
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000),
  );

  useEffect(() => {
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [startedAt]);

  const minutes = Math.floor(elapsed / 60);
  const over = minutes > durationMin;

  return (
    <div className="rounded-xl border border-night-700 bg-night-850 px-4 py-3 text-center">
      <p className="text-xs uppercase tracking-wide text-chrome-500">Temps écoulé</p>
      <p className={`tabular mt-0.5 text-3xl font-bold ${over ? "text-xd-warn" : "text-white"}`}>
        {String(minutes).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
      </p>
      <p className="mt-0.5 text-xs text-chrome-500">durée prévue {durationMin} min</p>
    </div>
  );
}

/** « 3 / 8 » : où en est l'opérateur, sans recompter les cases. */
function PhotoProgress({ photos, phase }: { photos: Photo[]; phase: "BEFORE" | "AFTER" }) {
  const taken = new Set(
    photos.filter((p) => p.phase === phase).map((p) => p.slot),
  );
  const done = REQUIRED_SLOTS.filter((slot) => taken.has(slot)).length;

  return (
    <span
      className={`tabular text-meta font-medium ${
        done === REQUIRED_SLOTS.length ? "text-xd-ok" : "text-xd-text-3"
      }`}
    >
      {done} / {REQUIRED_SLOTS.length}
    </span>
  );
}

function PhotoGrid({
  appointmentId,
  phase,
  photos,
  onChanged,
  onError,
}: {
  appointmentId: string;
  phase: "BEFORE" | "AFTER";
  photos: Photo[];
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const taken = new Map(photos.filter((p) => p.phase === phase).map((p) => [p.slot, p]));

  async function handleFile(slot: string, file: File) {
    setBusySlot(slot);
    onError("");

    const position = await currentPosition();
    const form = new FormData();
    form.set("appointmentId", appointmentId);
    form.set("phase", phase);
    form.set("slot", slot);
    // `capture="environment"` demande l'appareil photo ; le serveur vérifie
    // l'horodatage EXIF, seul signal qui ne se falsifie pas d'un clic (§13).
    form.set("capturedInApp", "true");
    if (position) {
      form.set("lat", String(position.lat));
      form.set("lng", String(position.lng));
    }
    form.set("file", file);

    const result = await uploadPhoto(form);
    setBusySlot(null);
    if (!result.ok) onError(result.error);
    else onChanged();
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {SLOTS.map(([slot, label]) => {
        const photo = taken.get(slot);
        const busy = busySlot === slot;

        return (
          <div key={slot}>
            <input
              id={`photo-${phase}-${slot}`}
              ref={(el) => {
                inputs.current[slot] = el;
              }}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(slot, file);
                event.target.value = "";
              }}
            />

            <button
              type="button"
              disabled={busy}
              onClick={() => inputs.current[slot]?.click()}
              className={`flex aspect-[4/3] w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-2 text-center transition ${
                photo
                  ? "border-xd-ok/60 bg-xd-ok/10"
                  : "border-night-600 bg-night-850 hover:border-brand-500"
              }`}
            >
              <span className={`text-2xl ${photo ? "text-xd-ok" : "text-chrome-500"}`}>
                {busy ? "…" : photo ? "✓" : "＋"}
              </span>
              <span className={`text-sm font-medium ${photo ? "text-xd-ok" : "text-chrome-300"}`}>
                {label}
              </span>
            </button>

            {photo && (
              <button
                type="button"
                onClick={async () => {
                  const result = await deletePhoto({ photoId: photo.id });
                  if (!result.ok) onError(result.error);
                  else onChanged();
                }}
                className="mt-1 w-full text-xs text-chrome-500 transition hover:text-xd-danger"
              >
                Reprendre
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PaymentStep({
  appointmentId,
  payment,
  onChanged,
  onError,
}: {
  appointmentId: string;
  payment: Props["payment"];
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [received, setReceived] = useState((payment.balanceCents / 100).toFixed(2));
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);

  const receivedCents = Math.round(Number(received.replace(",", ".")) * 100);
  const gap = Number.isFinite(receivedCents) ? receivedCents - payment.balanceCents : 0;

  return (
    <div className="space-y-4">
      <dl className="divide-y divide-night-700 rounded-xl border border-night-700 bg-night-850">
        {[
          ["Total de la prestation", euros(payment.totalCents)],
          ["Acompte déjà réglé", euros(payment.depositPaidCents)],
          ["Reste à encaisser", euros(payment.balanceCents)],
        ].map(([label, value], index) => (
          <div key={label} className="flex items-baseline justify-between px-4 py-3">
            <dt className="text-sm text-chrome-400">{label}</dt>
            <dd
              className={`tabular font-semibold ${index === 2 ? "text-xl text-white" : "text-chrome-200"}`}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {payment.balanceCents > 0 && (
        <>
          <div className="rounded-xl border border-night-700 bg-night-850 p-4">
            <h3 className="font-display text-sm font-bold text-white">Espèces</h3>
            <label className="mt-3 block">
              <span className="text-xs text-chrome-400">Montant reçu</span>
              <input
                id="received"
                type="text"
                inputMode="decimal"
                value={received}
                onChange={(event) => setReceived(event.target.value)}
                className="tabular mt-1 w-full rounded-lg border border-night-600 bg-night-900 px-4 py-3 text-right text-2xl font-semibold text-white outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-600/25"
              />
            </label>

            {gap !== 0 && Number.isFinite(receivedCents) && (
              <p className="mt-2 rounded-lg bg-xd-warn/10 px-3 py-2 text-sm text-xd-warn">
                Écart de {euros(gap)} — il sera enregistré et bloquera la clôture jusqu&apos;à
                régularisation par le central.
              </p>
            )}

            <button
              type="button"
              disabled={pending || !Number.isFinite(receivedCents)}
              onClick={() =>
                start(async () => {
                  const result = await collectCash({
                    appointmentId,
                    expectedCents: payment.balanceCents,
                    receivedCents,
                  });
                  if (!result.ok) onError(result.error);
                  else onChanged();
                })
              }
              className="mt-3 w-full rounded-lg bg-xd-graphite px-4 py-3 text-sm font-semibold text-white transition hover:bg-xd-slate disabled:opacity-50"
            >
              {pending ? "Enregistrement…" : "Encaisser en espèces"}
            </button>
          </div>

          <div className="rounded-xl border border-night-700 bg-night-850 p-4">
            <h3 className="font-display text-sm font-bold text-white">Carte</h3>
            <p className="mt-1 text-xs text-chrome-400">
              Le paiement est confirmé par le prestataire, jamais par vous : le solde
              restera dû tant que le règlement n&apos;est pas reçu.
            </p>

            {link ? (
              <p className="mt-3 rounded-lg bg-night-900 px-3 py-2 text-xs break-all text-chrome-300">
                {link}
              </p>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await sendPaymentLink({ appointmentId });
                    if (!result.ok) onError(result.error);
                    else {
                      setLink(result.url);
                      onChanged();
                    }
                  })
                }
                className="mt-3 w-full rounded-lg border border-night-600 px-4 py-3 text-sm font-semibold text-chrome-200 transition hover:border-brand-500"
              >
                Envoyer un lien de paiement
              </button>
            )}
          </div>
        </>
      )}

      {payment.discrepancyCents !== 0 && (
        <p className="rounded-xl border border-xd-danger/40 bg-xd-danger/10 px-4 py-3 text-sm text-xd-danger">
          Écart de caisse de {euros(payment.discrepancyCents)} enregistré. Le central doit le
          régulariser avant que la prestation puisse être clôturée.
        </p>
      )}
    </div>
  );
}

export function JobWorkflow(props: Props) {
  const { appointmentId, status, photos, payment } = props;
  const [error, setError] = useState("");
  const [arrivingSoon, setArrivingSoon] = useState(false);
  const [pending, start] = useTransition();

  // Référence stable : sans elle, `TrackingEmitter` relancerait sa géolocalisation à
  // chaque rendu du parent.
  const handleArrivingSoon = useCallback((value: boolean) => setArrivingSoon(value), []);

  const refresh = () => start(() => Promise.resolve());

  const act = (transition: Parameters<typeof advance>[0]["transition"]) =>
    start(async () => {
      setError("");
      const result = await advance({ appointmentId, transition });
      if (!result.ok) setError(result.error);
    });

  const currentIndex = CHAIN.findIndex((s) => s.status === status);

  return (
    <div className="space-y-5">
      {/* ── La chaîne, avec l'étape atteinte ──────────────────────────── */}
      <ol className="flex gap-1">
        {CHAIN.map((step, index) => (
          <li key={step.status} className="flex-1">
            <span
              className={`block h-1 rounded-full ${
                index < currentIndex
                  ? "bg-brand-600"
                  : index === currentIndex
                    ? "bg-brand-400"
                    : "bg-xd-graphite"
              }`}
            />
          </li>
        ))}
      </ol>
      <p className="-mt-3 text-xs text-chrome-500">
        Étape {Math.max(0, currentIndex) + 1} sur {CHAIN.length} ·{" "}
        {CHAIN[Math.max(0, currentIndex)]?.label}
      </p>

      {error && (
        <p
          className="rounded-xl border border-xd-danger/40 bg-xd-danger/10 px-4 py-3 text-sm text-xd-danger"
          role="alert"
        >
          {error}
        </p>
      )}

      {/* ── L'action de l'étape en cours, et elle seule ───────────────── */}
      {(status === "ASSIGNED" || status === "CONFIRMED") && (
        <div className="space-y-3">
          <button type="button" disabled={pending} onClick={() => act("START_TRIP")} className={primaryButton}>
            Démarrer le trajet
          </button>
          <p className="text-center text-xs text-chrome-500">
            Votre position sera partagée avec le client et le central pendant le trajet
            uniquement, et s&apos;arrêtera à votre arrivée.
          </p>
        </div>
      )}

      {status === "EN_ROUTE" && (
        <div className="space-y-3">
          <TrackingEmitter appointmentId={appointmentId} onArrivingSoon={handleArrivingSoon} />

          {arrivingSoon && (
            <p className="rounded-xl border border-xd-ok/40 bg-xd-ok/10 px-4 py-3 text-center text-sm font-medium text-xd-ok">
              Vous êtes presque arrivé — le client a été prévenu.
            </p>
          )}

          <button type="button" disabled={pending} onClick={() => act("ARRIVE")} className={primaryButton}>
            Je suis arrivé
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => act("NO_SHOW")}
            className="w-full rounded-xl border border-night-600 px-5 py-3 text-sm text-chrome-400 transition hover:border-xd-danger/50 hover:text-xd-danger"
          >
            Client absent
          </button>
        </div>
      )}

      {status === "ARRIVED" && (
        <div className="space-y-5">
          {/* §31 — vérifier le véhicule avant tout : un reclassement change le tarif,
              et le client doit l'accepter avant que le travail commence. */}
          <VehicleCheck
            appointmentId={appointmentId}
            currentClass={props.vehicle.currentClass}
            vehicleLabel={props.vehicle.label}
            serviceName={props.job.serviceName}
            addressLabel={props.job.addressLabel}
            durationMin={props.durationMin}
            totalCents={payment.totalCents}
            balanceCents={payment.balanceCents}
            clientPhotoCount={props.job.clientPhotoCount}
            signature={
              props.handover.signed
                ? { signerName: props.handover.signerName, paths: props.handover.paths }
                : null
            }
            adjustment={props.vehicle.adjustment}
            onChanged={refresh}
          />

          <div>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-white">Photos avant</h2>
              {/* §33 — la progression se lit sans compter les vignettes. */}
              <PhotoProgress photos={photos} phase="BEFORE" />
            </div>
            <p className="mt-0.5 text-sm text-chrome-400">
              Les {SLOTS.length} vues sont obligatoires. Elles prouvent l&apos;état du
              véhicule à votre arrivée.
            </p>
          </div>

          <PhotoGrid
            appointmentId={appointmentId}
            phase="BEFORE"
            photos={photos}
            onChanged={refresh}
            onError={setError}
          />

          <button
            type="button"
            disabled={pending}
            onClick={() => act("VALIDATE_PHOTOS_BEFORE")}
            className={primaryButton}
          >
            Valider les photos avant
          </button>
        </div>
      )}

      {status === "PHOTOS_BEFORE" && (
        <div className="space-y-4">
          {props.handover.signed ? (
            <>
              <p className="hairline rounded-[--radius-xd-md] px-4 py-3 text-meta text-xd-text-3">
                Bon signé par {props.handover.signerName}.
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={() => act("START_SERVICE")}
                className={primaryButton}
              >
                Démarrer la prestation
              </button>
            </>
          ) : (
            <SignaturePad
              appointmentId={appointmentId}
              summary={props.handover.summary}
              signerName={props.handover.summary.client}
              onSigned={refresh}
            />
          )}
        </div>
      )}

      {status === "IN_PROGRESS" && (
        <div className="space-y-4">
          {props.startedAt && (
            <ElapsedTimer startedAt={props.startedAt} durationMin={props.durationMin} />
          )}

          <div>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-white">Photos après</h2>
              <PhotoProgress photos={photos} phase="AFTER" />
            </div>
            <p className="mt-0.5 text-sm text-chrome-400">
              Mêmes vues qu&apos;avant, une fois la prestation terminée.
            </p>
          </div>

          <PhotoGrid
            appointmentId={appointmentId}
            phase="AFTER"
            photos={photos}
            onChanged={refresh}
            onError={setError}
          />

          <button
            type="button"
            disabled={pending}
            onClick={() => act("VALIDATE_PHOTOS_AFTER")}
            className={primaryButton}
          >
            Valider les photos après
          </button>
        </div>
      )}

      {status === "PHOTOS_AFTER" && (
        <button type="button" disabled={pending} onClick={() => act("OPEN_PAYMENT")} className={primaryButton}>
          Passer à l&apos;encaissement
        </button>
      )}

      {status === "PAYMENT" && (
        <div className="space-y-4">
          <h2 className="font-display text-lg font-bold text-white">Encaissement</h2>

          <PaymentStep
            appointmentId={appointmentId}
            payment={payment}
            onChanged={refresh}
            onError={setError}
          />

          <button
            type="button"
            disabled={pending || payment.balanceCents > 0 || payment.discrepancyCents !== 0}
            onClick={() => act("COMPLETE")}
            className={primaryButton}
          >
            Terminer la prestation
          </button>

          {payment.balanceCents > 0 && (
            <>
              <p className="text-center text-xs text-chrome-500">
                La clôture s&apos;ouvrira une fois le solde encaissé.
              </p>
              <UnpaidDeclaration appointmentId={appointmentId} onDone={refresh} onError={setError} />
            </>
          )}
        </div>
      )}

      {status === "COMPLETED" && (
        <div className="rounded-xl border border-xd-ok/40 bg-xd-ok/10 p-5 text-center">
          <p className="font-display text-lg font-bold text-xd-ok">Prestation terminée</p>
          <p className="mt-1 text-sm text-xd-ok">
            Le client a reçu son récapitulatif avec les photos avant et après.
          </p>
        </div>
      )}

      {status === "UNPAID" && (
        <div className="rounded-[--radius-xd-lg] bg-xd-danger/12 p-5 text-center">
          <p className="text-h3 text-xd-danger">Impayé déclaré</p>
          <p className="mt-2 text-meta text-xd-text-2">
            Le dossier est au central : photos avant et après, signature du client et
            montant dû. Vous n&apos;avez plus rien à faire ici.
          </p>
        </div>
      )}

      {status === "NO_SHOW" && (
        <div className="rounded-xl border border-xd-danger/40 bg-xd-danger/10 p-5 text-center text-sm text-xd-danger">
          Client absent — le central a été prévenu.
        </div>
      )}
    </div>
  );
}

/**
 * §36 — « Client refuse de payer » est une action sérieuse et destructive : elle
 * demande confirmation, et le serveur la refuse si la preuve n'est pas complète.
 */
function UnpaidDeclaration({
  appointmentId,
  onDone,
  onError,
}: {
  appointmentId: string;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="w-full rounded-[--radius-xd-md] py-3 text-meta text-xd-text-4 transition-colors hover:text-xd-danger"
      >
        Le client refuse de payer
      </button>
    );
  }

  return (
    <div className="rounded-[--radius-xd-lg] bg-xd-danger/10 p-4">
      <p className="text-body font-medium text-xd-danger">Déclarer un impayé ?</p>
      <p className="mt-1.5 text-meta leading-relaxed text-xd-text-2">
        La prestation sera close comme non réglée et le central prendra le relais. Vos
        photos et la signature du client constituent le dossier. Cette action ne
        s&apos;annule pas depuis l&apos;application.
      </p>

      <div className="mt-3 flex gap-2">
        <Button
          variant="danger"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await declareUnpaid({ appointmentId });
              if (result.ok) onDone();
              else onError(result.error);
            })
          }
        >
          {pending ? "…" : "Confirmer l'impayé"}
        </Button>
        <Button variant="tertiary" onClick={() => setConfirming(false)}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
