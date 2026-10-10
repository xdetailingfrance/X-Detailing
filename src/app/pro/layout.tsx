import { DemoRibbon } from "@/components/demo-ribbon";
import Image from "next/image";
import Link from "next/link";
import { requireOperator } from "@/lib/auth/guard";
import { signOut } from "@/app/connexion/actions";

export const metadata = { title: "X Detailing Pro" };

/**
 * PWA opérateur (§32).
 *
 * Utilisée debout, à une main, souvent dehors : cibles tactiles larges, une seule action
 * principale à l'écran, contraste élevé.
 */
export default async function ProLayout({ children }: LayoutProps<"/pro">) {
  const operator = await requireOperator();

  return (
    <div className="flex min-h-dvh flex-col bg-night-950 text-chrome-100 [color-scheme:light]">
      <header className="sticky top-0 z-20 border-b border-night-700 bg-night-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <Link href="/pro" className="flex items-center gap-2.5" aria-label="Ma journée">
            <Image src="/marque/x-mark.png" alt="" width={512} height={364} priority className="h-6 w-auto" />
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.26em] text-chrome-300">
              Pro
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-sm text-chrome-400">{operator.name}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-night-600 px-3 py-1.5 text-xs text-chrome-400 transition hover:text-chrome-100"
              >
                Quitter
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-5">{children}</main>
      <DemoRibbon />
    </div>
  );
}
