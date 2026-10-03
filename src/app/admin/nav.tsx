"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { IconChevron } from "@/components/icons";

/**
 * §40 — état actif discret : un filet violet et un contraste typographique, jamais un
 * aplat plein derrière l'élément courant.
 */
export function NavLink({
  href,
  exact = false,
  children,
}: {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-2.5 rounded-[--radius-xd-xs] px-3 py-2 text-meta transition-colors duration-150 ${
        active
          ? "bg-white/[0.05] font-medium text-xd-text"
          : "text-xd-text-3 hover:bg-white/[0.03] hover:text-xd-text-2"
      }`}
    >
      {active && (
        <span
          aria-hidden
          className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-xd-purple-bright"
        />
      )}
      <span className={active ? "text-xd-purple-bright" : "text-xd-text-4 group-hover:text-xd-text-3"}>
        {Array.isArray(children) ? children[0] : null}
      </span>
      <span className="truncate">{Array.isArray(children) ? children[1] : children}</span>
    </Link>
  );
}

type Section = { label: string; items: Array<{ href: string; label: string }> };

/** Navigation mobile : feuille glissante plutôt qu'un menu déroulant (§45). */
export function NavToggle({ sections }: { sections: Section[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const current =
    sections.flatMap((s) => s.items).find((i) => i.href !== "/admin" && pathname.startsWith(i.href))
      ?.label ?? "Tableau de bord";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press inline-flex items-center gap-1.5 rounded-[--radius-xd-xs] bg-white/[0.06] px-3 py-1.5 text-meta text-xd-text-2"
      >
        {current}
        <IconChevron className="size-3.5 rotate-90" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
          />
          <div className="m-smoked absolute inset-x-2 bottom-2 max-h-[80dvh] overflow-y-auto rounded-[--radius-xd-xl] p-4">
            {sections.map((section) => (
              <div key={section.label} className="mb-4 last:mb-0">
                <p className="eyebrow px-2 pb-1.5 text-xd-text-4">{section.label}</p>
                <ul>
                  {section.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="block rounded-[--radius-xd-xs] px-3 py-2.5 text-body text-xd-text-2 active:bg-white/[0.05]"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
