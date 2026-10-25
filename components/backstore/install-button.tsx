"use client";

import { useState, useSyncExternalStore } from "react";
import { Share, SquarePlus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Chromium's install prompt event (not in lib.dom yet).
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

// Chrome can fire beforeinstallprompt before React mounts, so it's caught at module load and kept here.
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep it for our button instead of Chrome's mini-infobar
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

type Mode = "hidden" | "prompt" | "ios";

function getMode(): Mode {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
  if (standalone) return "hidden";
  if (deferred) return "prompt";
  // iPadOS reports itself as a Mac; touch support tells them apart.
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "hidden";
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * "Install app" in the top bar. Chromium (Android, desktop) gets the browser's own install prompt. iOS has no
 * install API, so Safari users get the Share → Add to Home Screen steps. Hidden once running as the installed app.
 */
export function InstallButton() {
  const mode = useSyncExternalStore(subscribe, getMode, () => "hidden" as Mode);
  const [guide, setGuide] = useState(false);

  if (mode === "hidden") return null;

  async function install() {
    if (mode === "ios") return setGuide(true);
    const event = deferred;
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    deferred = null; // a prompt event can only be used once
    notify();
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={install} aria-label="Add to Home Screen">
        <Smartphone />
        <span className="hidden sm:inline">Install app</span>
      </Button>

      <Dialog open={guide} onOpenChange={setGuide}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add 3D2GO to your Home Screen</DialogTitle>
            <DialogDescription>Opens full screen, like an app.</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                <Share className="size-4" />
              </span>
              <span>
                Tap <b>Share</b> in the browser toolbar (on iPhone, at the bottom of the screen).
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                <SquarePlus className="size-4" />
              </span>
              <span>
                Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.
              </span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
