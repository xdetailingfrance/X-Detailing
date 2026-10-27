"use client";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
      <p className="text-[var(--muted)] max-w-lg text-sm">
        Si cette erreur apparaît sur toutes les pages qui affichent des données (tableau de bord,
        planning, espace opérateur…), la cause la plus probable est que la base de données n&apos;est
        pas accessible ou que les migrations Prisma n&apos;ont pas été appliquées : vérifier la
        variable <code>DATABASE_URL</code> et les logs de build sur Vercel (étape{" "}
        <code>prisma migrate deploy</code>).
      </p>
      {error.message && (
        <pre className="max-w-lg overflow-x-auto rounded-md bg-[var(--surface)] border border-[var(--border)] p-3text-left text-xs text-[var(--danger)]">
          {error.message}
        </pre>
      )}
      <button
        onClick={reset}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)] transition"
      >
        Réessayer
      </button>
    </div>
    );
}

