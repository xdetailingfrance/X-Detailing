import { notFound } from "next/navigation";
import { dureeLisible, formatParis, heureParis, jourParis } from "@/lib/heure";
import { rendezVousAvecRelations } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { suppressionDefinitivePossible } from "@/lib/rendezVous";
import AffectationPanel from "./AffectationPanel";
import GestionPanel from "./GestionPanel";

const LIBELLE_STATUT: Record<string, string> = {
  EN_ATTENTE: "En attente",
  CONFIRME: "Confirmé",
  EN_ROUTE: "En route",
  ARRIVE: "Arrivé",
  CONTROLE: "Contrôle & signature",
  PHOTOS_AVANT: "Photos avant",
  LAVAGE: "Prestation en cours",
  PHOTOS_APRES: "Photos après",
  PAIEMENT: "Paiement",
  EN_COURS: "En cours",
  TERMINE: "Terminé",
  ANNULE: "Annulé",
};

export default async function RendezVousPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rendezVous = await rendezVousAvecRelations(id);
  if (!rendezVous) notFound();
  const session = await getSession();

    // nbPrestationsJour/caJour ne sont pas persistés (uniquement calculés à la
    // volée par le moteur d'affectation) : absents tant que le bouton
    // « TROUVER LE MEILLEUR OPÉRATEUR » n'a pas été recliqué sur cette page.
    const candidatsInitiaux = rendezVous.candidatures.map((c) => ({
      operateurId: c.operateurId,
      nomComplet: `${c.operateur.prenom} ${c.operateur.nom}`,
      secteurNom: c.operateur.secteur?.nom ?? null,
      score: c.score,
      distanceKm: c.distanceKm,
      etaMinutes: c.etaMinutes,
      nbPrestationsJour: undefined as number | undefined,
      caJour: undefined as number | undefined,
    }));

    return (
      <div className="flex flex-col gap-6 max-w-2xl">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">
            Rendez-vous — {rendezVous.client.prenom} {rendezVous.client.nom}
          </h1>
          <p className="text-[var(--muted)] text-sm mt-1">
            {formatParis(rendezVous.dateHeure, { dateStyle: "long", timeStyle: "short" })}{" "}
            · {LIBELLE_STATUT[rendezVous.statut]}
          </p>
        </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 grid grid-cols-2 gap-4 text-sm">
        <Info titre="Client" valeur={`${rendezVous.client.prenom} ${rendezVous.client.nom} · ${rendezVous.client.telephone}`} />
        <Info titre="Adresse" valeur={`${rendezVous.adresse.adresse}, ${rendezVous.adresse.ville}`} />
        <Info titre="Véhicule" valeur={`${rendezVous.vehicule.marque ?? rendezVous.categorieVehicule} ${rendezVous.vehicule.modele ?? ""}`} />
        <Info titre="Pack" valeur={`${rendezVous.pack.nom} (${dureeLisible(rendezVous.dureeMinutes)})`} />
        <Info
          titre="Options"
          valeur={rendezVous.options.length > 0 ? rendezVous.options.map((o) => (o.quantite > 1 ? `${o.option.nom} × ${o.quantite}` : o.option.nom)).join(", ") : "Aucune"}
        />
        <Info titre="Prix total" valeur={`${rendezVous.prixTotal} €`} />
        <Info
          titre="Acompte"
          valeur={`${rendezVous.acompte} € · ${
            rendezVous.acompteStatut === "PAYE"
                  ? "payé en ligne (Stripe)"
                  : rendezVous.acompteStatut === "EN_ATTENTE_PAIEMENT"
                    ? "paiement en ligne en cours"
                    : "non payé en ligne"
               }`}
             />
             <Info
               titre="Opérateur affecté"
               valeur={rendezVous.operateur ? `${rendezVous.operateur.prenom} ${rendezVous.operateur.nom}` : "Non affecté"}
          />
          <Info titre="Lien de suivi client" valeur={`/suivi/${rendezVous.suiviToken}`} />
        </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
        <p className="text-xs text-[var(--muted)] uppercase tracking-wide mb-2">Historique</p>
        <ul className="flex flex-col gap-1">
          {[...rendezVous.historique].reverse().map((h, i) => (
            <li key={i}>
              <span className="text-[var(--muted)]">{formatParis(h.horodatage, { dateStyle: "short", timeStyle:"short" })}</span> — {h.libelle}
            </li>
          ))}
        </ul>
      </div>

        <AffectationPanel
          rendezVousId={rendezVous.id}
          operateurActuelId={rendezVous.operateurId}
          candidatsInitiaux={candidatsInitiaux}
        />

        <GestionPanel
          rendezVousId={rendezVous.id}
          packId={rendezVous.packId}
          jourActuel={jourParis(rendezVous.dateHeure)}
          heureActuelle={heureParis(rendezVous.dateHeure)}
          statut={rendezVous.statut}
          suppressionPossible={suppressionDefinitivePossible(rendezVous)}
          peutSupprimer={session?.role === "OWNER" || session?.role === "RESPONSABLE"}
        />
      </div>
    );
}

function Info({ titre, valeur }: { titre: string; valeur: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--muted)] uppercase tracking-wide">{titre}</p>
      <p>{valeur}</p>
    </div>
  );
}

