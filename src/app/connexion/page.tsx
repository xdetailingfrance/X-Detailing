import Image from "next/image";
import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion · X Detailing OS" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-xd-void px-4 py-10">
      {/*
        §54 — une lumière de studio qui vient d'en haut à gauche, pas une nappe violette
        centrée derrière le formulaire : cette dernière est la signature visuelle des
        applications crypto, et le §58 l'exclut explicitement.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_20%_0%,rgb(123_60_255/0.14),transparent_70%)]"
      />

      <div className="relative w-full max-w-sm">
        <div className="relative">
          <div className="mb-8 flex flex-col items-center text-center">
            <Image
              src="/marque/logo-x-detailing.png"
              alt="X Detailing"
              width={800}
              height={648}
              priority
              className="h-20 w-auto"
            />
            <p className="font-display mt-5 text-lg font-bold tracking-tight text-xd-text">
              Système d&apos;exploitation
            </p>
            <p className="mt-0.5 text-meta text-xd-text-3">Pilotage du réseau</p>
          </div>

          {erreur === "acces" && (
            <p className="mb-4 rounded-[--radius-xd-sm] bg-xd-warn/12 px-3.5 py-2.5 text-meta text-xd-warn [box-shadow:inset_0_0_0_1px_rgb(223_164_69/0.24)]">
              Votre compte n&apos;a pas accès à cette partie du système.
            </p>
          )}

          <LoginForm />
        </div>
      </div>
    </main>
  );
}
