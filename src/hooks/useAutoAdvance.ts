import { useCallback, useState } from "react";
import { useGuideStore } from "../store/guideStore";
import { useTimerStore } from "../store/timerStore";
import { useLevelStore } from "../store/levelStore";
import { useLogWatcher } from "./useLogWatcher";
import type { ZoneChangeEvent, LevelUpEvent } from "../types";

interface ToastMessage {
  id: number;
  text: string;
}

let toastId = 0;

export function useAutoAdvance() {
  const advanceToZone = useGuideStore((s) => s.advanceToZone);
  const pages = useGuideStore((s) => s.pages);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((text: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleZoneChange = useCallback(
    (event: ZoneChangeEvent) => {
      // Auto-start timer on first zone change
      const timerState = useTimerStore.getState().state;
      if (timerState === "stopped") {
        useTimerStore.getState().start();
      }

      // Reset character info when entering The Riverbank (new run)
      if (event.areaId.toLowerCase() === "g1_1") {
        useLevelStore.getState().setLevel(0, null, null);
      }

      advanceToZone(event.areaId);
    },
    [advanceToZone, pages, addToast]
  );

  const handleLevelChange = useCallback((event: LevelUpEvent) => {
    useLevelStore.getState().setLevel(event.level, event.characterName, event.class);
  }, []);

  useLogWatcher(handleZoneChange, handleLevelChange);

  return { toasts, dismissToast };
}
