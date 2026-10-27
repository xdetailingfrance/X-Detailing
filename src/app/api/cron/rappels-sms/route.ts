import { NextResponse } from "next/server";
import { demainParis, envoyerRappels } from "@/lib/sms";

// Rappels SMS de la veille, déclenchés chaque soir par Vercel Cron (voir
// vercel.json). Vercel envoie « Authorization: Bearer <CRON_SECRET> » : sans
// CRON_SECRET configuré, la route reste fermée pour qu'on ne puisse pas
// déclencher des envois en masse depuis l'extérieur.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET non configuré" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const envoyes = await envoyerRappels(demainParis(), "automatique");
  return NextResponse.json({ envoyes: envoyes.length });
}

