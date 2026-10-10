"use client";

import { useRef, useState, useTransition } from "react";
import { analyzeQuotePhotos } from "./actions";
import type { AnalysisOutcome, Suggestion } from "@/server/photo-analysis";
import { Button } from "@/components/controls";

/**
 * Étape photo du devis (§19, §20).
 *
 * « La partie IA doit devenir un moment "wow". Pas un gadget. »
 *
 * Le moment tient à deux choses : une séquence d'analyse qui montre le travail plutôt
 * qu'un sablier, et une distinction visuelle nette entre ce qui est **constaté** et ce
 * qui est **proposé** — le client doit sentir qu'on lui montre sa voiture, pas qu'on
 * lui vend des options.
 */

const euros = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

const SEVERITY_TONE: Record<string, string> = {
  LEGER: "text-xd-text-3",
  MODERE: "text-xd-warn",
  IMPORTANT: "text-xd-danger",
};

/** Étapes affichées pendant l'analyse : elles décrivent ce qui se passe vraiment. */
const SEQUENCE = [
  "Lecture des photos",
  "Repérage des zones",
  "Évaluation de l'état",
  "Recommandations",
];

type Shot = { id: string; file: File; url: string };

export function PhotoStep({
  serviceId,
  vehicleLabel,
  quoteToken,
  selectedOptionIds,
  onAddOption,
  available,
}: {
  serviceId: string;
  vehicleLabel: string;
  quoteToken: string;
  selectedOptionIds: string[];
  onAddOption: (optionId: string) => void;
  available: boolean;
}) {
  const [shots, setShots] = useState<Shot[]>([]);
  const [outcome, setOutcome] = useState<AnalysisOutcome | null>(null);
  const [stage, setStage] = useState(0);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next = Array.from(files)
      .slice(0, 6 - shots.length)
      .map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }));
    setShots((previous) => [...previous, ...next]);
    setOutcome(null);
  }

  function remove(id: string) {
    setShots((previous) => {
      const shot = previous.find((s) => s.id === id);
      if (shot) URL.revokeObjectURL(shot.url);
      return previous.filter((s) => s.id !== id);
    });
    setOutcome(null);
  }

  function analyze() {
    setOutcome(null);
    setStage(0);

    // La séquence avance pendant que la requête tourne : le client voit le travail
    // plutôt qu'un sablier (§47).
    const ticker = setInterval(
      () => setStage((s) => Math.min(s + 1, SEQUENCE.length - 1)),
      900,
    );

    start(async () => {
      const form = new FormData();
      form.set("serviceId", serviceId);
      form.set("vehicleLabel", vehicleLabel);
      form.set("quoteToken", quoteToken);
      for (const shot of shots) form.append("photos", shot.file);

      const result = await analyzeQuotePhotos(form);
      clearInterval(ticker);
      setOutcome(result);
    });
  }

  return (
    <section>
      <h1 className="text-h2 text-xd-text">Montrez-nous votre véhicule</h1>
      <p className="mt-2 text-body text-xd-text-3">
        {available
          ? "Quelques photos suffisent : nous repérons ce qui demande une attention particulière et vous proposons les options utiles. Vous restez libre de les ajouter ou non."
          : "Ces photos aident votre opérateur à préparer son matériel avant de venir."}
      </p>

      {/* ── Prises de vue (§20) ─────────────────────────────────────────── */}
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <div className="mt-6 grid grid-cols-3 gap-2.5">
        {shots.map((shot) => (
          <div key={shot.id} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shot.url}
              alt=""
              className="hairline aspect-square w-full rounded-[--radius-xd-md] object-cover"
            />
            <button
              type="button"
              onClick={() => remove(shot.id)}
              aria-label="Retirer cette photo"
              className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-meta text-white backdrop-blur"
            >
              ×
            </button>
          </div>
        ))}

        {shots.length < 6 && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="press hairline flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-[--radius-xd-md] bg-black/[0.025] transition-colors hover:bg-black/[0.045]"
          >
            <span className="text-2xl text-xd-text-4" aria-hidden>＋</span>
            <span className="text-meta text-xd-text-3">
              {shots.length === 0 ? "Ajouter" : "Encore"}
            </span>
          </button>
        )}
      </div>

      {shots.length > 0 && !outcome && available && (
        <Button
          variant="primary"
          size="lg"
          className="mt-5 w-full"
          disabled={pending}
          onClick={analyze}
        >
          {pending ? SEQUENCE[stage] + "…" : "Analyser mes photos"}
        </Button>
      )}

      {/* ── Séquence d'analyse ──────────────────────────────────────────── */}
      {pending && (
        <ol className="mt-5 space-y-2">
          {SEQUENCE.map((label, index) => (
            <li key={label} className="flex items-center gap-2.5">
              <span
                className={`size-1.5 rounded-full transition-colors ${
                  index < stage
                    ? "bg-xd-purple"
                    : index === stage
                      ? "animate-pulse bg-xd-purple-bright"
                      : "bg-black/[0.07]"
                }`}
              />
              <span
                className={`text-meta transition-colors ${
                  index <= stage ? "text-xd-text-2" : "text-xd-text-4"
                }`}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>
      )}

      {/* ── Résultat ────────────────────────────────────────────────────── */}
      {outcome && !outcome.ok && (
        <p className="mt-5 rounded-[--radius-xd-md] bg-black/[0.03] px-4 py-3.5 text-meta leading-relaxed text-xd-text-3">
          {outcome.message}
        </p>
      )}

      {outcome?.ok && (
        <div className="mt-6 space-y-5">
          {/* Détecté par X Detailing — des faits, pas une offre. */}
          <div className="m-graphite rounded-[--radius-xd-lg] p-5">
            <p className="eyebrow text-xd-text-4">Détecté par X&nbsp;Detailing</p>
            <p className="mt-2 text-h3 text-xd-text">{outcome.cleanlinessLabel}</p>
            <p className="mt-1.5 text-body leading-relaxed text-xd-text-2">{outcome.summary}</p>

            {outcome.findings.length > 0 && (
              <ul className="hairline-t mt-4 space-y-2 pt-4">
                {outcome.findings.map((finding, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="w-28 shrink-0 text-meta text-xd-text-4">
                      {finding.zoneLabel}
                    </span>
                    <span className={`text-meta ${SEVERITY_TONE[finding.severity] ?? "text-xd-text-2"}`}>
                      {finding.observation}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Option proposée — visuellement distinct, et jamais ajouté d'office. */}
          {outcome.suggestions.length > 0 && (
            <div>
              <p className="eyebrow text-xd-purple-bright">Options proposées</p>
              <p className="mt-1.5 text-meta text-xd-text-4">
                Rien n&apos;est ajouté à votre devis tant que vous ne le décidez pas.
              </p>

              <ul className="mt-3 space-y-2.5">
                {outcome.suggestions.map((suggestion) => (
                  <SuggestionRow
                    key={suggestion.optionId}
                    suggestion={suggestion}
                    added={selectedOptionIds.includes(suggestion.optionId)}
                    onAdd={() => onAddOption(suggestion.optionId)}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {shots.length === 0 && (
        <p className="mt-6 text-center text-meta text-xd-text-4">
          Cette étape est facultative — vous pouvez passer directement à la suite.
        </p>
      )}
    </section>
  );
}

function SuggestionRow({
  suggestion,
  added,
  onAdd,
}: {
  suggestion: Suggestion;
  added: boolean;
  onAdd: () => void;
}) {
  return (
    <li
      className={`rounded-[--radius-xd-md] p-4 transition-all duration-200 ${
        added ? "m-purple" : "hairline bg-black/[0.025]"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body font-medium text-xd-text">{suggestion.name}</span>
        <span className="tabular shrink-0 text-body text-xd-text-2">
          +{euros(suggestion.priceCents)}
        </span>
      </div>

      <p className="mt-1.5 text-meta leading-relaxed text-xd-text-3">{suggestion.reason}</p>

      {added ? (
        <p className="mt-3 text-meta font-medium text-xd-purple-bright">Ajoutée à votre devis</p>
      ) : (
        <Button variant="secondary" className="mt-3" onClick={onAdd}>
          Ajouter au devis
        </Button>
      )}
    </li>
  );
}
