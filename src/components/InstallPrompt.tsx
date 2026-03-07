"use client";

import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-brand-200 bg-white p-4 shadow-lg sm:bottom-4 sm:left-auto sm:right-4 sm:w-96 sm:rounded-xl sm:border">
      <div className="flex items-start gap-3">
        <span className="text-3xl">&#10024;</span>
        <div className="flex-1">
          <p className="font-semibold text-gray-900">Install Sparkle</p>
          <p className="mt-1 text-sm text-gray-600">
            Add Sparkle to your home screen for quick access to booking and
            managing cleaners.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleInstall}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Install App
            </button>
            <button
              onClick={() => setShowBanner(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Not Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
