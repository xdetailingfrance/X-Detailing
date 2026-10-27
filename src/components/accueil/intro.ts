// Partagé entre la page (serveur, script en tête) et IntroLogo (client) :
// une constante exportée d'un module "use client" n'est pas lisible côté
// serveur.
export const CLE_INTRO = "x-detailing-intro-vue";

