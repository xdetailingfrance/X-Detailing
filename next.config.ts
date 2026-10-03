import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Un package-lock.json existe plus haut dans l'arborescence de l'utilisateur :
  // sans cette racine explicite, Turbopack remonte trop loin pour inférer le projet.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
