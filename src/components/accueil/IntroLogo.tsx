"use client";

import { useEffect, useRef, useState } from "react";
import contour from "./contour-x.json";
import { CLE_INTRO } from "./intro";

// Ouverture motion design du site autour du logo officiel X Detailing.
// Le logo n'est jamais redessiné : le X et « DETAILING » sont deux calques
// découpés dans le fichier original (scripts/calques-logo.py) ; seul le
// contour du X est vectorisé pour la ligne lumineuse.
//
// Chronologie (ms, voir accueil.css) :
//   0      écran noir
//   300    une ligne violette parcourt les contours du X
//   1500   le X se révèle (métal 3D, reflets violets, éclats contrôlés)
//   2600   reflets blancs de studio sur les surfaces
//   3000   « DETAILING » apparaît, net, au centre
//   0–4800 léger mouvement de caméra en profondeur, puis stabilisation
//   5450   le logo rejoint l'en-tête, les prestations apparaissent
//
// Le contenu de la page est rendu dessous dès le départ (lisible par les
// lecteurs d'écran et les moteurs) ; l'ouverture se passe d'un tap, d'une
// touche ou d'un défilement, ne se rejoue qu'une fois par session et est
// ignorée si l'appareil demande moins d'animations (script en tête de page).

const DEBUT_VOL = 5450;
const DUREE_VOL = 1000;
const FIN = 6500;

// Mémorisé dès le début : un rechargement pendant l'ouverture ne la
// rejoue pas.
function memoriserVue() {
  try {
    sessionStorage.setItem(CLE_INTRO, "1");
  } catch {
    // stockage indisponible : l'ouverture se rejouera, rien de grave
  }
}

function finir() {
  document.documentElement.dataset.intro = "fini";
}

export default function IntroLogo() {
  const [active, setActive] = useState(true);
  const racineRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
     const racine = racineRef.current;
     // Ouverture déjà vue cette session (ou moins d'animations demandé) :
     // le calque reste masqué par le CSS, rien à faire.
     if (!racine || document.documentElement.dataset.intro !== "en-cours") return;
     memoriserVue();

      const minuteurs: number[] = [];
      let termine = false;
      const terminer = (rapide: boolean) => {
        if (termine) return;
        termine = true;
        minuteurs.forEach(clearTimeout);
        finir();
        racine.classList.add(rapide ? "intro-passee" : "intro-sortie");
        minuteurs.push(window.setTimeout(() => setActive(false), rapide ? 450 : 500));
      };

      // Le logo rejoint sa place dans l'en-tête (FLIP).
      const voler = () => {
        const cible = document.getElementById("logo-entete")?.getBoundingClientRect();
        const logo = logoRef.current;
        if (!cible || !logo) return;
        const depart = logo.getBoundingClientRect();
        const dx = cible.left + cible.width / 2 - (depart.left + depart.width / 2);
        const dy = cible.top + cible.height / 2 - (depart.top + depart.height / 2);
        const echelle = cible.width / depart.width;
        logo.animate(
          [
            { transform: "translate(0, 0) scale(1)" },
            { transform: `translate(${dx}px, ${dy}px) scale(${echelle})` },
          ],
          { duration: DUREE_VOL, easing: "cubic-bezier(0.65, 0, 0.25, 1)", fill: "forwards" }
        );
      };

    // L'animation ne démarre qu'une fois le calque du X décodé (l'écran
    // reste noir en attendant — c'est la première étape).
    const demarrer = () => {
      if (termine) return;
      racine.classList.add("intro-joue");
      minuteurs.push(window.setTimeout(voler, DEBUT_VOL));
      minuteurs.push(window.setTimeout(() => document.documentElement.setAttribute("data-intro", "fini"), DEBUT_VOL + 400));
      minuteurs.push(window.setTimeout(() => terminer(false), FIN));
      };
      const imageX = racine.querySelector<HTMLImageElement>(".intro-x");
      const securite = window.setTimeout(demarrer, 1800);
      minuteurs.push(securite);
      imageX
        ?.decode()
        .catch(() => {})
        .finally(() => {
          clearTimeout(securite);
          demarrer();
        });

     const passer = () => terminer(true);
     const options = { passive: true } as const;
     window.addEventListener("pointerdown", passer, options);
     window.addEventListener("keydown", passer);
     window.addEventListener("wheel", passer, options);
     window.addEventListener("touchmove", passer, options);
     return () => {
       minuteurs.forEach(clearTimeout);
       window.removeEventListener("pointerdown", passer);
       window.removeEventListener("keydown", passer);
       window.removeEventListener("wheel", passer);
       window.removeEventListener("touchmove", passer);
     };
   }, []);

   if (!active) return null;

   const { largeur, hauteur, bande, chemins } = contour;

  return (
    <div ref={racineRef} className="intro" aria-hidden="true">
      <div className="intro-noir" />
      <div className="intro-scene">
        <div ref={logoRef} className="intro-logo">
          <svg className="intro-trace" viewBox={`0 0 ${largeur} ${hauteur}`}>
            {chemins.map((d, i) => (
              <g key={i} style={{ ["--i" as string]: i }}>
                <path className="intro-trace-ligne" d={d} pathLength={1} />
                <path className="intro-trace-tete" d={d} pathLength={1} />
              </g>
            ))}
          </svg>
          {/* eslint-disable-next-line @next/next/no-img-element -- calque animé, servi tel quel */}
          <img
            className="intro-x"
            src="/marque/x-640.webp"
            srcSet="/marque/x-640.webp 640w, /marque/x-1254.webp 1254w"
            sizes="(min-width: 768px) 560px, 82vw"
            alt=""
            decoding="async"
            fetchPriority="high"
          />
          <div className="intro-reflet intro-reflet--x" />
          <span className="intro-eclat" style={{ left: "70%", top: "21.5%", ["--d" as string]: "2250ms" }} />
          <span className="intro-eclat" style={{ left: "69%", top: "60%", ["--d" as string]: "2450ms" }} />
          <span className="intro-eclat intro-eclat--petit" style={{ left: "35%", top: "35%", ["--d" as string]:"2600ms" }} />
          <div
            className="intro-texte"
            style={{ top: `${(bande[0] / hauteur) * 100}%`, height: `${((bande[1] - bande[0]) / hauteur) * 100}%`}}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- calque animé, servi tel quel */}
            <img
              src="/marque/detailing-640.webp"
              srcSet="/marque/detailing-640.webp 640w, /marque/detailing-1254.webp 1254w"
              sizes="(min-width: 768px) 560px, 82vw"
              alt=""
              decoding="async"
            />
            <div className="intro-reflet intro-reflet--texte" />
          </div>
        </div>
      </div>

            <button type="button" className="intro-passer" tabIndex={-1}>
              Passer
        </button>
      </div>
    );
}

