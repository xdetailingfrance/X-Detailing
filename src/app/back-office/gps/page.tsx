import ModuleAVenir from "@/components/backoffice/ModuleAVenir";

export default function GpsPage() {
  return (
    <ModuleAVenir
      titre="Suivi GPS et déplacements"
      phase="Phase 6"
      fonctions={[
        "FAIT — « Démarrer la course » : l'opérateur partage sa position, le client la voit sur une carte avec le temps restant calculé par la route.",
        "Carte d'ensemble en direct de tous les opérateurs, pour le back-office.",
        "Suivi qui continue écran verrouillé : impossible depuis une page web, demande une application mobile.",
        "Historique des trajets professionnels : distance, durée, interruptions."
      ]}
      aConfigurer={["L'application mobile opérateur (comptes Apple Developer et Google Play) : une page web ne peut pas envoyer la position quand le téléphone est verrouillé.", "L'information des opérateurs sur la collecte de leur position (règles de géolocalisation des salariés).", "Aucun compte de cartographie n'est nécessaire : la Base Adresse Nationale et la Géoplateforme IGN sont gratuites et sans clé."]}
      enAttendant={[{"libelle": "Planning", "href": "/back-office/planning"}]}
    />
  );
}

