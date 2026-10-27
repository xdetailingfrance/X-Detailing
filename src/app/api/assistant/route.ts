import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/session";
import { demanderLola, planningSemaine, prenomInterlocuteur, repondreLocalement, type MessageLola } from "@/lib/lola";

const NB_MESSAGES_MAX = 20;
const LONGUEUR_MAX = 2000;

// Assistante vocale Lola (écran d'accueil du back-office). Réservé OWNER / COMMERCIAL : le
// middleware ferme déjà /api/* aux comptes purement OPERATEUR, revérifié
// ici (défense en profondeur). Les montants ne sont exposés qu'à l'OWNER
// (voir planningSemaine dans src/lib/lola.ts).
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (session.role === "OPERATEUR" || session.role === "COMPTABLE") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await request.json().catch(() => null);
    const brut: unknown[] = Array.isArray(body?.messages) ? body.messages : [];
    const messages: MessageLola[] = brut
      .filter(
        (m): m is MessageLola =>
          typeof m === "object" &&
          m !== null &&
          ((m as MessageLola).role === "user" || (m as MessageLola).role === "assistant") &&
          typeof (m as MessageLola).content === "string" &&
          (m as MessageLola).content.trim() !== ""
      )
      .map((m) => ({ role: m.role, content: m.content.slice(0, LONGUEUR_MAX) }))
      .slice(-NB_MESSAGES_MAX);
    // L'API attend un échange qui commence par l'utilisateur et se termine
    // par sa question.
    while (messages.length && messages[0].role !== "user") messages.shift();
    if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
      return NextResponse.json({ error: "Question manquante" }, { status: 400 });
    }

    try {
      return NextResponse.json(await demanderLola(messages, session));
    } catch (error) {
      // Claude indisponible (clé invalide, quota...) : Lola reste utilisable
      // avec le moteur local plutôt que de rester muette.
      if (!(error instanceof Anthropic.APIError)) throw error;
      console.error("Lola : appel Claude en échec", error.status, error.message);
      const segments = repondreLocalement(
        messages[messages.length - 1].content,
        await planningSemaine(session),
        await prenomInterlocuteur(session)
      );
      return NextResponse.json({ segments, mode: "local", modifie: false, memoire: null });
    }
}

