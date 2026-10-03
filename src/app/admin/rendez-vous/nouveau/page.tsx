import { PageHeader } from "@/components/ui";
import { prisma } from "@/server/db";
import { requireBackOffice } from "@/lib/auth/guard";
import { toLocalDateInput } from "@/server/time";
import { BookingForm, type BookingDefaults, type OptionDTO, type ServiceDTO } from "./booking-form";

export const metadata = { title: "Nouveau rendez-vous · X Detailing OS" };

/** Par défaut : le lendemain. Hors du corps de rendu — l'heure n'est pas une valeur pure. */
async function defaultBookingDate(): Promise<string> {
  return toLocalDateInput(new Date(Date.now() + 24 * 3600_000));
}

/**
 * §3 — « X Detailing doit pouvoir prendre un rendez-vous au téléphone à la place du
 * client, notamment à partir d'un lead Meta ».
 */
export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{
    client?: string; modele?: string; lead?: string;
    vehicule?: string; prestation?: string; options?: string;
  }>;
}) {
  await requireBackOffice();
  const { client, modele, lead: leadId, vehicule, prestation, options: optionParam } = await searchParams;

  const [services, options] = await Promise.all([
    prisma.service.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      include: { pricing: true, options: { select: { optionId: true } } },
    }),
    prisma.serviceOption.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  const serviceDtos: ServiceDTO[] = services.map((service) => ({
    id: service.id,
    name: service.name,
    kind: service.kind,
    optionIds: service.options.map((o) => o.optionId),
    pricing: Object.fromEntries(
      service.pricing.map((p) => [
        p.vehicleClass,
        { priceCents: p.priceCents, durationMin: p.durationMin },
      ]),
    ),
  }));

  const optionDtos: OptionDTO[] = options.map((o) => ({
    id: o.id,
    name: o.name,
    priceCents: o.priceCents,
    durationMin: o.durationMin,
  }));


  // §23 — « réservation en un clic : refaire la même prestation ». Le modèle fige ce
  // qu'on sait déjà ; le conseiller ne resaisit que la date et l'heure.
  const model = modele
    ? await prisma.appointment.findUnique({
        where: { id: modele },
        include: {
          customer: true,
          customerVehicle: true,
          options: { select: { optionId: true } },
        },
      })
    : null;

  const customer =
    model?.customer ??
    (client ? await prisma.customer.findUnique({ where: { id: client } }) : null);

  // §19 — le conseiller vient de raccrocher avec un lead Meta : ce qu'il a déjà est repris.
  const lead = leadId ? await prisma.lead.findUnique({ where: { id: leadId } }) : null;
  const [leadFirstName, ...leadRest] = (lead?.fullName ?? "").trim().split(/\s+/);

  // §3 — le conseiller arrive du devis express : la catégorie, la prestation et les
  // options sont déjà arbitrées, il ne reste que le client, l'adresse et le créneau.
  const quoted = Boolean(vehicule || prestation);
  const quotedOptionIds = optionParam ? optionParam.split(",").filter(Boolean) : [];

  const initial: Partial<BookingDefaults> | undefined =
    customer || model || lead || quoted
      ? {
          firstName: customer?.firstName ?? leadFirstName ?? "",
          lastName: customer?.lastName ?? customer?.companyName ?? leadRest.join(" "),
          phone: customer?.phone ?? lead?.phone ?? "",
          email: customer?.email ?? lead?.email ?? "",
          addressLine1: model?.addressLine1 ?? "",
          postalCode: model?.postalCode ?? "",
          city: model?.city ?? lead?.city ?? "",
          accessNotes: model?.accessNotes ?? "",
          vehicleClass: (vehicule as BookingDefaults["vehicleClass"]) ?? model?.vehicleClass,
          make: model?.customerVehicle?.make ?? "",
          model: model?.customerVehicle?.model ?? "",
          serviceId: prestation ?? model?.serviceId,
          optionIds: quotedOptionIds.length > 0
            ? quotedOptionIds
            : model?.options.map((o) => o.optionId) ?? [],
        }
      : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Nouveau rendez-vous"
        lead="Saisie téléphonique, puis affectation par le moteur. Le patron valide ou choisit un autre opérateur."
      />

      {initial && (
        // Le pré-remplissage se signale, mais ne se déguise pas en alerte : c'est une
        // information de contexte, pas un problème à traiter.
        <p className="rounded-[--radius-xd-md] px-4 py-3 text-meta text-xd-purple-bright m-purple">
          {lead
            ? `Pré-rempli depuis le lead ${lead.campaign ?? lead.source} — vérifiez l'adresse avec le client.`
            : customer || model
              ? `Pré-rempli depuis la fiche de ${initial.firstName} ${initial.lastName} — il ne reste que la date et l'heure à choisir.`
              : "Repris du devis express — il reste le client, l'adresse et le créneau."}
        </p>
      )}

      <BookingForm
        services={serviceDtos}
        options={optionDtos}
        defaultDate={await defaultBookingDate()}
        initial={initial}
        leadId={lead?.id ?? null}
      />
    </div>
  );
}
