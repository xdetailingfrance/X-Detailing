"use client";

import { useEffect, useRef, useState } from "react";
import Studio from "./voiture/Studio";
import Voiture from "./voiture/Voiture";
import Utilitaire from "./voiture/Utilitaire";
import Agent from "./voiture/Agent";
import type { OptionPublique, PrestationPublique } from "@/lib/prestationsPubliques";
import { dateParis, decalerJour, formatParis, jourParis, jourSemaineParis } from "@/lib/heure";

// Parcours de réservation immersif de la page d'accueil.
//
// 1 Prestation (cartes de la page) → 2 Véhicule → 3 Options → 4 Créneau →
// 5 Coordonnées → 6 Confirmation. L'utilitaire de service X Detailing
// accompagne le client : il traverse l'écran au choix de la prestation,
// roule d'étape en étape sur la route de progression, arrive devant le
// domicile avant les coordonnées. La scène finale (voiture propre, agent
// qui remercie) ne s'affiche qu'après l'enregistrement RÉEL de la
// réservation par /api/reservation.
//
// Les animations ne bloquent jamais : un appui les passe, elles sont
// ignorées si l'appareil demande moins d'animations, et toutes les
// saisies sont conservées quand on revient en arrière.

type Etape = 2 | 3 | 4 | 5 | 6;
type Transition = "depart" | "domicile" | "final" | null;

const ETAPES = [
  { n: 1, libelle: "Prestation" },
  { n: 2, libelle: "Véhicule" },
  { n: 3, libelle: "Options" },
  { n: 4, libelle: "Créneau" },
  { n: 5, libelle: "Coordonnées" },
  { n: 6, libelle: "Confirmation" },
] as const;

const DUREE_TRANSITION: Record<Exclude<Transition, null>, number> = { depart: 1600, domicile: 1900, final: 2600};

const CATEGORIES: Record<string, { libelle: string; exemple: string }> = {
  CITADINE: { libelle: "Citadine", exemple: "Clio, 208, Polo…" },
  BERLINE: { libelle: "Berline", exemple: "308, Golf, Série 3…" },
  SUV: { libelle: "SUV", exemple: "3008, Tiguan, X1…" },
  MONOSPACE: { libelle: "Monospace", exemple: "Scénic, Touran…" },
  UTILITAIRE: { libelle: "Utilitaire", exemple: "Kangoo, Trafic…" },
};

const CHAMPS_VIDES = {
  prenom: "",
  nom: "",
  telephone: "",
  email: "",
  adresse: "",
  codePostal: "",
  ville: "",
  marque: "",
  modele: "",
  precisions: "",
};
type Coordonnees = typeof CHAMPS_VIDES;

type Confirmation = {
  reference: string;
  prestation: string;
  options: string[];
  quand: string;
  adresse: string;
  prixTotal: number;
  acompte: number;
  // Acompte réellement payé (validé par Stripe côté serveur).
  paye: boolean;
  smsEnvoye: boolean;
};

type RetourPaiement = { confirmation: Confirmation; prenom: string };

const euros = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

// Jours à venir en heure de Paris (là où X Detailing intervient), quel que
// soit le fuseau de l'appareil du client.
function prochainsJours(n: number) {
  const jours: { iso: string; jour: string; date: string }[] = [];
  const aujourdhui = jourParis(new Date());
  for (let i = 0; i < n; i++) {
    const iso = decalerJour(aujourdhui, i);
    const midi = dateParis(iso, "12:00");
    // Fermé le dimanche : le jour n'est pas proposé.
    if (jourSemaineParis(midi) === 0) continue;
    jours.push({
      iso,
      jour: i === 0 ? "Auj." : i === 1 ? "Demain" : formatParis(midi, { weekday: "short" }),
        date: formatParis(midi, { day: "numeric", month: "short" }),
      });
    }
    return jours;
}

function mouvementReduit() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function ExperiencePrestations({
  prestations,
  options,
  paiementEnLigne,
}: {
  prestations: PrestationPublique[];
  options: OptionPublique[];
  paiementEnLigne: boolean;
}) {
  const [choix, setChoix] = useState<PrestationPublique | null>(null);
  const [depart, setDepart] = useState<DOMRect | null>(null);
  const [retour, setRetour] = useState<RetourPaiement | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Retour de Stripe Checkout : le serveur relit la session chez Stripe ;
  // la scène finale ne s'ouvre que si le paiement est réellement validé.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const issue = params.get("paiement");
    const sessionId = params.get("session_id");
    if (!issue || !sessionId) return;
    history.replaceState(null, "", window.location.pathname);
    const annuler = issue === "annule" ? "&annuler=1" : "";
    fetch(`/api/reservation/paiement?session_id=${encodeURIComponent(sessionId)}${annuler}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.paye) {
          const prestation = prestations.find((p) => p.packId === d.packId) ?? prestations[0];
          setRetour({ confirmation: d.confirmation, prenom: d.prenom });
          setChoix(prestation);
        } else if (issue === "annule") {
          setMessage("Paiement annulé : votre créneau a été libéré. Vous pouvez recommencer quand vous voulez.");
        } else {
          setMessage("Le paiement n'a pas été validé : aucune réservation n'est confirmée. Vous pouvez réessayer.");
        }
      })
      .catch(() => setMessage("Impossible de vérifier le paiement pour le moment. Contactez-nous si vous avez étédébité."));
  }, [prestations]);

    return (
      <>
        <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
          {prestations.map((p, i) => (
            <CartePrestation
              key={p.packId}
              prestation={p}
              index={i}
              onChoisir={(rect) => {
                setDepart(rect);
                setChoix(p);
              }}
            />
          ))}
        </div>
        {message && (
          <div className="pr-message" role="status">
            <p>{message}</p>
            <button type="button" onClick={() => setMessage(null)} aria-label="Fermer">
              ✕
            </button>
          </div>
        )}
        {choix && (
          <Parcours
            key={choix.packId}
            prestation={choix}
            options={options}
            depart={depart}
            paiementEnLigne={paiementEnLigne}
            retourPaiement={retour}
            onFermer={() => {
              setChoix(null);
              setRetour(null);
            }}
          />
        )}
      </>
    );
}

function CartePrestation({
  prestation,
  index,
  onChoisir,
}: {
  prestation: PrestationPublique;
  index: number;
  onChoisir: (rect: DOMRect) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const prix = prestation.tarifs.map((t) => t.prix);
  return (
    <button
      ref={ref}
      type="button"
      className="carte-prestation entree"
      style={{ ["--delai" as string]: `${1500 + index * 160}ms` }}
      onClick={() => ref.current && onChoisir(ref.current.getBoundingClientRect())}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--px", String((e.clientX - r.left) / r.width));
        e.currentTarget.style.setProperty("--py", String((e.clientY - r.top) / r.height));
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- calque du logo officiel, en filigrane */}
      <img className="carte-filigrane" src="/marque/x-640.webp" alt="" aria-hidden="true" />
      <span className="carte-lumiere" aria-hidden="true" />
      <span className="relative flex h-full flex-col justify-between gap-10 p-6 sm:p-8">
        <span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[var(--violet-vif)]">
            {prestation.duree}
          </span>
          <span className="mt-3 block text-2xl font-semibold uppercase tracking-[0.06em] text-[var(--encre)] sm:text-3xl">
            {prestation.titre}
          </span>
          <span className="mt-3 block max-w-sm text-sm leading-relaxed text-[var(--chrome)]/65">{prestation.accroche}</span>
        </span>
        <span className="flex items-end justify-between gap-4">
          {prix.length > 0 && (
            <span className="text-sm text-[var(--chrome)]/65">
              à partir de
              <span className="block text-4xl font-semibold text-[var(--encre)]">{euros(Math.min(...prix))}</span>
            </span>
          )}
          <span className="carte-cta">Réserver →</span>
        </span>
      </span>
    </button>
  );
}

function Parcours({
  prestation,
  options,
  depart,
  paiementEnLigne,
  retourPaiement,
  onFermer,
}: {
  prestation: PrestationPublique;
  options: OptionPublique[];
  depart: DOMRect | null;
  paiementEnLigne: boolean;
  retourPaiement: RetourPaiement | null;
  onFermer: () => void;
}) {
  const [reduit] = useState(mouvementReduit);
  const [etape, setEtape] = useState<Etape>(retourPaiement ? 6 : 2);
  const [sens, setSens] = useState<"avance" | "recule">("avance");
  const [transition, setTransition] = useState<Transition>(reduit ? null : retourPaiement ? "final" : "depart");
  const [categorie, setCategorie] = useState<string | null>(null);
  const [choixOptions, setChoixOptions] = useState<string[]>([]);
  const [jour, setJour] = useState<string | null>(null);
  const [heure, setHeure] = useState<string | null>(null);
  const [coordonnees, setCoordonnees] = useState<Coordonnees>(
    retourPaiement ? { ...CHAMPS_VIDES, prenom: retourPaiement.prenom } : CHAMPS_VIDES
  );
  const [confirmation, setConfirmation] = useState<Confirmation | null>(retourPaiement?.confirmation ?? null);
  const racineRef = useRef<HTMLDivElement>(null);
  const contenuRef = useRef<HTMLDivElement>(null);
  const titreRef = useRef<HTMLHeadingElement>(null);

  // Ouverture : la carte choisie s'agrandit jusqu'au plein écran.
  useEffect(() => {
    const declencheur = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const racine = racineRef.current;
    if (racine && depart && !reduit) {
      const { innerWidth: l, innerHeight: h } = window;
      racine.animate(
        [
          { clipPath: `inset(${depart.top}px ${l - depart.right}px ${h - depart.bottom}px ${depart.left}px round24px)` },
          { clipPath: "inset(0px 0px 0px 0px round 0px)" },
        ],
        { duration: 600, easing: "cubic-bezier(0.65, 0, 0.25, 1)" }
      );
    }
    return () => {
      document.body.style.overflow = "";
      declencheur?.focus?.();
    };
  }, [depart, reduit]);

   // Fin automatique des grandes transitions.
   useEffect(() => {
     if (!transition) return;
     const minuteur = window.setTimeout(() => setTransition(null), DUREE_TRANSITION[transition]);
     return () => clearTimeout(minuteur);
   }, [transition]);

   // Chaque étape repart du haut (le formulaire précédent peut être long).
   useEffect(() => {
     contenuRef.current?.scrollTo({ top: 0 });
   }, [etape]);

   useEffect(() => {
     if (!transition) titreRef.current?.focus({ preventScroll: true });
   }, [etape, transition]);

   useEffect(() => {
     const touche = (e: KeyboardEvent) => {
       if (e.key === "Escape") onFermer();
     };
     window.addEventListener("keydown", touche);
     return () => window.removeEventListener("keydown", touche);
   }, [onFermer]);

   const tarif = prestation.tarifs.find((t) => t.categorie === categorie) ?? null;
   // Une option à l'unité (ex. par siège) figure autant de fois que la
   // quantité choisie dans choixOptions.
   const quantite = (id: string) => choixOptions.filter((x) => x === id).length;
   const optionsChoisies = options
     .filter((o) => choixOptions.includes(o.id))
     .map((o) => ({ ...o, quantite: quantite(o.id) }));
   const total = (tarif?.prix ?? 0) + optionsChoisies.reduce((s, o) => s + o.prix * o.quantite, 0);
   const groupes = [...new Set(options.map((o) => o.groupe))];
   const changerQuantite = (id: string, n: number) =>
     setChoixOptions((actuelles) => [...actuelles.filter((x) => x !== id), ...Array<string>(n).fill(id)]);

   const allerA = (suivante: Etape, grandeTransition: Transition = null) => {
     setSens(suivante > etape ? "avance" : "recule");
     setEtape(suivante);
     if (grandeTransition && !reduit) setTransition(grandeTransition);
   };
   const retour = () => allerA((etape - 1) as Etape);

  const quand =
    jour && heure
      ? formatParis(dateParis(jour, heure), { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
      : null;

  return (
    <div
      ref={racineRef}
      className="pr"
      data-etape={etape}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pr-titre"
    >
      <div className="pr-barre">
        {etape > 2 && etape < 6 ? (
          <button type="button" onClick={retour} className="pr-rond" aria-label="Étape précédente">
            ←
          </button>
        ) : (
          <span className="w-10 flex-none" />
        )}
        <p className="min-w-0 flex-1 truncate text-center text-xs font-semibold uppercase tracking-[0.25em] text-[var(--chrome)]/80">
          {prestation.titre}
        </p>
        <button type="button" onClick={onFermer} className="pr-rond" aria-label="Fermer">
          ✕
        </button>
      </div>

            <Route etape={etape} sens={sens} />

            <div className="pr-contenu" ref={contenuRef}>
              {etape === 6 && confirmation && (
                <div className="pr-scene-finale" aria-hidden="true">
                  <Studio>
                    <div className="pr-finale-voiture">
                      <Voiture id="voiture-finale" className="balaye-boucle phares-allumes brillante" />
                    </div>
                    <span className="pr-etincelle" style={{ left: "30%", top: "58%" }} />
                    <span className="pr-etincelle" style={{ left: "52%", top: "50%", animationDelay: "0.5s" }} />
                    <span className="pr-etincelle" style={{ left: "68%", top: "62%", animationDelay: "1s" }} />
                    <div className="pr-agent">
                      <Agent />
                      <p className="pr-bulle">
                        Merci{coordonnees.prenom ? `, ${coordonnees.prenom}` : ""} !
                      </p>
                    </div>
                  </Studio>
                </div>
              )}

             <section className="pr-panneau" key={etape} data-sens={sens}>
               <p className="pr-sur-titre">
                 Étape {etape}/6 · {ETAPES[etape - 1].libelle}
               </p>

               {etape === 2 && (
                 <>
                   <h2 id="pr-titre" ref={titreRef} tabIndex={-1} className="pr-titre">
                     Quel est votre véhicule ?
                   </h2>
                   <div className="mt-5 grid gap-3">
                     {prestation.tarifs.map((t) => (
                       <button
                         key={t.categorie}
                         type="button"
                         aria-pressed={categorie === t.categorie}
                         className={`pr-choix ${categorie === t.categorie ? "choisi" : ""}`}
                         onClick={() => {
                           setCategorie(t.categorie);
                           window.setTimeout(() => allerA(3), reduit ? 0 : 280);
                     }}
                 >
                    <span>
                      <span className="block font-semibold text-[var(--encre)]">{CATEGORIES[t.categorie]?.libelle?? t.categorie}</span>
                      <span className="block text-xs text-[var(--chrome)]/60">{CATEGORIES[t.categorie]?.exemple}</span>
                    </span>
                    <span className="text-lg font-semibold text-[var(--encre)]">{euros(t.prix)}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {etape === 3 && tarif && (
            <>
              <h2 id="pr-titre" ref={titreRef} tabIndex={-1} className="pr-titre">
                Des options ?
              </h2>
              <div className="mt-5 grid gap-3">
                {options.length === 0 && <p className="text-sm text-[var(--chrome)]/60">Aucune option disponiblepour le moment.</p>}
                {groupes.map((groupe) => (
                  <div key={groupe ?? "autres"} className="grid gap-3">
                    {groupe && <p className="pr-groupe">{groupe}</p>}
                    {options
                      .filter((o) => o.groupe === groupe)
                      .map((o) => {
                        const n = quantite(o.id);
                        const coche = n > 0;
                        return (
                          <div key={o.id} className={`pr-choix pr-option ${coche ? "choisi" : ""}`}>
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={coche}
                              className="pr-option-bascule"
                              onClick={() => changerQuantite(o.id, coche ? 0 : 1)}
                            >
                              <span className="flex items-center gap-3 text-left">
                                <span className={`pr-case ${coche ? "cochee" : ""}`} aria-hidden="true" />
                                <span className="font-semibold text-[var(--encre)]">
                                  {o.nom}
                                  {o.unite && <span className="font-normal text-[var(--chrome)]/60"> · par {o.unite}</span>}
                                </span>
                              </span>
                              <span className="shrink-0 font-semibold text-[var(--encre)]">+ {euros(o.prix)}</span>
                            </button>
                            {coche && o.quantiteMax > 1 && (
                              <div className="pr-quantite">
                                <button
                                  type="button"
                                  aria-label={`Un ${o.unite ?? "élément"} de moins`}
                                  onClick={() => changerQuantite(o.id, n - 1)}
                                >
                                  −
                                </button>
                                <span aria-live="polite">
                                  {n} {o.unite}
                                  {n > 1 ? "s" : ""}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`Un ${o.unite ?? "élément"} de plus`}
                                  disabled={n >= o.quantiteMax}
                                  onClick={() => changerQuantite(o.id, n + 1)}
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ))}
                </div>
                <Recapitulatif prestation={prestation} tarif={tarif} options={optionsChoisies} total={total} />
                <button type="button" className="pr-principal mt-5" onClick={() => allerA(4)}>
                  {optionsChoisies.length ? "Continuer" : "Continuer sans option"}
                </button>
              </>
            )}

            {etape === 4 && (
              <EtapeCreneau
                titreRef={titreRef}
                packId={prestation.packId}
                jour={jour}
                heure={heure}
                onJour={(j) => {
                  setJour(j);
                  setHeure(null);
                }}
                onHeure={(h, j) => {
                  // Le jour affiché par défaut n'a pas forcément été cliqué.
                  setJour(j);
                  setHeure(h);
                  allerA(5, "domicile");
                }}
              />
            )}

          {etape === 5 && tarif && jour && heure && (
            <EtapeCoordonnees
              titreRef={titreRef}
              valeurs={coordonnees}
              onChange={setCoordonnees}
              recap={
                <Recapitulatif prestation={prestation} tarif={tarif} options={optionsChoisies} total={total} quand={quand} compact />
              }
              envoi={{ packId: prestation.packId, categorie: tarif.categorie, optionIds: choixOptions, jour, heure }}
              paiementEnLigne={paiementEnLigne}
              acompte={Math.round(total * 10) / 100}
              onCreneauPris={() => {
                setHeure(null);
                allerA(4);
              }}
              onConfirme={(c) => {
                setConfirmation(c);
                allerA(6, "final");
              }}
            />
          )}

          {etape === 6 && confirmation && (
            <div className="pr-confirmation">
              <h2 id="pr-titre" ref={titreRef} tabIndex={-1} className="pr-titre">
                {confirmation.paye ? "Réservation confirmée" : "Réservation enregistrée"}
              </h2>
              <p className="mt-2 text-sm text-[var(--chrome)]/75">
                Référence <span className="font-semibold tracking-[0.15em] text-[var(--encre)]">{confirmation.reference}</span>
              </p>
              <dl className="mt-5 grid gap-2 text-sm">
                <Info terme="Prestation" valeur={[confirmation.prestation, ...confirmation.options].join(" + ")}/>
                <Info terme="Rendez-vous" valeur={confirmation.quand} majuscule />
                <Info terme="Adresse" valeur={confirmation.adresse} />
                <Info terme="Prix" valeur={`${euros(confirmation.prixTotal)} · acompte 10 % : ${euros(confirmation.acompte)}`} />
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-[var(--chrome)]/60">
                {confirmation.paye ? (
                  <>
                    Acompte de {euros(confirmation.acompte)} payé par carte (Stripe). Le solde de{" "}
                    {euros(Math.round((confirmation.prixTotal - confirmation.acompte) * 100) / 100)} se règle à la fin de
                    la prestation. Vous recevez la confirmation par SMS.
                  </>
                ) : (
                  <>
                    {confirmation.smsEnvoye ? "Un SMS de confirmation vient de vous être envoyé. " : ""}
                         Aucun paiement n&apos;a été effectué en ligne : X Detailing vous recontacte pour confirmer votre
                          opérateur et le règlement de l&apos;acompte.
                        </>
                      )}
                    </p>
                    <button type="button" className="pr-principal mt-6" onClick={onFermer}>
                      Terminer
                    </button>
                  </div>
                )}
              </section>
            </div>

            {(etape === 3 || etape === 4) && tarif && (
              <div className="pr-total" aria-live="polite">
                <span className="text-xs uppercase tracking-[0.2em] text-[var(--chrome)]/60">Total</span>
                <span key={total} className="pr-total-montant">
                  {euros(total)}
                </span>
              </div>
            )}

        {transition && (
          <button
            type="button"
            className={`pr-transition pr-transition--${transition}`}
            onClick={() => setTransition(null)}
            aria-label="Passer l'animation"
          >
            {transition === "domicile" ? (
              <Studio className="avec-domicile">
                <div className="pr-van-domicile">
                  <Utilitaire className="roule" />
                </div>
              </Studio>
            ) : transition === "final" ? (
              <Studio>
                <div className="pr-final-logo">
                  {/* eslint-disable-next-line @next/next/no-img-element -- calque du logo officiel */}
                  <img src="/marque/x-640.webp" alt="" />
                </div>
              </Studio>
            ) : (
              <>
                <span className="pr-vitesse" />
                <div className="pr-van-traverse">
                  <Utilitaire className="roule" />
                </div>
              </>
            )}
          </button>
        )}
      </div>
    );
}

// Route de progression : l'utilitaire roule jusqu'à l'étape en cours.
function Route({ etape, sens }: { etape: number; sens: "avance" | "recule" }) {
  const [roule, setRoule] = useState(false);
  const precedente = useRef(etape);
  useEffect(() => {
    if (precedente.current === etape) return;
    precedente.current = etape;
    const debut = window.setTimeout(() => setRoule(true), 0);
    const fin = window.setTimeout(() => setRoule(false), 900);
    return () => {
      clearTimeout(debut);
      clearTimeout(fin);
    };
  }, [etape]);
  const progression = (etape - 1) / (ETAPES.length - 1);
  return (
    <div className="pr-route" aria-label={`Étape ${etape} sur 6`}>
      <div className="pr-route-piste">
        <span className="pr-route-faite" style={{ width: `${progression * 100}%` }} />
        {ETAPES.map((e) => (
          <span
            key={e.n}
                className={`pr-route-borne ${e.n < etape ? "faite" : e.n === etape ? "en-cours" : ""}`}
                style={{ left: `${((e.n - 1) / (ETAPES.length - 1)) * 100}%` }}
            >
              <span className="pr-route-libelle">{e.libelle}</span>
            </span>
          ))}
          <span className="pr-route-van" style={{ left: `${progression * 100}%` }} data-sens={sens}>
            <Utilitaire className={roule ? "roule" : ""} />
          </span>
        </div>
      </div>
    );
}

function Recapitulatif({
  prestation,
  tarif,
  options,
  total,
  quand,
  compact,
}: {
  prestation: PrestationPublique;
  tarif: { categorie: string; prix: number };
  options: (OptionPublique & { quantite: number })[];
  total: number;
  quand?: string | null;
  compact?: boolean;
}) {
  return (
    <div className={`pr-recap ${compact ? "compact" : ""}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--chrome)]/55">Votre commande</p>
      <ul className="mt-3 grid gap-1.5 text-sm">
        <li className="flex justify-between gap-4">
          <span>
            {prestation.titre} · {CATEGORIES[tarif.categorie]?.libelle ?? tarif.categorie}
          </span>
          <span className="text-[var(--encre)]">{euros(tarif.prix)}</span>
        </li>
        {options.map((o) => (
          <li key={o.id} className="pr-recap-option flex justify-between gap-4">
            <span>
              {o.nom}
              {o.quantite > 1 ? ` × ${o.quantite}` : ""}
            </span>
            <span className="text-[var(--encre)]">+ {euros(o.prix * o.quantite)}</span>
          </li>
        ))}
        {quand && (
          <li className="text-[var(--chrome)]/70 first-letter:uppercase">{quand}</li>
        )}
      </ul>
      <div className="mt-3 flex items-baseline justify-between border-t border-[var(--encre)]/10 pt-3">
        <span className="text-sm text-[var(--chrome)]/70">Total · acompte 10 % : {euros(Math.round(total * 10) /100)}</span>
        <span key={total} className="pr-total-montant text-xl">
          {euros(total)}
        </span>
      </div>
    </div>
  );
}

function Info({ terme, valeur, majuscule }: { terme: string; valeur: string; majuscule?: boolean }) {
  return (
    <div className="pr-info">
      <dt>{terme}</dt>
      <dd className={majuscule ? "first-letter:uppercase" : ""}>{valeur}</dd>
    </div>
  );
}

function EtapeCreneau({
  titreRef,
  packId,
  jour,
  heure,
  onJour,
  onHeure,
}: {
  titreRef: React.RefObject<HTMLHeadingElement | null>;
  packId: string;
  jour: string | null;
  heure: string | null;
  onJour: (j: string) => void;
  onHeure: (h: string, jour: string) => void;
}) {
  const [jours] = useState(() => prochainsJours(14));
  const jourChoisi = jour ?? jours[0].iso;
  const [resultat, setResultat] = useState<{ jour: string; creneaux: string[] } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

   useEffect(() => {
     let annule = false;
     fetch(`/api/reservation/creneaux?packId=${encodeURIComponent(packId)}&jour=${jourChoisi}`)
       .then((r) => r.json())
       .then((d) => {
         if (annule) return;
         setErreur(null);
         setResultat({ jour: jourChoisi, creneaux: d.creneaux ?? [] });
       })
       .catch(() => !annule && setErreur("Impossible de charger les créneaux. Réessayez."));
     return () => {
       annule = true;
     };
   }, [packId, jourChoisi]);

   const creneaux = resultat?.jour === jourChoisi ? resultat.creneaux : null;

  return (
    <>
      <h2 id="pr-titre" ref={titreRef} tabIndex={-1} className="pr-titre">
        Quand venons-nous ?
      </h2>
      <div className="pr-jours mt-5" role="listbox" aria-label="Jour">
        {jours.map((j) => (
          <button
            key={j.iso}
            type="button"
            role="option"
            aria-selected={j.iso === jourChoisi}
            className={`pr-jour ${j.iso === jourChoisi ? "choisi" : ""}`}
            onClick={() => onJour(j.iso)}
          >
            <span className="text-[11px] uppercase tracking-[0.15em] text-[var(--chrome)]/60">{j.jour}</span>
            <span className="text-sm font-semibold text-[var(--encre)]">{j.date}</span>
          </button>
        ))}
      </div>
      <div className="mt-5 min-h-[120px]">
        {erreur && <p className="text-sm text-[var(--danger)]">{erreur}</p>}
        {!erreur && creneaux === null && <p className="text-sm text-[var(--chrome)]/60">Recherche des créneaux libres…</p>}
        {creneaux?.length === 0 && (
          <p className="text-sm text-[var(--chrome)]/60">Plus de créneau libre ce jour-là : essayez un autre jour.</p>
        )}
        {creneaux && creneaux.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {creneaux.map((h) => (
              <button key={h} type="button" className={`pr-creneau ${heure === h ? "choisi" : ""}`} onClick={() => onHeure(h, jourChoisi)}>
                {`${Number(h.slice(0, 2))}h${h.endsWith(":00") ? "" : h.slice(3)}`}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="mt-3 text-[11px] text-[var(--chrome)]/45">
        Créneaux calculés selon les horaires et le planning réels de nos opérateurs.
      </p>
    </>
  );
}

function EtapeCoordonnees({
  titreRef,
  valeurs,
  onChange,
  recap,
  envoi,
  paiementEnLigne,
  acompte,
  onCreneauPris,
  onConfirme,
}: {
  titreRef: React.RefObject<HTMLHeadingElement | null>;
  valeurs: Coordonnees;
  onChange: (v: Coordonnees) => void;
  recap: React.ReactNode;
  envoi: { packId: string; categorie: string; optionIds: string[]; jour: string; heure: string };
  paiementEnLigne: boolean;
  acompte: number;
  onCreneauPris: () => void;
  onConfirme: (c: Confirmation) => void;
}) {
  const [redirection, setRedirection] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const champ = (nom: keyof Coordonnees) => ({
    name: nom,
    value: valeurs[nom],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...valeurs, [nom]: e.target.value }),
  });

   async function envoyer(e: React.FormEvent<HTMLFormElement>) {
     e.preventDefault();
     setErreur(null);
     setEnCours(true);
     const piege = new FormData(e.currentTarget).get("site");
     try {
       const res = await fetch("/api/reservation", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ ...valeurs, ...envoi, site: piege }),
       });
       const data = await res.json();
       if (res.status === 409) {
         onCreneauPris();
         return;
       }
       if (!res.ok) throw new Error(data.error ?? "La réservation n'a pas pu être enregistrée.");
       if (data.paiement?.url) {
         // Paiement de l'acompte sur la page sécurisée de Stripe.
         setRedirection(true);
         window.location.assign(data.paiement.url);
         return;
       }
       onConfirme(data);
     } catch (err) {
       setErreur(err instanceof Error ? err.message : "La réservation n'a pas pu être enregistrée.");
     } finally {
       setEnCours(false);
     }
   }

   return (
     <>
       <h2 id="pr-titre" ref={titreRef} tabIndex={-1} className="pr-titre">
         Où intervenons-nous ?
       </h2>
       <div className="mt-4">{recap}</div>
       <form onSubmit={envoyer} className="mt-5 grid grid-cols-2 gap-3">
         <Champ libelle="Prénom" requis auto="given-name" {...champ("prenom")} />
         <Champ libelle="Nom" requis auto="family-name" {...champ("nom")} />
         <Champ libelle="Téléphone" requis type="tel" auto="tel" large {...champ("telephone")} />
         <Champ libelle="E-mail (facultatif)" type="email" auto="email" large {...champ("email")} />
         <Champ libelle="Adresse d'intervention" requis auto="street-address" large {...champ("adresse")} />
         <Champ libelle="Code postal" auto="postal-code" {...champ("codePostal")} />
         <Champ libelle="Ville" requis auto="address-level2" {...champ("ville")} />
         <Champ libelle="Marque (facultatif)" {...champ("marque")} />
         <Champ libelle="Modèle (facultatif)" {...champ("modele")} />
         <label className="col-span-2 flex flex-col gap-1 text-xs text-[var(--chrome)]/70">
           Précisions (accès, parking…)
           <textarea rows={2} maxLength={500} className="pr-champ" {...champ("precisions")} />
          </label>
          {/* Champ piège anti-robots, invisible */}
          <input type="text" name="site" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
          {erreur && <p className="col-span-2 text-sm text-[var(--danger)]">{erreur}</p>}
          <button type="submit" disabled={enCours || redirection} className="pr-principal col-span-2">
            {redirection
              ? "Redirection vers le paiement…"
              : enCours
                ? "Enregistrement…"
                : paiementEnLigne
                  ? `Payer l'acompte · ${euros(acompte)}`
                  : "Confirmer la réservation"}
          </button>
          {paiementEnLigne && (
            <p className="col-span-2 text-center text-[11px] leading-relaxed text-[var(--chrome)]/55">
              Paiement sécurisé par Stripe. Votre créneau est réservé 30 minutes le temps du paiement ; le solde se
              règle à la fin de la prestation.
            </p>
          )}
        </form>
      </>
    );
}

function Champ({
  libelle,
  requis,
  type = "text",
  auto,
  large,
  name,
  value,
  onChange,
}: {
  libelle: string;
  requis?: boolean;
  type?: string;
  auto?: string;
  large?: boolean;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs text-[var(--chrome)]/70 ${large ? "col-span-2" : ""}`}>
      {libelle}
      <input name={name} type={type} required={requis} autoComplete={auto} value={value} onChange={onChange} className="pr-champ" />
    </label>
  );
}

