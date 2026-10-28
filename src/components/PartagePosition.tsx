"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Partage de position pendant le trajet.
 *
 * LIMITE À CONNAÎTRE : un navigateur cesse d'émettre dès que l'écran se
 * verrouille ou que l'onglet passe en arrière-plan. Le suivi fonctionne donc
 * tant que l'opérateur garde cette page ouverte — ce qui couvre le moment où
 * le client regarde, mais ne remplace pas une application mobile.
 *
 * L'état est affiché franchement plutôt que masqué : un suivi qu'on croit
 * actif et qui ne l'est pas est pire que pas de suivi du tout.
 */
const INTERVALLE_MS = 15_000;

type Etat = "demande" | "actif" | "refuse" | "indisponible" | "erreur";

export default function PartagePosition({ rendezVousId }: { rendezVousId: string }) {
  const [etat, setEtat] = useState<Etat>("demande");
  const [dernierEnvoi, setDernierEnvoi] = useState<Date | null>(null);
  const dernier = useRef(0);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      // Reporté d'un tour : React interdit de changer l'état en plein corps
      // d'effet, ce qui déclencherait un rendu en cascade. Le délai nul suffit
      // à sortir de la passe de rendu en cours.
      const report = setTimeout(() => setEtat("indisponible"), 0);
      return () => clearTimeout(report);
    }

    const veille = navigator.geolocation.watchPosition(
      async (position) => {
        setEtat("actif");
        // On n'envoie qu'une position toutes les quinze secondes : le
        // navigateur en produit bien davantage, et chacune est une écriture
        // en base.
        const maintenant = Date.now();
        if (maintenant - dernier.current < INTERVALLE_MS) return;
        dernier.current = maintenant;

        const res = await fetch(`/api/operateur/rendez-vous/${rendezVousId}/position`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        }).catch(() => null);

        if (res?.ok) setDernierEnvoi(new Date());
        else if (res) setEtat("erreur");
      },
      (erreur) => setEtat(erreur.code === erreur.PERMISSION_DENIED ? "refuse" : "erreur"),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );

    return () => navigator.geolocation.clearWatch(veille);
  }, [rendezVousId]);

  const message: Record<Etat, string> = {
    demande: "Localisation en cours d'activation…",
    actif: dernierEnvoi
      ? `Position partagée — dernier envoi à ${dernierEnvoi.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
      : "Position partagée avec le client.",
    refuse: "Localisation refusée : le client ne vous verra pas approcher. Autorisez-la dans les réglages du navigateur.",
    indisponible: "Ce navigateur ne sait pas partager la position.",
    erreur: "Position momentanément indisponible.",
  };

  const couleur = etat === "actif" ? "var(--success)" : etat === "demande" ? "var(--muted)" : "var(--danger)";

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3 flex flex-col gap-1">
      <p className="text-xs font-medium" style={{ color: couleur }}>
        {message[etat]}
      </p>
      <p className="text-xs text-[var(--muted)]">
        Gardez cette page ouverte pendant le trajet : le partage s&apos;arrête si l&apos;écran se verrouille.
      </p>
    </div>
  );
}
