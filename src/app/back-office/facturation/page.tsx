import ModuleAVenir from "@/components/backoffice/ModuleAVenir";

export default function FacturationPage() {
  return (
    <ModuleAVenir
      titre="Facturation"
      phase="Phase 7"
      fonctions={[
        "Facture générée à la clôture d'une prestation : numéro unique, mentions légales, HT, TVA, TTC, règlement.",
        "Envoi par e-mail ou lien SMS, PDF téléchargeable.",
        "Avoirs, annulations, remboursements, factures impayées ; aucune facture supprimée en silence.",
        "Paiements carte (lien de paiement Stripe), espèces avec contrôle de caisse, paiements partiels."
      ]}
      aConfigurer={["Les informations légales de X Detailing (raison sociale, SIREN, adresse, TVA intracommunautaire).", "Le régime de TVA applicable.", "Un service d'e-mail (Resend ou Brevo) pour l'envoi des factures."]}
      enAttendant={[{"libelle": "Comptabilité", "href": "/back-office/finances"}]}
    />
  );
}

