"use client";

import { useEffect, useState } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // Closes the mobile drawer whenever navigation occurs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const brandBlock = (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-serif">
        {brand.slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="font-serif text-base leading-tight truncate">{brand}</p>
        <p className="text-[11px] text-cream-light/50">{subtitle}</p>
      </div>
    </div>
  );

  const navList = (
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
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-cream-light">
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-40 bg-dark text-cream-light flex items-center justify-between px-4 py-3">
        {brandBlock}
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="shrink-0 h-9 w-9 flex items-center justify-center rounded-lg hover:bg-white/10"
        >
          <span className="block w-5 space-y-1">
            <span className="block h-0.5 bg-cream-light" />
            <span className="block h-0.5 bg-cream-light" />
            <span className="block h-0.5 bg-cream-light" />
          </span>
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="relative w-72 max-w-[80vw] bg-dark text-cream-light flex flex-col">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              {brandBlock}
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="text-cream-light/60 text-xl leading-none px-1"
              >
                ×
              </button>
            </div>
            {navList}
            <div className="p-4 border-t border-white/10">
              <button
                onClick={handleSignOut}
                className="w-full text-left text-sm text-cream-light/60 hover:text-cream-light px-4 py-2"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 bg-dark text-cream-light flex-col">
        <div className="p-6 border-b border-white/10">{brandBlock}</div>
        {navList}
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
        <main className="p-5 md:p-8 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
