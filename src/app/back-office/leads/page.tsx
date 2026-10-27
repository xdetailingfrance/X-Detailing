import ModuleAVenir from "@/components/backoffice/ModuleAVenir";

export default function LeadsPage() {
  return (
    <ModuleAVenir
      titre="Leads Meta Ads"
      phase="Phase 4"
      fonctions={[
        "Réception automatique des formulaires publicitaires Meta par webhook, avec reprise en cas d'échec.",
        "Campagne, ensemble de publicités, publicité, formulaire et réponses enregistrés sur chaque lead.",
        "Détection des doublons avec les clients et prospects existants."
      ]}
      aConfigurer={["Une application Meta validée (permissions leads_retrieval, pages_manage_metadata, ads_read).", "Le jeton d'accès de la page Facebook X Detailing.", "Les variables META_APP_SECRET et META_VERIFY_TOKEN."]}
      enAttendant={[{"libelle": "Clients", "href": "/back-office/clients"}]}
    />
  );
}

