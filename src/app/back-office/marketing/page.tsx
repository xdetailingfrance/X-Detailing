import ModuleAVenir from "@/components/backoffice/ModuleAVenir";

export default function MarketingPage() {
  return (
    <ModuleAVenir
      titre="Marketing et rentabilité publicitaire"
      phase="Phase 4"
      fonctions={[
        "Dépenses, impressions, clics et leads venant de Meta, séparés des données du CRM.",
        "Coût par lead, devis et réservations générés, chiffre d'affaires associé, coût d'acquisition client.",
        "Rentabilité publicitaire présentée comme estimée tant que l'attribution reste incertaine."
      ]}
      aConfigurer={["La connexion Meta (voir Leads Meta Ads) avec la permission ads_read sur le compte publicitaire."]}
      enAttendant={[{"libelle": "Vue d'ensemble", "href": "/back-office"}]}
    />
  );
}

