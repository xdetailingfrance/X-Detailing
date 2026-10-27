import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listerRendezVousAvecRelations } from "@/lib/queries";
import { dateParis, debutSemaineParis, decalerJour, formatParis, jourParis } from "@/lib/heure";

export const dynamic = "force-dynamic";

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

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

// « MA SEMAINE » — règle absolue n°4 du cahier des charges : l'opérateur
// voit le nombre de RDV placés, jamais son CA. Tout est scopé côté serveur
// sur session.operateurId, jamais sur une valeur envoyée par le client.
export default async function EspaceOperateurPage() {
  const session = await getSession();
  if (!session?.operateurId) redirect("/login");

   const lundi = jourParis(debutSemaineParis(new Date()));
   const rendezVous = await listerRendezVousAvecRelations({
     operateurId: session.operateurId,
     statut: { not: "ANNULE" },
     dateHeure: { gte: dateParis(lundi), lt: dateParis(decalerJour(lundi, 7)) },
   });

   const parJour: { date: Date; rdv: typeof rendezVous }[] = JOURS.map((_, index) => ({
     date: dateParis(decalerJour(lundi, index), "12:00"),
     rdv: [],
   }));
   for (const r of rendezVous) {
     const jour = jourParis(r.dateHeure);
     const index = parJour.findIndex((j) => jourParis(j.date) === jour);
     if (index >= 0) parJour[index].rdv.push(r);
   }

   return (
     <div className="flex flex-col gap-8 max-w-3xl">
       <div>
         <h1 className="text-2xl font-semibold">Ma semaine</h1>
         <p className="text-4xl font-bold text-[var(--accent)] mt-2">
           {rendezVous.length} RDV DÉJÀ PLANIFIÉS
         </p>
       </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {parJour.map(({ date, rdv }) => (
            <div key={date.toISOString()} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
              <p className="text-xs text-[var(--muted)] uppercase tracking-wide">
                {JOURS[parJour.findIndex((j) => j.date === date)]}
              </p>
              <p className="text-xl font-semibold">{rdv.length} RDV</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-6">
          {parJour
            .filter(({ rdv }) => rdv.length > 0)
            .map(({ date, rdv }) => (
              <div key={date.toISOString()}>
                <h2 className="text-lg font-medium mb-2">
                  {formatParis(date, { weekday: "long", day: "numeric", month: "long" })}
                </h2>
                <div className="flex flex-col gap-2">
                  {rdv.map((r) => {
                    const resteAPayer = Number(r.prixTotal) - Number(r.acompte);
                    return (
                      <Link
                        key={r.id}
                      href={`/operateur/rendez-vous/${r.id}`}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm flex flex-col gap-1 hover:bg-[var(--surface-2)] transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {formatParis(r.dateHeure, { hour: "2-digit", minute: "2-digit" })}
                          {" — "}
                          {r.client.prenom} {r.client.nom}
                        </span>
                        <span className="text-xs text-[var(--muted)]">{LIBELLE_STATUT[r.statut]}</span>
                      </div>
                      <p className="text-[var(--muted)]">
                        {r.adresse.adresse}, {r.adresse.ville}
                      </p>
                      <p className="text-[var(--muted)]">
                        {r.vehicule.marque ?? r.categorieVehicule} {r.vehicule.modele ?? ""} ({r.categorieVehicule}) ·{" "}
                        {r.pack.nom}
                        {r.options.length > 0 ? ` + ${r.options.map((o) => o.option.nom).join(", ")}` : ""} ·{""}
                        {r.dureeMinutes} min
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-[var(--accent)]">Ouvrir le suivi de prestation →</span>
                        <span className="text-sm font-medium">Reste à payer : {resteAPayer.toFixed(2)} €</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        {rendezVous.length === 0 && (
          <p className="text-[var(--muted)] text-sm">Aucun rendez-vous cette semaine.</p>
        )}
      </div>
    </div>
  );
}

