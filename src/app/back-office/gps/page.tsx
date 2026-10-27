import ModuleAVenir from "@/components/backoffice/ModuleAVenir";

export default function GpsPage() {
  return (
    <ModuleAVenir
      titre="Suivi GPS et déplacements"
      phase="Phase 6"
      fonctions={[
        "Bouton « Démarrer la course » : départ enregistré, SMS au client avec un lien de suivi.",
        "Carte en direct de la position réelle des opérateurs, heure d'arrivée estimée recalculée.",
        "Lien de suivi client sécurisé et temporaire, dernière position connue en cas de perte du signal.",
        "Historique des trajets professionnels : distance, durée, interruptions."
      ]}
      aConfigurer={["Un compte de cartographie (Mapbox ou Google Maps) pour la carte, les itinéraires et les temps de trajet.", "L'application mobile opérateur (comptes Apple Developer et Google Play) : une page web ne peut pas envoyer la position quand le téléphone est verrouillé.", "L'information des opérateurs sur la collecte de leurposition (règles de géolocalisation des salariés)."]}
      enAttendant={[{"libelle": "Planning", "href": "/back-office/planning"}]}
    />
  );
}

