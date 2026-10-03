"use client";

import { useRef, useState, useTransition } from "react";
import {
  confirmReclassification,
  reclassifyVehicle,
  signHandover,
} from "./actions";
import { Button, Field, Input, Select, Textarea } from "@/components/controls";
import { SignatureView } from "@/components/signature-view";
import { formatDuration } from "@/server/time";

/**
 * Étapes de la prise en charge (§31, §32).
 *
 * Elles s'intercalent entre l'arrivée et le démarrage : contrôler le véhicule, faire
 * accepter l'éventuel écart de tarif, puis faire signer. Les gardes du workflow
 * refusent de démarrer tant que les deux ne sont pas faites — l'écran ne fait que
 * refléter cette règle.
 */

const euros = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

const VEHICLE_CLASSES = [
  ["CITADINE", "Citadine"],
  ["BERLINE", "Berline"],
  ["BREAK", "Break"],
  ["SUV", "SUV"],
  ["QUATRE_X_QUATRE", "4x4"],
  ["UTILITAIRE", "Utilitaire"],
  ["SEPT_PLACES", "7 places"],
] as const;

export type Adjustment = {
  fromLabel: string;
  toLabel: string;
  fromCents: number;
  toCents: number;
  deltaCents: number;
  accepted: boolean;
};

// ═══════════════════════════════════════════════════════════════════════════
// §31 — CONTRÔLE DU VÉHICULE
// ═══════════════════════════════════════════════════════════════════════════

export function VehicleCheck({
  appointmentId,
  currentClass,
  vehicleLabel,
  serviceName,
  addressLabel,
  durationMin,
  totalCents,
  balanceCents,
  clientPhotoCount,
  signature,
  adjustment,
  onChanged,
}: {
  appointmentId: string;
  currentClass: string;
  vehicleLabel: string;
  serviceName: string;
  addressLabel: string;
  durationMin: number;
  totalCents: number;
  balanceCents: number;
  clientPhotoCount: number;
  signature: { signerName: string | null; paths: string | null } | null;
  adjustment: Adjustment | null;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [toClass, setToClass] = useState(currentClass);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Un écart proposé attend l'accord du client : c'est l'écran le plus important
  // de la prise en charge, il prend toute la place.
  if (adjustment && !adjustment.accepted) {
    const higher = adjustment.deltaCents > 0;

    return (
      <section className="m-purple rounded-[--radius-xd-lg] p-5">
        <p className="eyebrow text-xd-purple-bright">Nouveau tarif à valider</p>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-body text-xd-text-3 line-through">{adjustment.fromLabel}</span>
          <span className="text-xd-text-4" aria-hidden>→</span>
          <span className="text-h3 text-xd-text">{adjustment.toLabel}</span>
        </div>

        <div className="mt-3 flex items-baseline gap-3">
          <span className="tabular text-body text-xd-text-3 line-through">
            {euros(adjustment.fromCents)}
          </span>
          <span className="text-xd-text-4" aria-hidden>→</span>
          <span className="tabular text-[2rem] font-semibold leading-none tracking-[-0.03em] text-xd-text">
            {euros(adjustment.toCents)}
          </span>
        </div>

        <p className={`mt-2 text-meta ${higher ? "text-xd-warn" : "text-xd-ok"}`}>
          {higher ? "+" : ""}
          {euros(adjustment.deltaCents)} par rapport à la réservation
        </p>

        <p className="mt-4 text-meta leading-relaxed text-xd-text-2">
          Montrez cet écran au client. La prestation ne peut pas démarrer tant qu&apos;il
          n&apos;a pas accepté ce tarif.
        </p>

        {error && <p className="mt-3 text-meta text-xd-danger">{error}</p>}

        <Button
          variant="primary"
          size="lg"
          disabled={pending}
          className="mt-4 w-full"
          onClick={() =>
            start(async () => {
              setError(null);
              const result = await confirmReclassification({ appointmentId });
              if (result.ok) onChanged();
              else setError(result.error);
            })
          }
        >
          {pending ? "Validation…" : "Le client accepte"}
        </Button>
      </section>
    );
  }

  if (adjustment?.accepted) {
    return (
      <p className="hairline rounded-[--radius-xd-md] px-4 py-3 text-meta text-xd-text-3">
        Véhicule reclassé {adjustment.fromLabel} → {adjustment.toLabel}, nouveau tarif
        accepté ({euros(adjustment.toCents)}).
      </p>
    );
  }

  return (
    <section className="rounded-[--radius-xd-lg] p-5 m-polished">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow whitespace-nowrap text-xd-text-4">Contrôle du véhicule</p>
        {/*
          Ce que le client a photographié en réservant. « Aucune » n'est pas un défaut :
          c'est une information — l'opérateur arrive alors sans idée de l'état du véhicule.
        */}
        <span className="hairline shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-micro tracking-wide text-xd-text-3">
          {clientPhotoCount === 0 ? "Sans photo client" : `${clientPhotoCount} photo${clientPhotoCount > 1 ? "s" : ""}`}
        </span>
      </div>

      <dl className="mt-3 space-y-1 text-meta">
        <div className="flex gap-2">
          <dt className="sr-only">Véhicule</dt>
          <dd className="text-body text-xd-text">{vehicleLabel}</dd>
        </div>
        <div className="flex gap-2 text-xd-text-3">
          <dt className="sr-only">Prestation</dt>
          <dd>{serviceName}</dd>
        </div>
        <div className="flex gap-1.5 text-xd-text-3">
          <dt>Adresse :</dt>
          <dd>{addressLabel}</dd>
        </div>
        <div className="flex gap-1.5 text-xd-text-3">
          <dt>Durée prévue :</dt>
          <dd>{formatDuration(durationMin)}</dd>
        </div>
        <div className="flex gap-1.5 text-xd-text-3">
          <dt>Reste à payer :</dt>
          <dd className="tabular text-xd-text-2">{euros(balanceCents)}</dd>
        </div>
      </dl>

      <p className="mt-4 text-body text-xd-text-2">
        Contrôlez la plaque, la catégorie, la prestation et le prix.
      </p>

      {/*
        §31 — la catégorie est un point de contrôle, pas une procédure d'exception :
        elle reste à l'écran, prête à être corrigée. Cachée derrière « ce n'est pas le
        bon véhicule », elle ne se vérifiait jamais.
      */}
      <div className="mt-4">
        <Field label="Catégorie réelle">
          <Select
            value={toClass}
            onChange={(event) => {
              setToClass(event.target.value);
              setOpen(event.target.value !== currentClass);
            }}
          >
            {VEHICLE_CLASSES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {open && toClass !== currentClass ? (
        <div className="mt-3 space-y-3">
          <Field label="Précision" hint="Visible par le central, pas par le client.">
            <Textarea
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Utilitaire long au lieu d'un Kangoo…"
            />
          </Field>

          {error && <p className="text-meta text-xd-danger">{error}</p>}

          <div className="flex gap-2">
            <Button
              variant="primary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const result = await reclassifyVehicle({ appointmentId, toClass: toClass as never, reason });
                  if (result.ok) onChanged();
                  else setError(result.error);
                })
              }
            >
              {pending ? "…" : "Recalculer le tarif"}
            </Button>
            <Button
              variant="tertiary"
              onClick={() => {
                setToClass(currentClass);
                setOpen(false);
              }}
            >
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <p className="tabular mt-3 text-body text-xd-text">
          Tarif confirmé : <span className="font-semibold">{euros(totalCents)}</span>
        </p>
      )}

      {/* §32 — une fois le bon signé, le paraphe reste à l'écran : c'est la preuve
          que l'opérateur montre s'il doit justifier le démarrage. */}
      {signature?.paths && (
        <div className="mt-5">
          <p className="text-meta font-medium text-xd-ok">
            ✓ Client validé et signé
            {signature.signerName ? ` — ${signature.signerName}` : ""}
          </p>
          <SignatureView paths={signature.paths} className="mt-2" />
        </div>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §32 — SIGNATURE
// ═══════════════════════════════════════════════════════════════════════════

export type HandoverSummary = {
  client: string;
  vehicle: string;
  plate: string | null;
  service: string;
  options: string[];
  totalCents: number;
  depositPaidCents: number;
  balanceCents: number;
};

/**
 * Pavé de signature.
 *
 * Le tracé est enregistré en SVG et non en image : quelques kilo-octets, net à toute
 * échelle, et lisible dans le dossier de preuve des années plus tard (§36).
 */
export function SignaturePad({
  appointmentId,
  summary,
  signerName,
  onSigned,
}: {
  appointmentId: string;
  summary: HandoverSummary;
  signerName: string;
  onSigned: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Array<Array<[number, number]>>>([]);
  const drawing = useRef(false);

  const [name, setName] = useState(signerName);
  const [hasInk, setHasInk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function pointFrom(event: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const rect = event.currentTarget.getBoundingClientRect();
    return [
      Math.round(((event.clientX - rect.left) / rect.width) * 1000),
      Math.round(((event.clientY - rect.top) / rect.height) * 300),
    ];
  }

  function redraw() {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;

    const ratio = window.devicePixelRatio || 1;
    element.width = element.clientWidth * ratio;
    element.height = element.clientHeight * ratio;
    context.scale(ratio, ratio);

    context.clearRect(0, 0, element.clientWidth, element.clientHeight);
    context.strokeStyle = "#f4f4f6";
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";

    const scaleX = element.clientWidth / 1000;
    const scaleY = element.clientHeight / 300;

    for (const stroke of strokes.current) {
      context.beginPath();
      stroke.forEach(([x, y], index) => {
        const px = x * scaleX;
        const py = y * scaleY;
        if (index === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      });
      context.stroke();
    }
  }

  /** Conversion en chemins SVG, dans un repère fixe 1000 × 300. */
  function toSvgPaths(): string {
    return strokes.current
      .filter((stroke) => stroke.length > 1)
      .map((stroke) => "M" + stroke.map(([x, y]) => `${x} ${y}`).join(" L"))
      .join(" ");
  }

  return (
    <section className="space-y-4">
      {/* Ce que le client approuve — « propre, presque institutionnel » (§32). */}
      <div className="m-graphite rounded-[--radius-xd-lg] p-5">
        <p className="eyebrow text-xd-text-4">Bon de prise en charge</p>

        <dl className="mt-3 space-y-1.5">
          {[
            ["Client", summary.client],
            ["Véhicule", summary.plate ? `${summary.vehicle} · ${summary.plate}` : summary.vehicle],
            ["Prestation", summary.service],
            ...(summary.options.length > 0
              ? [["Options", summary.options.join(", ")] as [string, string]]
              : []),
          ].map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4">
              <dt className="shrink-0 text-meta text-xd-text-4">{label}</dt>
              <dd className="text-right text-meta text-xd-text-2">{value}</dd>
            </div>
          ))}
        </dl>

        <dl className="hairline-t mt-4 space-y-1.5 pt-4">
          {[
            ["Total", euros(summary.totalCents)],
            ["Acompte réglé", euros(summary.depositPaidCents)],
          ].map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4">
              <dt className="text-meta text-xd-text-4">{label}</dt>
              <dd className="tabular text-meta text-xd-text-2">{value}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4 pt-1">
            <dt className="text-body text-xd-text-2">Solde à régler</dt>
            <dd className="tabular text-h3 text-xd-text">{euros(summary.balanceCents)}</dd>
          </div>
        </dl>
      </div>

      <Field label="Nom du signataire">
        <Input
          id="signer"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
        />
      </Field>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-meta text-xd-text-3">Signature du client</span>
          {hasInk && (
            <button
              type="button"
              onClick={() => {
                strokes.current = [];
                setHasInk(false);
                redraw();
              }}
              className="text-meta text-xd-text-4 transition-colors hover:text-xd-text-2"
            >
              Effacer
            </button>
          )}
        </div>

        <canvas
          ref={canvas}
          className="hairline h-44 w-full touch-none rounded-[--radius-xd-md] bg-white/[0.04]"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            drawing.current = true;
            strokes.current.push([pointFrom(event)]);
          }}
          onPointerMove={(event) => {
            if (!drawing.current) return;
            strokes.current.at(-1)?.push(pointFrom(event));
            setHasInk(true);
            redraw();
          }}
          onPointerUp={() => {
            drawing.current = false;
          }}
          onPointerLeave={() => {
            drawing.current = false;
          }}
        />
      </div>

      {error && (
        <p className="rounded-[--radius-xd-md] bg-xd-danger/12 px-4 py-3 text-meta text-xd-danger" role="alert">
          {error}
        </p>
      )}

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={pending || !hasInk || name.trim().length < 2}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await signHandover({
              appointmentId,
              paths: toSvgPaths(),
              signerName: name,
            });
            if (result.ok) onSigned();
            else setError(result.error);
          })
        }
      >
        {pending ? "Enregistrement…" : "Valider la signature"}
      </Button>

      {!hasInk && (
        <p className="text-center text-meta text-xd-text-4">
          Faites signer le client dans le cadre ci-dessus.
        </p>
      )}
    </section>
  );
}
