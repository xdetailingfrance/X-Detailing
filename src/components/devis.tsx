"use client";

import { useActionState, useRef, useState, useTransition, type ReactNode } from "react";
import { chargerCreneaux, reserver, type Disponibilites, type ReservationState } from "@/app/actions";
import { BUSINESS, realValue, telHref } from "@/lib/business";
import {
  CATEGORIES_OPTIONS,
  FORMULES,
  OPTIONS,
  VEHICULES,
  euros,
  formule,
  option,
  prixFormule,
  prixMinimum,
  totalDevis,
  vehicule,
  type FormuleId,
  type OptionId,
  type VehiculeId,
} from "@/lib/catalogue";
import { VEHICULE_ICON } from "./silhouettes";

/**
 * Le parcours de réservation en cinq étapes, et les formules en dessous.
 *
 * Un seul composant tient les deux : « Choisir cette formule » depuis les cartes
 * de prix doit ouvrir le parcours avec la formule et le véhicule déjà retenus, pas
 * renvoyer à la première question.
 *
 * Le prix s'affiche au fur et à mesure, pour décider. Il n'engage rien : le serveur
 * recalcule le total à partir du catalogue avant d'écrire l'e-mail. Les créneaux
 * libres sont demandés au serveur à l'entrée de l'étape 4, jamais devinés.
 */

const ETAPES = ["Formule", "Véhicule", "Options", "Créneau", "Coordonnées"] as const;
type Etape = 1 | 2 | 3 | 4 | 5;

type Champs = {
  adresse: string;
  codePostal: string;
  ville: string;
  jour: string;
  creneau: string;
  precisions: string;
  prenom: string;
  nom: string;
  telephone: string;
  email: string;
  message: string;
  consent: boolean;
};

const CHAMPS_VIDES: Champs = {
  adresse: "",
  codePostal: "",
  ville: "",
  jour: "",
  creneau: "",
  precisions: "",
  prenom: "",
  nom: "",
  telephone: "",
  email: "",
  message: "",
  consent: false,
};

/** Les champs de l'étape « Créneau », reportés en champs cachés ailleurs. */
const CHAMPS_LIEU = ["adresse", "codePostal", "ville", "jour", "creneau", "precisions"] as const;

/** L'étape qui porte chaque champ : pour ramener le visiteur sur l'erreur signalée. */
const ETAPE_DU_CHAMP: Record<string, Etape> = {
  formule: 1,
  vehicule: 2,
  options: 3,
  adresse: 4,
  codePostal: 4,
  ville: 4,
  jour: 4,
  creneau: 4,
  precisions: 4,
  prenom: 5,
  nom: 5,
  telephone: 5,
  email: 5,
  message: 5,
  consent: 5,
};

/** Remonte au haut du cadre s'il est sorti de l'écran — pas s'il est déjà visible. */
function remonterVers(el: HTMLElement | null) {
  if (!el) return;
  if (el.getBoundingClientRect().top < 0) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export function Devis() {
  const [etape, setEtape] = useState<Etape>(1);
  const [atteinte, setAtteinte] = useState<Etape>(1);
  const [formuleId, setFormuleId] = useState<FormuleId | null>(null);
  const [vehiculeId, setVehiculeId] = useState<VehiculeId | null>(null);
  // Le véhicule affiché dans les cartes de prix, tant qu'aucun n'est choisi.
  const [apercu, setApercu] = useState<VehiculeId>("berline");
  const [optionIds, setOptionIds] = useState<OptionId[]>([]);
  const [champs, setChamps] = useState<Champs>(CHAMPS_VIDES);
  const [erreurLocale, setErreurLocale] = useState<string | null>(null);
  const [dispo, setDispo] = useState<Disponibilites | null>(null);
  const [chargement, demarrerChargement] = useTransition();
  const cadre = useRef<HTMLDivElement>(null);

  const chargerDispo = () => {
    demarrerChargement(async () => {
      setDispo(await chargerCreneaux());
    });
  };

  const [state, formAction, pending] = useActionState<ReservationState, FormData>(
    async (precedent, formData) => {
      const resultat = await reserver(precedent, formData);
      // Une erreur serveur ramène sur l'étape du premier champ fautif.
      if (resultat.status === "error") {
        const etapes = Object.keys(resultat.errors)
          .map((champ) => ETAPE_DU_CHAMP[champ])
          .filter((e): e is Etape => e !== undefined);
        if (etapes.length > 0) setEtape(Math.min(...etapes) as Etape);
        // Un créneau pris entre-temps : on relit les disponibilités, et on repart
        // d'un créneau vide plutôt que d'un créneau que l'on sait refusé.
        if (resultat.errors.creneau) {
          setChamps((c) => ({ ...c, creneau: "" }));
          chargerDispo();
        }
        remonterVers(cadre.current);
      }
      // Le formulaire laisse place à la confirmation, bien plus courte : on la
      // remonte sous les yeux plutôt que de laisser le visiteur sur les formules.
      if (resultat.status === "sent") remonterVers(cadre.current);
      return resultat;
    },
    { status: "idle" },
  );

  const aller = (suivante: Etape) => {
    setErreurLocale(null);
    setEtape(suivante);
    setAtteinte((max) => (suivante > max ? suivante : max));
    // Les créneaux se relisent à chaque passage : ils ont pu être pris entre-temps.
    if (suivante === 4) chargerDispo();
    remonterVers(cadre.current);
  };

  const basculerOption = (id: OptionId) =>
    setOptionIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const choisirApercu = (id: VehiculeId) => {
    setApercu(id);
    if (vehiculeId) setVehiculeId(id);
  };

  /** Depuis une carte de prix : formule et véhicule retenus, on arrive aux options. */
  const choisirDepuisCarte = (id: FormuleId) => {
    setFormuleId(id);
    setVehiculeId(vehiculeId ?? apercu);
    setErreurLocale(null);
    setEtape(3);
    setAtteinte((max) => (max > 3 ? max : 3));
    document.getElementById("reserver")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const validerLieu = () => {
    if (
      champs.adresse.trim().length < 3 ||
      !/^\d{5}$/.test(champs.codePostal.trim()) ||
      champs.ville.trim().length < 2
    ) {
      setErreurLocale("Indiquez l'adresse complète : rue, code postal et ville.");
      return;
    }
    if (!champs.jour || !champs.creneau) {
      setErreurLocale("Choisissez un jour et une heure.");
      return;
    }
    aller(5);
  };

  const maj = (nom: keyof Champs, valeur: string | boolean) =>
    setChamps((c) => ({ ...c, [nom]: valeur }));

  const errors = state.status === "error" ? state.errors : {};
  const vehiculeAffiche = vehiculeId ?? apercu;
  const total = formuleId && vehiculeId ? totalDevis(formuleId, vehiculeId, optionIds) : null;
  const phone = realValue(BUSINESS.phone);
  const tel = telHref();

  const jours = dispo && "jours" in dispo ? dispo.jours : [];
  const jourChoisi = jours.find((j) => j.jour === champs.jour) ?? null;
  const creneauChoisi = jourChoisi?.creneaux.find((c) => c.heure === champs.creneau) ?? null;
  const libelleCreneauChoisi =
    jourChoisi && creneauChoisi ? `${jourChoisi.libelle} à ${creneauChoisi.libelle}` : null;

  return (
    <>
      <section id="reserver" className="scroll-mt-20">
        <div className="mx-auto max-w-3xl px-5 pb-16 pt-6 sm:pb-20">
          <div className="text-center">
            <p className="eyebrow text-xd-violet-deep">Réservation en ligne</p>
            <h2 className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-xd-text sm:text-[2.2rem]">
              Réservez votre créneau en deux minutes.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-xd-text-3">
              Cinq questions, le prix s&apos;affiche au fur et à mesure. Le créneau est
              bloqué pour vous dès l&apos;envoi.
            </p>
          </div>

          <div ref={cadre} className="card mt-8 scroll-mt-24 overflow-hidden rounded-xd-xl">
            {state.status === "sent" ? (
              <div className="rise px-6 py-12 text-center sm:px-10 sm:py-16">
                <span className="inline-flex size-12 items-center justify-center rounded-full bg-xd-ok-pale text-xd-ok">
                  <Check className="size-6" />
                </span>
                <p className="mt-5 text-2xl font-semibold tracking-tight text-xd-text">
                  Créneau réservé.
                </p>
                {state.resume && (
                  <p className="mt-3 text-lg font-medium text-xd-text">{state.resume.creneau}</p>
                )}
                <p className="mx-auto mt-3 max-w-md text-xd-text-2">
                  Nous vous rappelons pour confirmer les détails.
                  {tel && phone ? (
                    <>
                      {" "}
                      Une question d&apos;ici là ?{" "}
                      <a href={tel} className="font-medium text-xd-violet-deep">
                        {phone}
                      </a>
                      .
                    </>
                  ) : null}
                </p>
                {state.resume && (
                  <p className="tabular mt-6 text-sm text-xd-text-3">
                    {state.resume.formule} · {state.resume.vehicule} ·{" "}
                    <span className="font-medium text-xd-text">{euros(state.resume.total)}</span>
                  </p>
                )}
              </div>
            ) : (
              <form
                action={formAction}
                noValidate
                onKeyDown={(e) => {
                  // Entrée ne valide pas une étape intermédiaire : « Continuer » le fait.
                  if (
                    e.key === "Enter" &&
                    etape < 5 &&
                    (e.target as HTMLElement).tagName !== "TEXTAREA"
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                {/* Ce que les étapes précédentes ont décidé. */}
                {formuleId && <input type="hidden" name="formule" value={formuleId} />}
                {vehiculeId && <input type="hidden" name="vehicule" value={vehiculeId} />}
                {optionIds.map((id) => (
                  <input key={id} type="hidden" name="options" value={id} />
                ))}
                {etape !== 4 &&
                  CHAMPS_LIEU.map((nom) => (
                    <input key={nom} type="hidden" name={nom} value={champs[nom]} />
                  ))}

                {/* Piège à robots : invisible, jamais atteint au clavier. */}
                <div aria-hidden className="absolute left-[-9999px] top-0 h-px w-px overflow-hidden">
                  <label htmlFor="website">Ne pas remplir</label>
                  <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
                </div>

                <Stepper etape={etape} atteinte={atteinte} onGo={aller} />

                <div className="px-5 py-6 sm:px-8 sm:py-8">
                  {etape === 1 && (
                    <div key="1" className="rise">
                      <Titre sous="Le prix dépend de la taille du véhicule, pas de son état.">
                        Quelle formule ?
                      </Titre>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {FORMULES.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            className="choice p-5"
                            aria-pressed={formuleId === f.id}
                            onClick={() => {
                              setFormuleId(f.id);
                              aller(2);
                            }}
                          >
                            <span className="eyebrow block text-xd-violet-deep">{f.court}</span>
                            <span className="mt-1.5 block text-lg font-semibold leading-tight text-xd-text">
                              {f.nom}
                            </span>
                            <span className="mt-1 block text-sm text-xd-text-3">{f.accroche}</span>
                            <span className="tabular mt-4 block text-2xl font-semibold text-xd-text">
                              {vehiculeId ? (
                                euros(prixFormule(f.id, vehiculeId))
                              ) : (
                                <>
                                  <span className="text-sm font-normal text-xd-text-3">dès </span>
                                  {euros(prixMinimum(f.id))}
                                </>
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {etape === 2 && (
                    <div key="2" className="rise">
                      <Titre sous="Un doute ? Choisissez la catégorie la plus proche, nous ajustons si besoin.">
                        Quel véhicule ?
                      </Titre>
                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        {VEHICULES.map((v) => {
                          const Icon = VEHICULE_ICON[v.id];
                          return (
                            <button
                              key={v.id}
                              type="button"
                              className="choice p-5"
                              aria-pressed={vehiculeId === v.id}
                              onClick={() => {
                                setVehiculeId(v.id);
                                setApercu(v.id);
                                aller(3);
                              }}
                            >
                              <Icon className="w-14 text-xd-text" />
                              <span className="mt-3 block text-base font-semibold text-xd-text">
                                {v.label}
                              </span>
                              <span className="mt-0.5 block text-xs text-xd-text-3">{v.exemples}</span>
                              {formuleId && (
                                <span className="tabular mt-3 block text-lg font-semibold text-xd-text">
                                  {euros(prixFormule(formuleId, v.id))}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <Navigation onRetour={() => aller(1)} />
                    </div>
                  )}

                  {etape === 3 && (
                    <div key="3" className="rise">
                      <Titre sous="Aucune n'est obligatoire. Elles s'ajoutent au prix de la formule.">
                        Des options ?
                      </Titre>
                      <div className="mt-5 space-y-5">
                        {CATEGORIES_OPTIONS.map((cat) => (
                          <div key={cat}>
                            <p className="eyebrow text-xd-text-4">{cat}</p>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              {OPTIONS.filter((o) => o.categorie === cat).map((o) => (
                                <label
                                  key={o.id}
                                  className="choice flex cursor-pointer items-center gap-3 px-4 py-3"
                                >
                                  <input
                                    type="checkbox"
                                    checked={optionIds.includes(o.id)}
                                    onChange={() => basculerOption(o.id)}
                                    className="size-4 shrink-0 accent-[#7b3cff]"
                                  />
                                  <span className="flex-1 text-sm text-xd-text">
                                    {o.nom}
                                    {"unite" in o ? (
                                      <span className="text-xd-text-4"> · {o.unite}</span>
                                    ) : null}
                                  </span>
                                  <span className="tabular text-sm font-medium text-xd-text">
                                    + {euros(o.prix)}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <Navigation
                        onRetour={() => aller(2)}
                        onSuite={() => aller(4)}
                        libelle={optionIds.length > 0 ? "Continuer" : "Continuer sans option"}
                      />
                    </div>
                  )}

                  {etape === 4 && (
                    <div key="4" className="rise">
                      <Titre sous="Nous venons chez vous ou sur votre lieu de travail, avec l'eau et le matériel. Prévoyez une place accessible.">
                        Où, et quand ?
                      </Titre>

                      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_8rem_1fr]">
                        <Champ label="Adresse" name="adresse" error={errors.adresse} className="sm:col-span-3">
                          <input
                            name="adresse"
                            value={champs.adresse}
                            onChange={(e) => maj("adresse", e.target.value)}
                            type="text"
                            autoComplete="street-address"
                            placeholder="12 rue des Lilas"
                            aria-invalid={Boolean(errors.adresse)}
                            aria-describedby={errors.adresse ? "err-adresse" : undefined}
                            className="field"
                          />
                        </Champ>
                        <Champ label="Code postal" name="codePostal" error={errors.codePostal}>
                          <input
                            name="codePostal"
                            value={champs.codePostal}
                            onChange={(e) => maj("codePostal", e.target.value)}
                            type="text"
                            inputMode="numeric"
                            autoComplete="postal-code"
                            placeholder="33000"
                            aria-invalid={Boolean(errors.codePostal)}
                            aria-describedby={errors.codePostal ? "err-codePostal" : undefined}
                            className="field"
                          />
                        </Champ>
                        <Champ label="Ville" name="ville" error={errors.ville} className="sm:col-span-2">
                          <input
                            name="ville"
                            value={champs.ville}
                            onChange={(e) => maj("ville", e.target.value)}
                            type="text"
                            autoComplete="address-level2"
                            placeholder="Bordeaux"
                            aria-invalid={Boolean(errors.ville)}
                            aria-describedby={errors.ville ? "err-ville" : undefined}
                            className="field"
                          />
                        </Champ>
                        <p className="text-xs text-xd-text-4 sm:col-span-3">
                          Un éventuel frais de déplacement, selon la distance, vous est
                          confirmé par téléphone.
                        </p>
                      </div>

                      {/* ── Le créneau ──────────────────────────────────────────── */}
                      <div className="mt-6">
                        <p className="text-sm font-medium text-xd-text-2">Le jour</p>

                        {dispo === null || (chargement && jours.length === 0) ? (
                          <p className="mt-2 text-sm text-xd-text-3" aria-live="polite">
                            Recherche des créneaux libres…
                          </p>
                        ) : "erreur" in dispo ? (
                          <p role="alert" className="mt-2 text-sm text-xd-danger">
                            {dispo.erreur}{" "}
                            <button
                              type="button"
                              onClick={chargerDispo}
                              className="font-medium underline underline-offset-2"
                            >
                              Réessayer
                            </button>
                          </p>
                        ) : (
                          <>
                            <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
                              {jours.map((j) => {
                                const actif = j.jour === champs.jour;
                                const complet = j.creneaux.every((c) => !c.disponible);
                                return (
                                  <button
                                    key={j.jour}
                                    type="button"
                                    aria-pressed={actif}
                                    disabled={complet}
                                    onClick={() => {
                                      setChamps((c) => ({ ...c, jour: j.jour, creneau: "" }));
                                      setErreurLocale(null);
                                    }}
                                    className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                      actif
                                        ? "bg-xd-violet text-white"
                                        : "hairline bg-white text-xd-text-2 hover:text-xd-text"
                                    }`}
                                  >
                                    {j.court}
                                    {complet && <span className="sr-only"> — complet</span>}
                                  </button>
                                );
                              })}
                            </div>

                            {jourChoisi && (
                              <div className="rise mt-4">
                                <p className="text-sm font-medium text-xd-text-2">
                                  L&apos;heure, le {jourChoisi.libelle}
                                </p>
                                <div className="mt-1.5 grid grid-cols-3 gap-2">
                                  {jourChoisi.creneaux.map((c) => (
                                    <button
                                      key={c.heure}
                                      type="button"
                                      disabled={!c.disponible}
                                      aria-pressed={champs.creneau === c.heure}
                                      onClick={() => {
                                        maj("creneau", c.heure);
                                        setErreurLocale(null);
                                      }}
                                      className="choice px-2 py-3 text-center text-sm text-xd-text disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      <span className="block font-medium">{c.libelle}</span>
                                      <span className="block text-xs text-xd-text-4">
                                        {c.disponible ? "libre" : "déjà pris"}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {(errors.jour || errors.creneau) && (
                          <p role="alert" className="mt-2 text-sm text-xd-danger">
                            {errors.creneau ?? errors.jour}
                          </p>
                        )}
                      </div>

                      <Champ
                        label="Précisions"
                        name="precisions"
                        error={errors.precisions}
                        facultatif
                        className="mt-5"
                      >
                        <textarea
                          name="precisions"
                          value={champs.precisions}
                          onChange={(e) => maj("precisions", e.target.value)}
                          rows={3}
                          placeholder="Parking, accès, état particulier du véhicule…"
                          className="field resize-y"
                        />
                      </Champ>

                      {erreurLocale && (
                        <p role="alert" className="mt-4 text-sm text-xd-danger">
                          {erreurLocale}
                        </p>
                      )}

                      <Navigation onRetour={() => aller(3)} onSuite={validerLieu} />
                    </div>
                  )}

                  {etape === 5 && (
                    <div key="5" className="rise">
                      <Titre sous="Nous vous rappelons pour confirmer les détails.">
                        Vos coordonnées
                      </Titre>

                      {formuleId && vehiculeId ? (
                        <dl className="mt-5 grid gap-x-6 gap-y-2 rounded-xd-md bg-xd-bg-2 p-4 text-sm sm:grid-cols-[auto_1fr]">
                          <dt className="text-xd-text-3">Créneau</dt>
                          <dd className="font-medium text-xd-text">
                            {libelleCreneauChoisi ?? `${champs.jour} ${champs.creneau}`}
                          </dd>
                          <dt className="text-xd-text-3">Formule</dt>
                          <dd className="tabular text-xd-text">
                            {formule(formuleId).nom} · {vehicule(vehiculeId).label} ·{" "}
                            {euros(prixFormule(formuleId, vehiculeId))}
                          </dd>
                          <dt className="text-xd-text-3">Options</dt>
                          <dd className="tabular text-xd-text">
                            {optionIds.length > 0
                              ? optionIds
                                  .map((id) => `${option(id).nom} (+${euros(option(id).prix)})`)
                                  .join(", ")
                              : "aucune"}
                          </dd>
                          <dt className="text-xd-text-3">Adresse</dt>
                          <dd className="text-xd-text">
                            {champs.adresse}, {champs.codePostal} {champs.ville}
                          </dd>
                          <dt className="text-xd-text-3">Total</dt>
                          <dd className="tabular font-semibold text-xd-text">
                            {total !== null ? euros(total) : "—"}{" "}
                            <span className="font-normal text-xd-text-4">TTC</span>
                          </dd>
                        </dl>
                      ) : (
                        <p className="mt-5 text-sm text-xd-text-3">
                          Commencez par choisir une formule et un véhicule.
                        </p>
                      )}

                      {state.status === "error" && state.message && (
                        <p
                          role="alert"
                          className="mt-5 rounded-xd-sm bg-xd-danger-pale px-4 py-3 text-sm text-xd-danger"
                        >
                          {state.message}
                        </p>
                      )}

                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <Champ label="Prénom" name="prenom" error={errors.prenom}>
                          <input
                            name="prenom"
                            value={champs.prenom}
                            onChange={(e) => maj("prenom", e.target.value)}
                            type="text"
                            autoComplete="given-name"
                            aria-invalid={Boolean(errors.prenom)}
                            aria-describedby={errors.prenom ? "err-prenom" : undefined}
                            className="field"
                          />
                        </Champ>
                        <Champ label="Nom" name="nom" error={errors.nom}>
                          <input
                            name="nom"
                            value={champs.nom}
                            onChange={(e) => maj("nom", e.target.value)}
                            type="text"
                            autoComplete="family-name"
                            aria-invalid={Boolean(errors.nom)}
                            aria-describedby={errors.nom ? "err-nom" : undefined}
                            className="field"
                          />
                        </Champ>
                        <Champ label="Téléphone" name="telephone" error={errors.telephone}>
                          <input
                            name="telephone"
                            value={champs.telephone}
                            onChange={(e) => maj("telephone", e.target.value)}
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="06 12 34 56 78"
                            aria-invalid={Boolean(errors.telephone)}
                            aria-describedby={errors.telephone ? "err-telephone" : undefined}
                            className="field"
                          />
                        </Champ>
                        <Champ label="E-mail" name="email" error={errors.email}>
                          <input
                            name="email"
                            value={champs.email}
                            onChange={(e) => maj("email", e.target.value)}
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            aria-invalid={Boolean(errors.email)}
                            aria-describedby={errors.email ? "err-email" : undefined}
                            className="field"
                          />
                        </Champ>
                      </div>

                      <Champ
                        label="Message"
                        name="message"
                        error={errors.message}
                        facultatif
                        className="mt-4"
                      >
                        <textarea
                          name="message"
                          value={champs.message}
                          onChange={(e) => maj("message", e.target.value)}
                          rows={3}
                          placeholder="Une question, une demande particulière…"
                          className="field resize-y"
                        />
                      </Champ>

                      <label className="mt-5 flex cursor-pointer gap-3">
                        <input
                          type="checkbox"
                          name="consent"
                          checked={champs.consent}
                          onChange={(e) => maj("consent", e.target.checked)}
                          aria-invalid={Boolean(errors.consent)}
                          aria-describedby={errors.consent ? "err-consent" : undefined}
                          className="mt-1 size-4 shrink-0 accent-[#7b3cff]"
                        />
                        <span className="text-sm leading-relaxed text-xd-text-3">
                          J&apos;accepte que {BUSINESS.name} utilise ces informations pour
                          traiter ma réservation et me recontacter.
                        </span>
                      </label>
                      {errors.consent && (
                        <p id="err-consent" className="mt-1.5 text-sm text-xd-danger">
                          {errors.consent}
                        </p>
                      )}

                      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <button type="button" onClick={() => aller(4)} className="btn btn-secondary">
                          Retour
                        </button>
                        <button type="submit" disabled={pending} className="btn btn-primary">
                          {pending ? "Réservation…" : "Réserver ce créneau"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Le récapitulatif, toujours sous les yeux. */}
                <div className="hairline-t flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-xd-bg-2 px-5 py-4 sm:px-8">
                  <p className="text-sm text-xd-text-3">
                    {formuleId ? (
                      <>
                        <span className="font-medium text-xd-text">{formule(formuleId).court}</span>
                        {vehiculeId && <> · {vehicule(vehiculeId).label}</>}
                        {optionIds.length > 0 && (
                          <>
                            {" "}
                            · {optionIds.length} option{optionIds.length > 1 ? "s" : ""}
                          </>
                        )}
                        {libelleCreneauChoisi && <> · {libelleCreneauChoisi}</>}
                      </>
                    ) : (
                      "Choisissez une formule pour voir le tarif."
                    )}
                  </p>
                  {total !== null && (
                    <p className="tabular text-xl font-semibold text-xd-text">
                      {euros(total)}
                      <span className="ml-1.5 text-xs font-normal text-xd-text-4">TTC</span>
                    </p>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      <Offres
        vehiculeAffiche={vehiculeAffiche}
        onVehicule={choisirApercu}
        onChoisir={choisirDepuisCarte}
      />
    </>
  );
}

/* ── Les formules et les options, sous le formulaire ───────────────────────── */

function Offres({
  vehiculeAffiche,
  onVehicule,
  onChoisir,
}: {
  vehiculeAffiche: VehiculeId;
  onVehicule: (id: VehiculeId) => void;
  onChoisir: (id: FormuleId) => void;
}) {
  return (
    <section id="formules" className="scroll-mt-20 border-t border-black/[0.07] bg-xd-bg-2">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <h2 className="text-center text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-xd-text sm:text-[2.2rem]">
          Deux formules, un prix ferme.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-center text-xd-text-3">
          L&apos;intérieur, ou l&apos;intérieur et la carrosserie. Le prix dépend de la taille
          du véhicule, pas de son état.
        </p>

        <div
          role="group"
          aria-label="Type de véhicule"
          className="mt-8 flex flex-wrap justify-center gap-2"
        >
          {VEHICULES.map((v) => {
            const Icon = VEHICULE_ICON[v.id];
            const actif = v.id === vehiculeAffiche;
            return (
              <button
                key={v.id}
                type="button"
                aria-pressed={actif}
                onClick={() => onVehicule(v.id)}
                className={`flex items-center gap-2 rounded-full py-2 pl-2.5 pr-4 text-sm font-medium transition-colors ${
                  actif
                    ? "bg-xd-violet text-white"
                    : "hairline bg-white text-xd-text-3 hover:text-xd-text"
                }`}
              >
                <Icon className="w-7 shrink-0" />
                {v.label}
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {FORMULES.map((f) => {
            const signature = f.id === "complete";
            return (
              <article
                key={f.id}
                className={`card flex flex-col rounded-xd-xl p-6 sm:p-7 ${
                  signature ? "ring-1 ring-xd-violet/30" : ""
                }`}
              >
                <p className="eyebrow text-xd-violet-deep">{f.court}</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-xd-text">{f.nom}</h3>
                <p className="tabular mt-4 text-[2.5rem] font-semibold leading-none tracking-[-0.03em] text-xd-text">
                  {euros(f.prix[vehiculeAffiche])}
                </p>
                <p className="mt-2 text-sm text-xd-text-3">
                  {vehicule(vehiculeAffiche).label} · TTC
                </p>
                <p className="mt-4 leading-relaxed text-xd-text-2">{f.accroche}</p>

                <ul className="hairline-t mt-5 space-y-2.5 pt-5">
                  {f.inclus.map((item) => (
                    <li key={item} className="flex gap-3 text-sm text-xd-text-2">
                      <span
                        aria-hidden
                        className="mt-[7px] size-1 shrink-0 rounded-full bg-xd-violet-deep"
                      />
                      {item}
                    </li>
                  ))}
                </ul>

                {f.note && <p className="mt-4 text-xs text-xd-text-4">{f.note}</p>}

                <button
                  type="button"
                  onClick={() => onChoisir(f.id)}
                  className={`btn mt-7 ${signature ? "btn-primary" : "btn-secondary"}`}
                >
                  Choisir cette formule
                </button>
              </article>
            );
          })}
        </div>

        <div className="mt-14">
          <h3 className="text-center text-xl font-semibold tracking-tight text-xd-text">
            Les options
          </h3>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-xd-text-3">
            À ajouter à l&apos;une ou l&apos;autre formule, selon l&apos;état du véhicule.
            Elles se cochent dans le formulaire.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORIES_OPTIONS.map((cat) => (
              <div key={cat} className="card rounded-xd-lg p-5">
                <p className="eyebrow text-xd-text-4">{cat}</p>
                <ul className="mt-3 space-y-2.5">
                  {OPTIONS.filter((o) => o.categorie === cat).map((o) => (
                    <li key={o.id} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-xd-text-2">
                        {o.nom}
                        {"unite" in o ? <span className="text-xd-text-4"> · {o.unite}</span> : null}
                      </span>
                      <span className="tabular shrink-0 font-medium text-xd-text">
                        + {euros(o.prix)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Briques ───────────────────────────────────────────────────────────────── */

function Stepper({
  etape,
  atteinte,
  onGo,
}: {
  etape: Etape;
  atteinte: Etape;
  onGo: (e: Etape) => void;
}) {
  return (
    <ol className="flex items-center px-5 pt-5 sm:px-8 sm:pt-7" aria-label="Étapes de la réservation">
      {ETAPES.map((label, i) => {
        const n = (i + 1) as Etape;
        const faite = n < etape;
        const courante = n === etape;
        const accessible = n <= atteinte && !courante;
        const derniere = i === ETAPES.length - 1;
        return (
          <li key={label} className={`flex items-center ${derniere ? "" : "flex-1"}`}>
            <button
              type="button"
              onClick={() => onGo(n)}
              disabled={!accessible}
              aria-current={courante ? "step" : undefined}
              className={`flex items-center gap-2 rounded-full ${
                accessible ? "cursor-pointer" : "cursor-default"
              }`}
            >
              <span
                className={`tabular flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  courante
                    ? "bg-xd-violet text-white"
                    : faite
                      ? "bg-xd-violet-pale text-xd-violet-deep"
                      : "bg-xd-bg-3 text-xd-text-4"
                }`}
              >
                {faite ? <Check className="size-3.5" /> : n}
              </span>
              <span
                className={`text-sm ${
                  courante ? "font-medium text-xd-text" : "hidden text-xd-text-3 md:inline"
                }`}
              >
                {label}
              </span>
            </button>
            {!derniere && (
              <span
                aria-hidden
                className={`mx-2 h-px flex-1 ${faite ? "bg-xd-violet/40" : "bg-black/[0.08]"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Titre({ children, sous }: { children: ReactNode; sous?: string }) {
  return (
    <div>
      <h3 className="text-xl font-semibold tracking-tight text-xd-text">{children}</h3>
      {sous && <p className="mt-1 text-sm text-xd-text-3">{sous}</p>}
    </div>
  );
}

function Navigation({
  onRetour,
  onSuite,
  libelle = "Continuer",
}: {
  onRetour: () => void;
  onSuite?: () => void;
  libelle?: string;
}) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      <button type="button" onClick={onRetour} className="btn btn-secondary">
        Retour
      </button>
      {onSuite && (
        <button type="button" onClick={onSuite} className="btn btn-primary">
          {libelle}
        </button>
      )}
    </div>
  );
}

function Champ({
  label,
  name,
  error,
  facultatif,
  className = "",
  children,
}: {
  label: string;
  name: string;
  error?: string;
  facultatif?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium text-xd-text-2">
        {label}
        {facultatif && <span className="font-normal text-xd-text-4"> (facultatif)</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {error && (
        <p id={`err-${name}`} className="mt-1.5 text-sm text-xd-danger">
          {error}
        </p>
      )}
    </label>
  );
}

function Check({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}
