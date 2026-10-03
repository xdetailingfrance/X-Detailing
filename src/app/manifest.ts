import type { MetadataRoute } from "next";

/**
 * Manifeste PWA (§32) — l'application opérateur s'installe sur l'écran d'accueil.
 *
 * `start_url` pointe sur l'agenda : un opérateur qui lance l'app veut voir sa journée,
 * pas une page d'accueil commerciale.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "X Detailing Pro",
    short_name: "XD Pro",
    description: "Agenda, itinéraires et prestations des opérateurs X Detailing.",
    start_url: "/pro",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    lang: "fr",
    icons: [
      { src: "/marque/icone-180.png", sizes: "180x180", type: "image/png", purpose: "any" },
      { src: "/marque/icone-32.png", sizes: "32x32", type: "image/png", purpose: "any" },
    ],
  };
}
