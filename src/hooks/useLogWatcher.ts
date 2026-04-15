import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "../store/settingsStore";
import type { ZoneChangeEvent, LevelUpEvent } from "../types";

type ZoneChangeHandler = (event: ZoneChangeEvent) => void;
type LevelChangeHandler = (event: LevelUpEvent) => void;

export function useLogWatcher(
  onZoneChange: ZoneChangeHandler,
  onLevelChange?: LevelChangeHandler
) {
  const clientTxtPath = useSettingsStore((s) => s.settings.clientTxtPath);

  useEffect(() => {
    if (!clientTxtPath) return;

    invoke("start_log_watcher", { logPath: clientTxtPath }).catch((e) =>
      console.error("Failed to start log watcher:", e)
    );

    const unlistenZone = listen<ZoneChangeEvent>("zone-changed", (event) => {
      onZoneChange(event.payload);
    });

    const unlistenLevel = onLevelChange
      ? listen<LevelUpEvent>("level-changed", (event) => {
          onLevelChange(event.payload);
        })
      : null;

    return () => {
      unlistenZone.then((fn) => fn());
      unlistenLevel?.then((fn) => fn());
    };
  }, [clientTxtPath, onZoneChange, onLevelChange]);
}
