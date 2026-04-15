import { useCallback, useState } from "react";
import { useGuideStore } from "../store/guideStore";
import { useTimerStore } from "../store/timerStore";
import { useLevelStore } from "../store/levelStore";
import { useCustomizationsStore } from "../store/customizationsStore";
import { useLogWatcher } from "./useLogWatcher";
import { itemById } from "../data/items";
import { gemUnlockLevel } from "../types/itemDatabase";
import type { ZoneChangeEvent, LevelUpEvent } from "../types";

interface ToastMessage {
  id: number;
  text: string;
}

export interface UnlockItem {
  name: string;
  iconPath?: string;
  type: "gem" | "gear" | "item";
}

export interface UnlockNotification {
  id: number;
  level: number;
  items: UnlockItem[];
}

let toastId = 0;

export function useAutoAdvance() {
  const advanceToZone = useGuideStore((s) => s.advanceToZone);
  const pages = useGuideStore((s) => s.pages);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [unlocks, setUnlocks] = useState<UnlockNotification[]>([]);

  const dismissUnlock = useCallback((id: number) => {
    setUnlocks((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const addToast = useCallback((text: string, duration = 3000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
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
    const prevLevel = useLevelStore.getState().level;
    useLevelStore.getState().setLevel(event.level, event.characterName, event.class);

    // Check build plan for newly available gems/gear
    const { buildPhases, activePhaseId } = useCustomizationsStore.getState();
    const phase = buildPhases.find((p) => p.id === activePhaseId);
    if (!phase || prevLevel >= event.level) return;

    const items: UnlockItem[] = [];

    // Check gear
    for (const entry of Object.values(phase.gear)) {
      if (!entry?.baseItemId) continue;
      const base = itemById.get(entry.baseItemId);
      if (!base) continue;
      const reqLevel = base.requirements.level;
      if (reqLevel > 0 && reqLevel > prevLevel && reqLevel <= event.level) {
        items.push({ name: entry.base, iconPath: entry.iconPath, type: "gear" });
      }
    }

    // Check skill gems and their supports
    for (const group of phase.gems) {
      const skill = group.skill;
      if (skill.craftingLevel) {
        const gemType = skill.category === "skill" ? "active" as const : skill.category === "spirit" ? "spirit" as const : "support" as const;
        const dropLevel = gemUnlockLevel(skill.craftingLevel, gemType);
        if (dropLevel > prevLevel && dropLevel <= event.level) {
          items.push({ name: skill.name, iconPath: skill.iconPath, type: "gem" });
        }
      }
      for (const sup of group.supports) {
        if (!sup?.craftingLevel) continue;
        const dropLevel = gemUnlockLevel(sup.craftingLevel, "support");
        if (dropLevel > prevLevel && dropLevel <= event.level) {
          items.push({ name: sup.name, iconPath: sup.iconPath, type: "gem" });
        }
      }
    }

    // Check watchlist
    const seenIds = new Set(items.map((i) => i.name));
    const watchlist = useCustomizationsStore.getState().watchlist ?? [];
    for (const w of watchlist) {
      if (seenIds.has(w.name)) continue;
      if (w.unlockLevel > prevLevel && w.unlockLevel <= event.level) {
        items.push({ name: w.name, iconPath: w.iconPath, type: w.type });
      }
    }

    if (items.length > 0) {
      const id = ++toastId;
      setUnlocks((prev) => [...prev, { id, level: event.level, items }]);
    }
  }, [addToast]);

  useLogWatcher(handleZoneChange, handleLevelChange);

  return { toasts, addToast, dismissToast, unlocks, dismissUnlock };
}
