"use client";

import { useState } from "react";

/**
 * Exploration du véhicule (§8, expérience 04).
 *
 * Une liste de prestations demande au lecteur de traduire « shampoing textile » en
 * « mes sièges ». Ici il désigne la zone qui l'inquiète et lit ce qui y est fait.
 *
 * Le dessin est un schéma au trait, pas une photographie simulée : il annonce ce qu'il
 * est. Une illustration qui tenterait de passer pour une vraie voiture serait le genre
 * de faux-semblant que la direction artistique exclut.
 */

type Zone = {
  key: string;
  label: string;
  /** Coordonnées dans le repère du schéma. */
  x: number;
  y: number;
  body: string;
  /** Formule qui couvre la zone, telle qu'elle est nommée au catalogue. */
  formula: "Concession" | "Concession Luxe";
};

const ZONES: Zone[] = [
  {
    key: "sieges",
    label: "Sièges et moquettes",
    x: 228, y: 66,
    body: "Aspiration, puis shampoing des sièges, des tapis et des moquettes. Le cuir et l'alcantara sont traités séparément, avec un produit qui ne les assèche pas.",
    formula: "Concession",
  },
  {
    key: "plastiques",
    label: "Tableau de bord et plastiques",
    x: 176, y: 74,
    body: "Nettoyage des plastiques, puis ravivage. On ne pose pas de brillant gras : la finition reste mate, comme d'origine.",
    formula: "Concession",
  },
  {
    key: "vitres",
    label: "Vitres",
    x: 298, y: 66,
    body: "Vitres intérieures reprises sans trace — c'est le côté intérieur qui trahit un nettoyage bâclé. L'extérieur suit avec le lavage carrosserie.",
    formula: "Concession",
  },
  {
    key: "seuils",
    label: "Seuils de porte",
    x: 232, y: 106,
    body: "Nettoyés et finis. C'est ce qu'on voit en montant dans la voiture, et c'est presque toujours oublié.",
    formula: "Concession",
  },
  {
    key: "coffre",
    label: "Coffre",
    x: 358, y: 88,
    body: "Aspiration complète, y compris sous le plancher quand il se soulève. Le coffre chargé d'un utilitaire se traite en option.",
    formula: "Concession",
  },
  {
    key: "carrosserie",
    label: "Carrosserie",
    x: 338, y: 100,
    body: "Pré-lavage à la mousse active pour décoller le gras sans frotter, puis lavage manuel. Séchage à la microfibre, sans trace.",
    formula: "Concession Luxe",
  },
  {
    key: "jantes",
    label: "Jantes et passages de roue",
    x: 106, y: 118,
    body: "Passages de roue nettoyés en profondeur, jantes reprises face avant et intérieure, pneumatiques finis en satiné — pas en brillant.",
    formula: "Concession Luxe",
  },
];

export function CarZones({
  formulas,
  title = "Ce qu'on traite, zone par zone.",
  lead = "Touchez une zone du véhicule pour savoir ce qui y est fait, et dans quelle formule c'est compris.",
}: {
  /** Restreint aux zones couvertes par ces formules. Toutes par défaut. */
  formulas?: Array<Zone["formula"]>;
  title?: string;
  lead?: string;
} = {}) {
  const zones = formulas ? ZONES.filter((zone) => formulas.includes(zone.formula)) : ZONES;
  const [activeKey, setActiveKey] = useState<string>(zones[0].key);
  const active = zones.find((zone) => zone.key === activeKey) ?? zones[0];

  return (
    <section id="zones" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 sm:py-28">
      <h2 className="max-w-2xl text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-xd-text sm:text-[2.6rem]">
        {title}
      </h2>
      <p className="mt-4 max-w-xl text-body text-xd-text-3">{lead}</p>

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-center">
        <div className="glass overflow-hidden rounded-[--radius-xd-2xl] p-4 sm:p-8">
          <svg
            viewBox="0 0 400 150"
            className="w-full"
            role="group"
            aria-label="Schéma du véhicule — zones traitées"
          >
            {/* Sol */}
            <line
              x1="10" y1="132" x2="390" y2="132"
              stroke="currentColor"
              className="text-xd-steel"
              strokeWidth="1"
              strokeDasharray="3 5"
            />

            {/* Caisse */}
            <path
              d="M22 116 C20 100 26 94 42 92 L128 86 L168 54 C172 50 178 48 186 48 L252 48 C262 48 270 51 276 58 L304 86 L366 92 C378 94 382 100 380 116 Z"
              fill="rgb(255 255 255 / 0.03)"
              stroke="currentColor"
              className="text-xd-ash"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />

            {/* Vitrage */}
            <path
              d="M174 58 L190 54 L248 54 L268 60 L292 84 L182 84 Z"
              fill="rgb(123 60 255 / 0.06)"
              stroke="currentColor"
              className="text-xd-ash"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />

            {/* Montant central et ligne de porte */}
            <line x1="228" y1="54" x2="228" y2="84" stroke="currentColor" className="text-xd-ash" strokeWidth="1.2" />
            <path d="M186 84 L186 112 M272 84 L272 112" stroke="currentColor" className="text-xd-steel" strokeWidth="1" />

            {/* Roues */}
            {[106, 300].map((cx) => (
              <g key={cx}>
                <circle cx={cx} cy="116" r="22" fill="rgb(6 6 7 / 0.9)" stroke="currentColor" className="text-xd-ash" strokeWidth="1.4" />
                <circle cx={cx} cy="116" r="11" fill="none" stroke="currentColor" className="text-xd-steel" strokeWidth="1.2" />
              </g>
            ))}

            {/* Points sensibles. Cible tactile de 44 px via un cercle transparent. */}
            {zones.map((zone) => {
              const selected = zone.key === activeKey;
              return (
                <g key={zone.key}>
                  <circle
                    cx={zone.x}
                    cy={zone.y}
                    r={selected ? 6 : 4}
                    className={selected ? "fill-xd-violet-highlight" : "fill-xd-text-4"}
                    style={{ transition: "r var(--xd-micro) var(--xd-spring)" }}
                  />
                  {selected && (
                    <circle
                      cx={zone.x}
                      cy={zone.y}
                      r="11"
                      fill="none"
                      className="stroke-xd-violet"
                      strokeWidth="1.2"
                      opacity="0.6"
                    />
                  )}
                  <circle
                    cx={zone.x}
                    cy={zone.y}
                    r="16"
                    fill="transparent"
                    className="cursor-pointer"
                    onClick={() => setActiveKey(zone.key)}
                  >
                    <title>{zone.label}</title>
                  </circle>
                </g>
              );
            })}
          </svg>

          {/*
            Chemin clavier et mobile. Les points du schéma restent le geste naturel,
            mais on ne peut pas exiger de viser un cercle de 16 px au pouce.
          */}
          <div className="mt-5 flex snap-x gap-2 overflow-x-auto pb-1">
            {zones.map((zone) => (
              <button
                key={zone.key}
                type="button"
                aria-pressed={zone.key === activeKey}
                onClick={() => setActiveKey(zone.key)}
                className={`press shrink-0 snap-start whitespace-nowrap rounded-full px-4 py-2 text-meta font-medium transition-colors duration-[--xd-micro] ${
                  zone.key === activeKey
                    ? "bg-xd-violet text-white"
                    : "bg-black/[0.04] text-xd-text-3 hover:text-xd-text-2"
                }`}
              >
                {zone.label}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-premium rounded-[--radius-xd-xl] p-7">
          <p className="eyebrow text-xd-violet-highlight">{active.formula}</p>
          <p className="mt-2 text-h2 font-semibold tracking-[-0.02em] text-xd-text">
            {active.label}
          </p>
          <p className="mt-4 text-body leading-relaxed text-xd-text-2">{active.body}</p>
        </div>
      </div>
    </section>
  );
}
