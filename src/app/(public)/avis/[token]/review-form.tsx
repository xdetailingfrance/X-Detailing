"use client";

import { useState, useTransition } from "react";
import { postReview } from "./actions";

/**
 * §25 — « les très bons avis peuvent être orientés vers Google ; les avis faibles
 * doivent déclencher une alerte au central ».
 *
 * Les deux chemins partent du même formulaire : l'avis est enregistré dans tous les cas.
 * Ce qui change, c'est ce qu'on propose ensuite — publier, ou être rappelé.
 */



export function ReviewForm({
  token,
  operatorFirstName,
  googleReviewUrl,
}: {
  token: string;
  operatorFirstName: string | null;
  /** `null` tant que la fiche Google n'est pas renseignée : on n'affiche alors rien. */
  googleReviewUrl: string | null;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState<{ routedToGoogle: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (sent) {
    return (
      <div className="mt-8 rounded-2xl border border-brand-700 bg-brand-600/10 p-6 text-center">
        <p className="font-display text-lg font-bold text-xd-text">Merci pour votre retour</p>

        {sent.routedToGoogle ? (
          <>
            <p className="mt-2 text-sm text-chrome-300">
              Ravi que tout se soit bien passé. Un avis public aide beaucoup
              {operatorFirstName ? ` ${operatorFirstName}` : " nos opérateurs"}.
            </p>
            {googleReviewUrl && (
              <a
                href={googleReviewUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-500"
              >
                Publier mon avis sur Google
              </a>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-chrome-300">
            Nous avons transmis votre retour au responsable du réseau. Il vous
            recontactera pour comprendre ce qui n&apos;a pas convenu.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-5">
      <div>
        <p className="text-sm font-medium text-chrome-300">Votre note</p>
        <div className="mt-2 flex gap-1.5" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((value) => {
            const filled = value <= (hover || rating);
            return (
              <button
                key={value}
                type="button"
                aria-label={`${value} sur 5`}
                aria-pressed={rating === value}
                onMouseEnter={() => setHover(value)}
                onFocus={() => setHover(value)}
                onClick={() => setRating(value)}
                className={`grid size-14 place-items-center rounded-xl border text-2xl transition ${
                  filled
                    ? "border-brand-500 bg-brand-600/20 text-brand-400"
                    : "border-night-600 bg-night-850 text-chrome-500 hover:border-night-600"
                }`}
              >
                ★
              </button>
            );
          })}
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-chrome-300">
          Un mot&nbsp;? <span className="text-chrome-500">(facultatif)</span>
        </span>
        <textarea
          id="comment"
          rows={4}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder={
            rating > 0 && rating <= 3
              ? "Dites-nous ce qui n'a pas convenu."
              : "Ce qui vous a plu…"
          }
          className="mt-1 w-full rounded-xl border border-night-600 bg-night-900 px-4 py-3 text-base text-chrome-100 outline-none transition placeholder:text-chrome-500 focus:border-brand-500 focus:ring-4 focus:ring-brand-600/25"
        />
      </label>

      {error && (
        <p className="rounded-xl border border-xd-danger/40 bg-xd-danger/10 px-4 py-3 text-sm text-xd-danger" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={rating === 0 || pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await postReview({ token, rating, comment });
            if (result.ok) setSent({ routedToGoogle: result.routedToGoogle });
            else setError(result.error);
          })
        }
        className="w-full rounded-xl bg-brand-600 px-5 py-4 text-base font-semibold text-white transition hover:bg-brand-500 disabled:bg-xd-graphite disabled:text-chrome-500"
      >
        {pending ? "Envoi…" : "Envoyer mon avis"}
      </button>
    </div>
  );
}
