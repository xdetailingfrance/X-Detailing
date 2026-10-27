"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import LolaPlanete, { type EtatLola } from "./LolaPlanete";
import type { CarteRdvLola, CarteSmsLola, ReponseLola, SegmentLola } from "@/lib/lola";
import { composantesParis } from "@/lib/heure";

// Web Speech API : pas (encore) typée dans lib.dom de TypeScript, et
// préfixée « webkit » sur Chrome/Safari. On ne déclare que ce qu'on utilise.
type ResultatReconnaissance = { isFinal: boolean; 0: { transcript: string } };
type EvenementReconnaissance = { resultIndex: number; results: ArrayLike<ResultatReconnaissance> };
type Reconnaissance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: EvenementReconnaissance) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type ConstructeurReconnaissance = new () => Reconnaissance;

type Message = { role: "user" | "assistant"; content: string };

// Ce qui apparaît à droite de la planète pendant que Lola parle.
type Element = { type: "rdv"; id: string; carte: CarteRdvLola } | { type: "sms"; id: string; sms: CarteSmsLola };

const SUGGESTIONS = [
  "Dis-moi Lola, ce qui se passe aujourd'hui au planning",
  "Qui travaille demain ?",
  "Résume-moi la semaine",
  "Est-ce qu'il y a des rendez-vous non affectés ?",
  "Envoie les rappels SMS pour demain",
];

// Mot de réveil : « Lola », éventuellement suivi directement de la
// question (« Lola, qu'est-ce qui se passe aujourd'hui ? »).
const MOT_REVEIL = /(^|[^a-zà-ÿ])(lola|lolla)(?=$|[^a-zà-ÿ])/i;
const ECHECS_VEILLE_MAX = 5;

const LIBELLE_ETAT: Record<EtatLola, string> = {
  repos: "Touchez la planète pour parler à Lola",
  ecoute: "Je vous écoute…",
  reflexion: "Je regarde le planning…",
  parole: "",
};

function constructeurReconnaissance(): ConstructeurReconnaissance | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: ConstructeurReconnaissance;
    webkitSpeechRecognition?: ConstructeurReconnaissance;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const pasDAbonnement = () => () => {};

// Préférence « réveil par la voix », propre à ce navigateur (confort
// d'utilisation, pas une donnée métier).
const CLE_VEILLE = "lola-reveil-vocal";
const abonnesVeille = new Set<() => void>();
function lirePreferenceVeille() {
  try {
    return localStorage.getItem(CLE_VEILLE) !== "off";
  } catch {
    return true;
  }
}
function ecrirePreferenceVeille(active: boolean) {
  try {
    localStorage.setItem(CLE_VEILLE, active ? "on" : "off");
  } catch {
    // stockage indisponible (navigation privée) : réglage non mémorisé
  }
  abonnesVeille.forEach((f) => f());
}
function abonnementVeille(f: () => void) {
  abonnesVeille.add(f);
  return () => {
    abonnesVeille.delete(f);
  };
}

// La synthèse vocale n'a le droit de parler qu'après une première
// interaction avec la page (clic, touche) : règle des navigateurs.
function abonnementActivation(f: () => void) {
  window.addEventListener("pointerdown", f, true);
  window.addEventListener("keydown", f, true);
  return () => {
    window.removeEventListener("pointerdown", f, true);
    window.removeEventListener("keydown", f, true);
  };
}
function pageDejaActivee() {
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return activation?.hasBeenActive ?? true;
}

// Voix française, de préférence féminine (Lola), parmi celles installées.
function voixFrancaise() {
  const voix = window.speechSynthesis?.getVoices().filter((v) => v.lang.toLowerCase().startsWith("fr")) ?? [];
  return (
    voix.find((v) => /amélie|audrey|marie|denise|julie|hortense|virginie|google français/i.test(v.name)) ?? voix[0] ?? null
  );
}

export default function LolaAccueil({ prenom }: { prenom: string | null }) {
  const [etat, setEtat] = useState<EtatLola>("repos");
  const [sousTitre, setSousTitre] = useState("");
  const [question, setQuestion] = useState("");
  const router = useRouter();
  const [elements, setElements] = useState<Element[]>([]);
  const [elementActif, setElementActif] = useState<string | null>(null);
  const [saisie, setSaisie] = useState("");
  const [voixActive, setVoixActive] = useState(true);
  const [conversationContinue, setConversationContinue] = useState(true);
   const [mode, setMode] = useState<"claude" | "local" | null>(null);
   const [erreur, setErreur] = useState<string | null>(null);
   // Côté serveur on suppose le micro disponible ; le navigateur corrige à
   // l'hydratation.
   const micDisponible = useSyncExternalStore(
     pasDAbonnement,
     () => constructeurReconnaissance() !== null,
     () => true
   );

   const preferenceVeille = useSyncExternalStore(abonnementVeille, lirePreferenceVeille, () => true);
   const veilleActivee = preferenceVeille && micDisponible;
   const pageActivee = useSyncExternalStore(abonnementActivation, pageDejaActivee, () => true);
   const [enVeille, setEnVeille] = useState(false);

   const impulsionRef = useRef(0);
   const reconnaissanceRef = useRef<Reconnaissance | null>(null);
   // Écoute de fond qui attend le mot « Lola ».
   const veilleRef = useRef<Reconnaissance | null>(null);
   // Ce qu'il faut faire une fois la veille réellement arrêtée (la
   // reconnaissance vocale ne peut pas tourner en double).
   const actionApresVeilleRef = useRef<(() => void) | null>(null);
   const echecsVeilleRef = useRef(0);
   const veilleActiveeRef = useRef(false);
   const etatRef = useRef<EtatLola>("repos");
   const messagesRef = useRef<Message[]>([]);
   // Chaque nouvelle lecture invalide la précédente (interruption).
   const lectureRef = useRef(0);
   const reveilleeRef = useRef(false);
   // Lus dans des callbacks asynchrones (fin de lecture vocale) : des refs
   // évitent d'utiliser une valeur périmée du state.
   const conversationContinueRef = useRef(true);
   const voixActiveRef = useRef(true);
   // Chrome libère parfois l'énoncé en cours avant `onend` s'il n'est plus
   // référencé : on le garde.
   const enonceRef = useRef<SpeechSynthesisUtterance | null>(null);

   useEffect(() => {
     // Les voix se chargent en asynchrone sur Chrome.
     window.speechSynthesis?.getVoices();
     return () => {
       veilleActiveeRef.current = false;
       actionApresVeilleRef.current = () => {};
       veilleRef.current?.abort();
       reconnaissanceRef.current?.stop();
       window.speechSynthesis?.cancel();
     };
   }, []);

   // Sur téléphone, la carte dont Lola parle peut être sous la planète :
   // on l'amène à l'écran.
   useEffect(() => {
     if (!elementActif) return;
     document.getElementById(`lola-${elementActif}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
   }, [elementActif]);

   // Arrivée depuis le bouton Lola flottant (/back-office#lola) : elle
   // écoute directement.
   useEffect(() => {
     if (window.location.hash !== "#lola") return;
     history.replaceState(null, "", window.location.pathname + window.location.search);
     const minuteur = window.setTimeout(() => toucherPlanete(), 300);
     return () => window.clearTimeout(minuteur);
     // Une seule fois, à l'arrivée sur la page.
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   // Dès que Lola est au repos, elle se remet à attendre son prénom.
   useEffect(() => {
     etatRef.current = etat;
     veilleActiveeRef.current = veilleActivee;
     if (!veilleActivee) arreterVeille();
     else if (etat === "repos") demarrerVeille();
     // demarrerVeille/arreterVeille ne lisent que des refs.
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [etat, veilleActivee]);

   function demarrerVeille() {
     if (veilleRef.current || reconnaissanceRef.current) return;
       if (echecsVeilleRef.current >= ECHECS_VEILLE_MAX) return;
       const Constructeur = constructeurReconnaissance();
       if (!Constructeur) return;

       const reco = new Constructeur();
       reco.lang = "fr-FR";
       reco.continuous = true;
       reco.interimResults = true;

       reco.onstart = () => setEnVeille(true);
       reco.onresult = (e) => {
         echecsVeilleRef.current = 0;
         for (let i = e.resultIndex; i < e.results.length; i++) {
           const transcription = e.results[i][0].transcript;
           const reveil = MOT_REVEIL.exec(transcription);
           if (!reveil) continue;
           // Retour visuel immédiat, puis on attend la fin de la phrase pour
           // savoir si la question suit directement le prénom.
           impulsionRef.current = 1;
           if (!e.results[i].isFinal) continue;
           const suite = transcription
             .slice(reveil.index + reveil[0].length)
             .replace(/^[\s,.!?:;-]+/, "")
             .trim();
           actionApresVeilleRef.current = suite.split(/\s+/).length >= 2 ? () => envoyer(suite) : repondreAuReveil;
           reco.abort();
           return;
         }
       };
       reco.onerror = (e) => {
         if (e.error === "not-allowed" || e.error === "service-not-allowed") {
           echecsVeilleRef.current = ECHECS_VEILLE_MAX;
           setErreur("Accès au micro refusé : autorisez-le dans votre navigateur pour réveiller Lola à la voix.");
         } else if (e.error !== "no-speech" && e.error !== "aborted") {
           echecsVeilleRef.current++;
         }
       };
       reco.onend = () => {
         if (veilleRef.current === reco) veilleRef.current = null;
         setEnVeille(false);
         const action = actionApresVeilleRef.current;
         actionApresVeilleRef.current = null;
         if (action) {
           action();
           return;
         }
         // Arrêt spontané (long silence, coupure réseau) : on relance.
         if (veilleActiveeRef.current && etatRef.current === "repos") {
           window.setTimeout(demarrerVeille, 250 + echecsVeilleRef.current * 1000);
         }
       };

       veilleRef.current = reco;
       try {
         reco.start();
       } catch {
         veilleRef.current = null;
       }
   }

   function arreterVeille(ensuite?: () => void) {
     const veille = veilleRef.current;
     if (!veille) {
       ensuite?.();
       return;
     }
     actionApresVeilleRef.current = ensuite ?? (() => {});
     veille.abort();
   }

   function repondreAuReveil() {
     const premiereFois = !reveilleeRef.current;
     reveilleeRef.current = true;
     const salut = composantesParis(new Date()).heure >= 18 ? "Bonsoir" : "Bonjour";
     const texte = premiereFois
       ? `${salut}${prenom ? ` ${prenom}` : ""}, je vous écoute.`
       : `Oui${prenom ? ` ${prenom}` : ""} ?`;
     jouer([{ texte, carte: null }], ecouter);
   }

   function dire(texte: string, jeton: number) {
     return new Promise<void>((resolve) => {
       const synthese = window.speechSynthesis;
       if (!voixActiveRef.current || !synthese) {
         // Sans voix : on garde le rythme d'une lecture pour l'animation.
         const pulsation = window.setInterval(() => (impulsionRef.current = 0.6), 260);
         window.setTimeout(() => {
           window.clearInterval(pulsation);
           resolve();
         }, Math.min(7000, 700 + texte.length * 45));
         return;
       }
       const enonce = new SpeechSynthesisUtterance(texte);
       enonce.lang = "fr-FR";
       const voix = voixFrancaise();
       if (voix) enonce.voice = voix;
       enonce.rate = 1.04;
       enonce.onboundary = () => {
         if (lectureRef.current === jeton) impulsionRef.current = 1;
       };
       // Filet de sécurité : certains navigateurs (ou l'absence de voix
       // installée) ne déclenchent jamais `onend`.
       const secours = window.setTimeout(resolve, 1500 + texte.length * 120);
       enonce.onend = enonce.onerror = () => {
         window.clearTimeout(secours);
         resolve();
       };
       enonceRef.current = enonce;
       synthese.speak(enonce);
     });
   }

   async function jouer(segments: SegmentLola[], apres?: () => void) {
     const jeton = ++lectureRef.current;
     window.speechSynthesis?.cancel();
     setEtat("parole");
     for (const segment of segments) {
       if (lectureRef.current !== jeton) return;
       setSousTitre(segment.texte);
       const nouveaux: Element[] = [
         ...(segment.carte ? [{ type: "rdv" as const, id: segment.carte.id, carte: segment.carte }] : []),
         ...(segment.sms ? [{ type: "sms" as const, id: segment.sms.id, sms: segment.sms }] : []),
       ];
       if (nouveaux.length) {
         // Une carte déjà affichée est mise à jour (ex. RDV qui vient d'être affecté).
         setElements((actuels) => [
           ...actuels.map((e) => nouveaux.find((n) => n.id === e.id) ?? e),
           ...nouveaux.filter((n) => !actuels.some((e) => e.id === n.id)),
         ]);
         setElementActif(nouveaux[nouveaux.length - 1].id);
       }
       await dire(segment.texte, jeton);
     }
     if (lectureRef.current !== jeton) return;
     setElementActif(null);
     setEtat("repos");
     apres?.();
   }

   async function envoyer(texteQuestion: string) {
     const texte = texteQuestion.trim();
     if (!texte) return;
     arreterVeille();
     reveilleeRef.current = true;
     lectureRef.current++;
     window.speechSynthesis?.cancel();
     setErreur(null);
     setSaisie("");
     setQuestion(texte);
     setSousTitre("");
     setElements([]);
     setElementActif(null);
     const historique = [...messagesRef.current, { role: "user" as const, content: texte }];
     messagesRef.current = historique;
     setEtat("reflexion");

      try {
        const res = await fetch("/api/assistant", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ messages: historique }),
         });
         const data = await res.json();
         if (!res.ok) throw new Error(data.error ?? "Erreur inconnue");
         const reponse = data as ReponseLola;
         const segments = reponse.segments;
         messagesRef.current = [
           ...historique,
           {
             role: "assistant",
             content: [segments.map((s) => s.texte).join(" "), reponse.memoire].filter(Boolean).join("\n"),
           },
         ];
         setMode(reponse.mode);
         // Lola a modifié le planning : le tableau de bord se met à jour.
         if (reponse.modifie) router.refresh();
         await jouer(segments, () => {
           if (conversationContinueRef.current) ecouter();
         });
       } catch (e) {
         // Question non traitée : on la retire de l'historique.
         messagesRef.current = historique.slice(0, -1);
         setErreur(e instanceof Error ? e.message : "Lola n'a pas pu répondre.");
         setEtat("repos");
       }
   }

   function ecouter() {
     const Constructeur = constructeurReconnaissance();
     if (!Constructeur) return;
     if (veilleRef.current) {
       arreterVeille(ecouter);
       return;
     }
     lectureRef.current++;
     window.speechSynthesis?.cancel();
     reconnaissanceRef.current?.stop();

       const reco = new Constructeur();
       reco.lang = "fr-FR";
       reco.interimResults = true;
       reco.continuous = false;
       let finale = "";

       reco.onresult = (e) => {
         let provisoire = "";
         for (let i = e.resultIndex; i < e.results.length; i++) {
           const resultat = e.results[i];
           if (resultat.isFinal) finale += resultat[0].transcript;
           else provisoire += resultat[0].transcript;
         }
         impulsionRef.current = 0.5;
         setQuestion(finale + provisoire);
       };
       reco.onerror = (e) => {
         if (e.error === "not-allowed" || e.error === "service-not-allowed") {
           setErreur("Accès au micro refusé : autorisez-le dans votre navigateur.");
         } else if (e.error !== "no-speech" && e.error !== "aborted") {
           setErreur(`Reconnaissance vocale indisponible (${e.error}).`);
         }
       };
       reco.onend = () => {
         if (reconnaissanceRef.current === reco) reconnaissanceRef.current = null;
         if (finale.trim()) envoyer(finale);
         else setEtat((e) => (e === "ecoute" ? "repos" : e));
       };

       reconnaissanceRef.current = reco;
       setErreur(null);
       setEtat("ecoute");
       reco.start();
   }

   function toucherPlanete() {
     if (etat === "ecoute") {
       reconnaissanceRef.current?.stop();
       return;
       }
       if (!micDisponible) return;
       // Premier contact de la journée : Lola salue avant d'écouter.
       arreterVeille(reveilleeRef.current ? ecouter : repondreAuReveil);
   }

  const salutation = `${composantesParis(new Date()).heure >= 18 ? "Bonsoir" : "Bonjour"}${prenom ? ` ${prenom}`: ""}.`;
  const texteSousPlanete =
    etat === "parole"
      ? sousTitre
      : !micDisponible
        ? "Écrivez votre question à Lola ci-dessous."
        : etat === "repos" && enVeille
          ? "Dites « Lola » ou touchez la planète"
          : LIBELLE_ETAT[etat];

  return (
    <section className="lola-ciel relative overflow-hidden rounded-2xl border border-[var(--border)]">
      {/* Téléphone : planète, puis cartes, puis saisie et réglages.
          Ordinateur : planète et saisie à gauche, cartes à droite. */}
      <div className="relative grid grid-cols-1 gap-4 p-4 sm:gap-6 sm:p-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:p-8">
        <div className="flex min-w-0 flex-col items-center text-center lg:col-start-1 lg:row-start-1">
          <button
            type="button"
            onClick={toucherPlanete}
            disabled={etat === "reflexion"}
            aria-label={etat === "ecoute" ? "Arrêter l'écoute" : "Parler à Lola"}
            className="w-full max-w-[220px] sm:max-w-[300px] lg:max-w-[340px] rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] cursor-pointer disabled:cursor-wait"
          >
            <LolaPlanete etat={etat} impulsionRef={impulsionRef} />
          </button>
          <p className="-mt-3 sm:-mt-4 text-xs font-semibold uppercase tracking-[0.4em] text-[var(--accent)]">Lola</p>
          {question && (
            <p className="mt-3 text-sm italic text-[var(--muted)]">« {question} »</p>
          )}
          <p
            key={texteSousPlanete}
            className="lola-sous-titre mt-2 min-h-[3.5rem] max-w-md text-base leading-snug sm:text-lg"
            aria-live="polite"
          >
            {texteSousPlanete}
          </p>
          {erreur && <p className="mt-2 text-sm text-[var(--danger)]">{erreur}</p>}
        </div>

        <div className="flex min-w-0 flex-col justify-center gap-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:min-h-[240px]">
          {elements.length === 0 ? (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xl font-semibold sm:text-2xl">{salutation}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Demandez à Lola ce qui se passe au planning : elle vous répond à voix haute et vous montre chaque
                  rendez-vous de l&apos;équipe.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => envoyer(s)}
                    disabled={etat === "reflexion"}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-2 text-xs sm:py-1.5 hover:border-[var(--accent)] hover:bg-[var(--surface-2)] disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-3 2xl:grid-cols-2">
              {elements.map((e) =>
                   e.type === "rdv" ? (
                     <CarteRdv key={e.id} carte={e.carte} active={elementActif === e.id} />
                   ) : (
                     <CarteSms key={e.id} sms={e.sms} active={elementActif === e.id} />
                   )
                 )}
               </div>
             )}
             {mode === "local" && (
               <p className="mt-2 text-[11px] text-[var(--muted)]">
                 Lola répond avec son moteur intégré. Définissez <code>ANTHROPIC_API_KEY</code> pour qu&apos;elle comprenne
              toutes vos questions en langage naturel.
            </p>
          )}
        </div>
        <div className="flex min-w-0 flex-col items-center text-center lg:col-start-1 lg:row-start-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              envoyer(saisie);
            }}
            className="flex w-full max-w-md gap-2"
          >
            <input
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              placeholder="Ou écrivez à Lola…"
              className="min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)]/80 px-4 py-2.5 text-base sm:py-2 sm:text-sm"
            />
            <button
              type="submit"
              disabled={etat === "reflexion" || !saisie.trim()}
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-2)] disabled:opacity-50"
            >
              Envoyer
            </button>
          </form>
          <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-[var(--muted)]">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={voixActive}
                onChange={(e) => {
                  voixActiveRef.current = e.target.checked;
                  setVoixActive(e.target.checked);
                  if (!e.target.checked) window.speechSynthesis?.cancel();
                }}
              />
              Voix
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={conversationContinue}
                disabled={!micDisponible}
                onChange={(e) => {
                  conversationContinueRef.current = e.target.checked;
                  setConversationContinue(e.target.checked);
                }}
              />
              Conversation continue
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={veilleActivee}
                disabled={!micDisponible}
                onChange={(e) => {
                  echecsVeilleRef.current = 0;
                  setErreur(null);
                  ecrirePreferenceVeille(e.target.checked);
                }}
              />
              Réveil par « Lola »
              {enVeille && (
                     <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--success)]" aria-label="à l'écoute" />
                   )}
                 </label>
               </div>
               {veilleActivee && !pageActivee && (
                 <p className="mt-2 max-w-md text-[11px] text-[var(--warning)]">
                   Cliquez une fois n&apos;importe où sur la page : le navigateur l&apos;exige avant que Lola puisse vous
                   répondre à voix haute.
                 </p>
               )}
             </div>

        </div>
      </section>
    );
}

function CarteRdv({ carte, active }: { carte: CarteRdvLola; active: boolean }) {
  const initiale = carte.operateur?.charAt(0) ?? "?";
  return (
    <a
      id={`lola-${carte.id}`}
      href={`/back-office/rendez-vous/${carte.id}`}
      className={`lola-carte relative block overflow-hidden rounded-xl border p-4 backdrop-blur transition duration-500 ${
        active
          ? "border-[var(--accent)] bg-[var(--surface-2)]/90 shadow-[0_0_32px_-6px_var(--accent)]"
          : "border-[var(--border)] bg-[var(--surface)]/80 opacity-80"
      }`}
    >
      <span className="lola-reflet pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${
            carte.operateur ? "bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)]" : "bg-[var(--warning)]"
          }`}
        >
          {initiale}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{carte.operateur ?? "Non affecté"}</p>
          <p className="text-xs text-[var(--muted)]">{carte.jour.charAt(0).toUpperCase() + carte.jour.slice(1)}</p>
        </div>
        <span className="text-2xl font-semibold tabular-nums">{carte.heure}</span>
      </div>
      <p className="mt-3 text-sm font-medium text-[var(--accent)]">
        {carte.prestation} · {carte.dureeMinutes} min
      </p>
      <p className="mt-1 flex items-start gap-1.5 text-sm">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 fill-none stroke-current" strokeWidth={2}>
          <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
          <circle cx="12" cy="9.5" r="2.5" />
        </svg>
        <span>
          {carte.adresse}, {carte.ville}
        </span>
      </p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        {carte.client} · {carte.vehicule} · {carte.statut}
      </p>
    </a>
  );
}

function CarteSms({ sms, active }: { sms: CarteSmsLola; active: boolean }) {
  const couleur =
    sms.statut === "échec" ? "text-[var(--danger)]" : sms.statut === "simulé" ? "text-[var(--warning)]" : "text-[var(--success)]";
  return (
    <a
      id={`lola-${sms.id}`}
      href="/back-office/sms"
      className={`lola-carte relative block overflow-hidden rounded-xl border p-4 backdrop-blur transition duration-500 ${
            active
              ? "border-[var(--accent)] bg-[var(--surface-2)]/90 shadow-[0_0_32px_-6px_var(--accent)]"
              : "border-[var(--border)] bg-[var(--surface)]/80 opacity-80"
          }`}
      >
      <span className="lola-reflet pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--accent)]">
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth={2} strokeLinejoin="round">
            <path d="M4 5h16v11H9l-5 4z" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">SMS à {sms.destinataire}</p>
          <p className="text-xs text-[var(--muted)]">{sms.telephone}</p>
        </div>
        <span className={`text-xs font-medium ${couleur}`}>{sms.statut === "simulé" ? "simulé" : sms.statut}</span>
      </div>
      <p className="lola-bulle mt-3 rounded-2xl rounded-bl-sm bg-[var(--accent-2)] px-3 py-2 text-sm leading-snugtext-white">
        {sms.message}
      </p>
    </a>
  );
}

