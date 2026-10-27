import ModuleAVenir from "@/components/backoffice/ModuleAVenir";

export default function CrmPage() {
  return (
    <ModuleAVenir
      titre="Commercial et CRM"
      phase="Phase 4"
      fonctions={[
        "Pipeline des prospects : nouveau lead, à contacter, appel en cours, intéressé, devis envoyé, en attente,réservation confirmée, prestation terminée, perdu, à relancer.",
        "Déplacement des prospects d'une étape à l'autre, historique de chaque échange.",
        "Boutons rapides : appeler, SMS, envoyer un devis, tarifs, créer une réservation, note, relance programmée, fiche client.",
        "Statistiques de conversion par campagne, sans confondre leads et clients acquis."
      ]}
      aConfigurer={[]}
      enAttendant={[{"libelle": "Clients", "href": "/back-office/clients"}, {"libelle": "Devis", "href": "/back-office/devis"}]}
    />
  );
}

