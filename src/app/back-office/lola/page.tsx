import { getSession } from "@/lib/session";
import { prenomInterlocuteur } from "@/lib/lola";
import LolaAccueil from "@/components/lola/LolaAccueil";
import { EnTete } from "@/components/backoffice/ui";

export const dynamic = "force-dynamic";

// Lola en plein écran : elle répond avec les données réelles du
// back-office, dans la limite des droits de la personne qui lui parle.
export default async function LolaPage() {
  const session = await getSession();
  const prenom = session ? await prenomInterlocuteur(session) : null;
  return (
    <div className="flex flex-col gap-6">
      <EnTete
        titre="Lola IA"
        sousTitre={
          process.env.ANTHROPIC_API_KEY
            ? "Dites « Lola » ou appuyez sur le micro. Elle consulte le planning, les clients, les devis et agitaprès votre confirmation."
            : "Sans clé ANTHROPIC_API_KEY, Lola répond seulement sur le planning avec son moteur intégré."
        }
      />
      <LolaAccueil prenom={prenom} />
    </div>
  );
}

