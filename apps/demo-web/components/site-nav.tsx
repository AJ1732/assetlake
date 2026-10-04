"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/playground", label: "Playground" },
  { href: "/live", label: "Live" },
  { href: "/architecture", label: "Architecture" },
  { href: "/docs", label: "Docs" },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="site-nav">
      <ul>
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={pathname.startsWith(link.href) ? "page" : undefined}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
