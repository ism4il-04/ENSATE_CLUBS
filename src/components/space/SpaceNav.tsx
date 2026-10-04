"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";

export type SpaceLink = { href: string; label: string; icon: IconName; exact?: boolean; tag?: string };

export function SpaceNav({ links, label }: { links: SpaceLink[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1">
      {links.map((l) => {
        const on = l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={on ? "page" : undefined}
            className={`flex h-11 flex-[1_1_150px] items-center gap-2.5 rounded-xl px-3 text-sm transition-colors ${
              on ? "bg-paper font-extrabold text-ink" : "font-semibold text-paper hover:bg-surface-2"
            }`}
          >
            <Icon name={l.icon} />
            <span className="flex-1">{l.label}</span>
            {l.tag && <span className="rounded-full border border-line-strong px-1.5 py-0.5 text-[11px] font-extrabold">{l.tag}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
