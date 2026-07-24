"use client";

import { useEffect, useRef } from "react";

import type { DealPublicState } from "@/lib/deal/types";
import { DealGame } from "./deal-game";

type ExtendedWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

type SoundName = "open" | "choice" | "accept";

const SOUND_PATHS: Record<SoundName, string> = {
  open: "/audio/deal/box-open.wav",
  choice: "/audio/deal/box-choice.wav",
  accept: "/audio/deal/deal-accept.wav",
};

/**
 * L'ancien DealGame produit de petits bips avec Web Audio.
 * Cette classe garde les appels existants fonctionnels, mais silencieux,
 * afin que seuls les nouveaux fichiers audio soient entendus.
 */
class SilentAudioContext {
  readonly destination = {};

  createOscillator() {
    return {
      frequency: { value: 0 },
      type: "sine",
      connect: () => undefined,
      start: () => undefined,
      stop: () => undefined,
    };
  }

  createGain() {
    return {
      gain: { value: 0 },
      connect: () => undefined,
    };
  }

  close() {
    return Promise.resolve();
  }
}

function buttonText(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

export function DealGameWithSounds({
  initialState,
}: {
  initialState: DealPublicState;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const enabledRef = useRef(false);
  const openedCountRef = useRef(initialState.session?.opened_count ?? 0);
  const selectedBoxRef = useRef(initialState.session?.selected_box ?? null);
  const bankerCallRef = useRef(
    initialState.session?.status === "banker_call",
  );
  const acceptedRef = useRef(initialState.session?.status === "accepted");
  const effectsRef = useRef<Partial<Record<SoundName, HTMLAudioElement>>>({});
  const bankerRingRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audioWindow = window as ExtendedWindow;
    const originalAudioContext = audioWindow.AudioContext;
    const originalWebkitAudioContext = audioWindow.webkitAudioContext;
    const silentConstructor =
      SilentAudioContext as unknown as typeof AudioContext;

    try {
      audioWindow.AudioContext = silentConstructor;
      audioWindow.webkitAudioContext = silentConstructor;
    } catch {
      // Certains navigateurs protègent ces propriétés. Les nouveaux sons
      // restent utilisables même si l'ancien bip ne peut pas être neutralisé.
    }

    effectsRef.current = {
      open: new Audio(SOUND_PATHS.open),
      choice: new Audio(SOUND_PATHS.choice),
      accept: new Audio(SOUND_PATHS.accept),
    };

    for (const audio of Object.values(effectsRef.current) as HTMLAudioElement[]) {
      if (!audio) continue;
      audio.preload = "auto";
    }

    const bankerRing = new Audio("/audio/deal/banker-ring.wav");
    bankerRing.preload = "auto";
    bankerRing.loop = true;
    bankerRing.volume = 0.72;
    bankerRingRef.current = bankerRing;

    return () => {
      bankerRing.pause();
      bankerRing.currentTime = 0;
      for (const audio of Object.values(effectsRef.current) as HTMLAudioElement[]) {
        audio?.pause();
      }

      try {
        audioWindow.AudioContext = originalAudioContext;
        audioWindow.webkitAudioContext = originalWebkitAudioContext;
      } catch {
        // Aucun blocage du démontage si le navigateur refuse la restauration.
      }
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const playEffect = (sound: SoundName) => {
      if (!enabledRef.current) return;
      const audio = effectsRef.current[sound];
      if (!audio) return;

      audio.pause();
      audio.currentTime = 0;
      audio.volume = sound === "open" ? 0.78 : 0.66;
      void audio.play().catch(() => undefined);
    };

    const stopBankerRing = () => {
      const ring = bankerRingRef.current;
      if (!ring) return;
      ring.pause();
      ring.currentTime = 0;
    };

    const startBankerRing = () => {
      if (!enabledRef.current) return;
      const ring = bankerRingRef.current;
      if (!ring || !ring.paused) return;
      ring.currentTime = 0;
      void ring.play().catch(() => undefined);
    };

    const readInterfaceState = () => {
      const text = root.textContent?.replace(/\s+/g, " ") ?? "";
      const soundButton = Array.from(
        root.querySelectorAll<HTMLButtonElement>("button"),
      ).find(
        (button) =>
          /sons activés|activer les sons/i.test(buttonText(button as Element)),
      );

      const soundsEnabled = /sons activés/i.test(buttonText((soundButton as Element | undefined) ?? null));
      const wasEnabled = enabledRef.current;
      enabledRef.current = soundsEnabled;

      const openedMatch = text.match(/(\d+)\s+boîte(?:s)?\s+ouverte(?:s)?/i);
      const openedCount = openedMatch ? Number(openedMatch[1]) : 0;
      if (openedCount > openedCountRef.current) {
        playEffect("open");
      }
      openedCountRef.current = openedCount;

      const selectedMatch = text.match(/Ma boîte\s*:\s*(\d+)/i);
      const selectedBox = selectedMatch ? Number(selectedMatch[1]) : null;
      if (selectedBox && selectedBoxRef.current === null) {
        playEffect("choice");
      }
      selectedBoxRef.current = selectedBox;

      const bankerCall = /APPEL ENTRANT/i.test(text);
      if (bankerCall && (!bankerCallRef.current || (!wasEnabled && soundsEnabled))) {
        startBankerRing();
      } else if (!bankerCall) {
        stopBankerRing();
      }
      bankerCallRef.current = bankerCall;

      const accepted = /Vous avez accepté la proposition du banquier/i.test(text);
      if (accepted && !acceptedRef.current) {
        stopBankerRing();
        playEffect("accept");
      }
      acceptedRef.current = accepted;

      if (!soundsEnabled) {
        stopBankerRing();
      }
    };

    readInterfaceState();

    const observer = new MutationObserver(() => {
      readInterfaceState();
    });
    observer.observe(root, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    const handleClick = () => {
      window.setTimeout(readInterfaceState, 0);
      window.setTimeout(readInterfaceState, 350);
    };
    root.addEventListener("click", handleClick, true);

    return () => {
      observer.disconnect();
      root.removeEventListener("click", handleClick, true);
      stopBankerRing();
    };
  }, []);

  return (
    <div ref={rootRef}>
      <DealGame initialState={initialState} />
    </div>
  );
}
