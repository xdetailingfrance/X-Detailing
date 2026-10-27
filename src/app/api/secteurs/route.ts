import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  return NextResponse.json(await db.secteur.findMany({ orderBy: { nom: "asc" } }));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.nom) {
    return NextResponse.json({ error: "nom requis" }, { status: 400 });
  }
  const secteur = await db.secteur.create({ data: { nom: String(body.nom), ville: body.ville ? String(body.ville): null } });
  return NextResponse.json(secteur, { status: 201 });
}

