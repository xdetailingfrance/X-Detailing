import type { ReactNode } from "react";
import Image from "next/image";
import { BUSINESS } from "@/lib/business";
import { FORMULES, OPTIONS, VEHICULES, euros } from "@/lib/catalogue";
import { CRENEAUX, jourParis, libelleHeure, libelleJour, type Creneau } from "@/lib/creneaux";
import { depot, type Reservation } from "@/lib/db";
import { accesAutorise, motDePasseConfigure } from "@/lib/gestion";
import { Connexion } from "./connexion";
import { BoutonDeconnexion, BoutonLiberer } from "./liberer";

/**
 * Gestion des réservations — une seule page, derrière un mot de passe.
 *
 * Elle sert à une chose : voir ce qui arrive, et libérer un créneau quand un client
 * annule par téléphone. Elle n'est reliée nulle part sur le site et se déclare hors
 * index. Tout le reste (confirmer, déplacer) se fait par téléphone, comme avant.
 */

export const metadata = {
  title: `Réservations · ${BUSINESS.name}`,
  robots: { index: false, follow: false },
};

export default async function GestionPage() {
  if (!motDePasseConfigure()) {
    return (
      <Coque>
        <Message titre="Page non configurée.">
          Définissez la variable d&apos;environnement <code>GESTION_MOT_DE_PASSE</code>
          (huit caractères au minimum) pour ouvrir cette page.
        </Message>
      </Coque>
    );
  }

  if (!(await accesAutorise())) {
    return (
      <Coque>
        <h1 className="text-2xl font-semibold tracking-tight text-xd-text">Réservations</h1>
        <p className="mt-2 text-sm text-xd-text-3">Accès réservé à {BUSINESS.name}.</p>
        <div className="mt-6">
          <Connexion />
        </div>
      </Coque>
    );
  }

  let reservations: Reservation[];
  try {
    reservations = await depot().reservationsAVenir(jourParis(new Date()));
  } catch (error) {
    console.error("[gestion] lecture impossible :", error);
    return (
      <Coque>
        <Message titre="La base de données ne répond pas.">
          Réessayez dans un instant. Si le problème persiste, vérifiez
          <code> DATABASE_URL</code> sur l&apos;hébergeur.
        </Message>
      </Coque>
    );
  }

  const parJour = new Map<string, Reservation[]>();
  for (const r of reservations) {
    parJour.set(r.jour, [...(parJour.get(r.jour) ?? []), r]);
  }

  return (
    <Coque deconnexion>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-xd-text">
            Réservations à venir
          </h1>
          <p className="mt-1 text-sm text-xd-text-3">
            {reservations.length === 0
              ? "Aucune réservation pour le moment."
              : `${reservations.length} réservation${reservations.length > 1 ? "s" : ""}. Libérer un créneau le remet aussitôt en ligne.`}
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-8">
        {[...parJour.entries()].map(([jour, liste]) => (
          <section key={jour}>
            <h2 className="eyebrow text-xd-violet-deep">{libelleJour(jour, "complet")}</h2>
            <ul className="mt-3 space-y-3">
              {liste.map((r) => (
                <li key={r.id} className="card rounded-xd-lg p-5">
                  <Fiche reservation={r} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Coque>
  );
}

function Fiche({ reservation: r }: { reservation: Reservation }) {
  const heure = (CRENEAUX as readonly string[]).includes(r.creneau)
    ? libelleHeure(r.creneau as Creneau)
    : r.creneau;
  const formule = FORMULES.find((f) => f.id === r.formule)?.nom ?? r.formule;
  const vehicule = VEHICULES.find((v) => v.id === r.vehicule)?.label ?? r.vehicule;
  const options = r.options.map((id) => OPTIONS.find((o) => o.id === id)?.nom ?? id);
  const tel = r.telephone.replace(/[\s.-]/g, "");

  return (
    <div className="grid gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-start">
      <p className="tabular text-2xl font-semibold leading-none text-xd-text sm:w-20">{heure}</p>

      <div className="min-w-0 text-sm">
        <p className="font-medium text-xd-text">
          {r.prenom} {r.nom}
          <span className="font-normal text-xd-text-3">
            {" "}
            · {formule} · {vehicule} · <span className="tabular">{euros(r.totalEuros)}</span>
          </span>
        </p>
        <p className="mt-1 text-xd-text-2">
          <a href={`tel:${tel}`} className="font-medium text-xd-violet-deep">
            {r.telephone}
          </a>{" "}
          ·{" "}
          <a href={`mailto:${r.email}`} className="text-xd-text-2 underline-offset-2 hover:underline">
            {r.email}
          </a>
        </p>
        <p className="mt-1 text-xd-text-2">
          {r.adresse}, {r.codePostal} {r.ville}
        </p>
        {options.length > 0 && (
          <p className="mt-1 text-xd-text-3">Options : {options.join(", ")}</p>
        )}
        {r.precisions && <p className="mt-1 text-xd-text-3">Précisions : {r.precisions}</p>}
        {r.message && <p className="mt-1 text-xd-text-3">Message : {r.message}</p>}
        <p className="mt-2 text-xs text-xd-text-4">
          Référence {r.id} · réservé le{" "}
          {new Date(r.creeLe).toLocaleString("fr-FR", {
            timeZone: "Europe/Paris",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      <BoutonLiberer id={r.id} libelle={`le ${heure}`} />
    </div>
  );
}

function Coque({ children, deconnexion }: { children: ReactNode; deconnexion?: boolean }) {
  return (
    <div className="min-h-dvh bg-xd-bg-2">
      <header className="hairline-b bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
          <span className="flex items-center gap-2.5">
            <Image src="/marque/x-mark.png" alt="" width={512} height={364} className="h-5 w-auto" />
            <span className="eyebrow text-xd-text-2">Gestion</span>
          </span>
          {deconnexion && <BoutonDeconnexion />}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">{children}</main>
    </div>
  );
}

function Message({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className="card rounded-xd-xl p-6">
      <p className="text-lg font-semibold text-xd-text">{titre}</p>
      <p className="mt-2 text-sm leading-relaxed text-xd-text-2">{children}</p>
    </div>
  );
}
