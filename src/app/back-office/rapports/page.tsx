import ModuleAVenir from "@/components/backoffice/ModuleAVenir";

export default function RapportsPage() {
  return (
    <ModuleAVenir
      titre="Rapports"
      phase="Phase 7"
      fonctions={[
        "Rapports mensuels : chiffre d'affaires, encaissements, dépenses, rentabilité par opérateur et par camionnette.",
        "Exports CSV, Excel et PDF ; format compatible avec le logiciel de l'expert-comptable.",
        "Compte rendu de fin de journée préparé par Lola."
      ]}
      aConfigurer={["Le format d'import accepté par le logiciel de votre expert-comptable."]}
      enAttendant={[{"libelle": "Vue d'ensemble", "href": "/back-office"}, {"libelle": "Comptabilité", "href": "/back-office/finances"}]}
    />
  );
}

