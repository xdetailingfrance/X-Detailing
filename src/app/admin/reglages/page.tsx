import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/guard";
import { getAssignmentSettings } from "@/server/settings";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Réglages du moteur · X Detailing OS" };

export default async function SettingsPage() {
  await requireAdmin();
  const settings = await getAssignmentSettings();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Réglages du moteur d'affectation"
        lead="Ces valeurs prennent effet immédiatement, sans redéploiement. Elles sont journalisées à chaque modification (§30)."
      />

      <SettingsForm settings={settings} />
    </div>
  );
}
