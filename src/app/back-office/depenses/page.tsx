import ModuleAVenir from "@/components/backoffice/ModuleAVenir";

export default function DepensesPage() {
  return (
    <ModuleAVenir
      titre="Dépenses"
      phase="Phase 7"
      fonctions={[
        "Saisie d'une dépense en quelques secondes : date, fournisseur, catégorie, HT, TVA, TTC, moyen de paiement, commentaire.",
        "Photo ou PDF de la facture fournisseur joints.",
        "Tableau filtrable par mois, catégorie et fournisseur."
      ]}
      aConfigurer={["Un stockage de fichiers (Vercel Blob ou S3) pour les justificatifs."]}
      enAttendant={[{"libelle": "Dépenses du mois (saisie globale actuelle)", "href": "/back-office/finances"}]}
    />
  );
}

