import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { Settings } from "../types";
import { DEFAULT_SETTINGS } from "../types";

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (partial: Partial<Settings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  load: async () => {
    try {
      const raw = await invoke<string>("read_user_data", { filename: "settings.json" });
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Settings>;
        set({ settings: { ...DEFAULT_SETTINGS, ...saved }, loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },
  update: async (partial: Partial<Settings>) => {
    const newSettings = { ...get().settings, ...partial };
    set({ settings: newSettings });
    try {
      await invoke("write_user_data", {
        filename: "settings.json",
        data: JSON.stringify(newSettings, null, 2),
      });
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
  },
}));
