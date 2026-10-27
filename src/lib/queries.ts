// Lectures avec relations, partagées par les pages et les routes.
import type { Prisma } from "@/generated/prisma/client";
import { db, sansDecimal, versDevis, versRdv } from "@/lib/db";

const INCLUDE_CLIENT = { adresses: { orderBy: { createdAt: "asc" } }, vehicules: { orderBy: { createdAt: "asc" }} } satisfies Prisma.ClientInclude;

export async function clientAvecRelations(id: string) {
  return db.client.findUnique({ where: { id }, include: INCLUDE_CLIENT });
}

export async function listerClientsAvecRelations() {
  return db.client.findMany({ include: INCLUDE_CLIENT, orderBy: { createdAt: "desc" } });
}

export type ClientComplet = NonNullable<Awaited<ReturnType<typeof clientAvecRelations>>>;

export async function packAvecTarifs(packId: string) {
  const pack = await db.pack.findUnique({ where: { id: packId }, include: { tarifs: true } });
  return pack ? sansDecimal(pack) : null;
}

export async function listerPacksAvecTarifs() {
  const packs = await db.pack.findMany({ where: { actif: true }, include: { tarifs: true }, orderBy: { createdAt:"asc" } });
  return sansDecimal(packs);
}

export async function listerOptionsActives() {
  return sansDecimal(await db.option.findMany({ where: { actif: true }, orderBy: [{ ordre: "asc" }, { createdAt:"asc" }] }));
}

const INCLUDE_RDV = {
  client: true,
  vehicule: true,
  adresse: true,
  pack: true,
  secteur: true,
  operateur: true,
  options: { include: { option: true } },
  candidatures: { orderBy: { rang: "asc" }, include: { operateur: { include: { secteur: true } } } },
} satisfies Prisma.RendezVousInclude;

export async function rendezVousAvecRelations(id: string) {
  const rdv = await db.rendezVous.findUnique({ where: { id }, include: INCLUDE_RDV });
  return rdv ? versRdv(rdv) : null;
}

export async function listerRendezVousAvecRelations(where: Prisma.RendezVousWhereInput = {}) {
  const rdvs = await db.rendezVous.findMany({ where, include: INCLUDE_RDV, orderBy: { dateHeure: "asc" } });
  return rdvs.map(versRdv);
}

export type RdvComplet = NonNullable<Awaited<ReturnType<typeof rendezVousAvecRelations>>>;

// L'utilisateur auteur du devis est réduit aux champs d'affichage : jamais
// le hash du mot de passe dans une réponse.
const INCLUDE_DEVIS = {
  pack: true,
  creePar: { select: { id: true, email: true, role: true } },
} satisfies Prisma.DevisInclude;

async function avecOptions<T extends { optionIds: string[] }>(devis: T) {
  const options = sansDecimal(await db.option.findMany({ where: { id: { in: devis.optionIds } } }));
  return { ...devis, options };
}

export async function devisAvecRelations(id: string) {
  const devis = await db.devis.findUnique({ where: { id }, include: INCLUDE_DEVIS });
  return devis ? avecOptions(versDevis(devis)) : null;
}

export async function listerDevisAvecRelations() {
  const devis = await db.devis.findMany({ include: INCLUDE_DEVIS, orderBy: { createdAt: "desc" } });
  return Promise.all(devis.map((d) => avecOptions(versDevis(d))));
}

export type DevisComplet = NonNullable<Awaited<ReturnType<typeof devisAvecRelations>>>;

