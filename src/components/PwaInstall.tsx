"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "bespoke-install-dismissed";

export function PwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // installability still works without a live SW; ignore registration errors
      });
    }

    const handler = (e: Event) => {
      e.preventDefault();
      if (sessionStorage.getItem(DISMISS_KEY)) return;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
      <div className="rounded-2xl bg-dark text-cream-light shadow-xl p-4 flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl overflow-hidden shrink-0 bg-terracotta flex items-center justify-center font-serif text-lg">
          B
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Install Bespoke</p>
          <p className="text-xs text-cream-light/70">Add it to your home screen for quick access.</p>
        </div>
        <button
          onClick={handleInstall}
          className="px-3 py-2 rounded-full bg-cream-light text-dark text-xs font-medium shrink-0"
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="text-cream-light/60 text-lg leading-none shrink-0 px-1"
        >
          ×
        </button>
      </div>
    </div>
  );
}
