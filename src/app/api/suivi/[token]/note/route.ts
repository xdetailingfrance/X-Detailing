import { NextResponse } from "next/server";
import { rendezVousParToken } from "@/lib/workflow";
import { db } from "@/lib/db";

// Endpoint public (jeton non deviné, voir /suivi/[token]) : le client note
// sa prestation une seule fois, uniquement une fois le RDV clôturé.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rdv = await rendezVousParToken(token);
  if (!rdv) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }
  if (rdv.statut !== "TERMINE") {
    return NextResponse.json({ error: "La prestation n'est pas encore clôturée." }, { status: 400 });
  }
  if (rdv.noteClient != null) {
    return NextResponse.json({ error: "Une note a déjà été envoyée." }, { status: 400 });
  }

    const body = await request.json().catch(() => null);
    const note = Number(body?.note);
    if (!Number.isInteger(note) || note < 1 || note > 5) {
      return NextResponse.json({ error: "note invalide" }, { status: 400 });
    }

    // Écriture conditionnelle : une seule note, même en cas de double envoi.
    const resultat = await db.rendezVous.updateMany({
      where: { id: rdv.id, noteClient: null },
      data: { noteClient: note, noteClientAt: new Date(), version: { increment: 1 } },
    });
    if (resultat.count === 0) return NextResponse.json({ error: "Une note a déjà été envoyée." }, { status: 400 });

    return NextResponse.json({ ok: true });
}

