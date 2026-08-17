"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function BackofficeShell({
  brand,
  subtitle,
  nav,
  badge,
  children,
}: {
  brand: string;
  subtitle: string;
  nav: { href: string; label: string }[];
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex bg-cream-light">
      <aside className="w-64 shrink-0 bg-dark text-cream-light flex flex-col">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-serif">
              {brand.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <p className="font-serif text-base leading-tight">{brand}</p>
              <p className="text-[11px] text-cream-light/50">{subtitle}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-4 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-white/10 text-cream-light font-medium"
                    : "text-cream-light/60 hover:text-cream-light hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleSignOut}
            className="w-full text-left text-sm text-cream-light/60 hover:text-cream-light px-4 py-2"
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        {badge}
        <main className="p-8 md:p-10">{children}</main>
      </div>
    </div>
  );
}
