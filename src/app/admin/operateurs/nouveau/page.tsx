import { PageHeader } from "@/components/ui";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth/guard";
import { OperatorForm } from "./operator-form";

export const metadata = { title: "Nouvel opérateur · X Detailing OS" };

export default async function NewOperatorPage() {
  await requireAdmin();

  const [sectors, services] = await Promise.all([
    prisma.sector.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    prisma.service.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Nouvel opérateur"
        lead="Une fois activé, il apparaît automatiquement dans le moteur d'affectation et dans le planning (§28)."
      />

      <OperatorForm
        sectors={sectors.map((s) => ({ id: s.id, code: s.code, name: s.name }))}
        services={services.map((s) => ({ id: s.id, name: s.name }))}
      />
    </div>
  );
}
