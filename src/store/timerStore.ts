import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { Progress } from "../types";
import { DEFAULT_PROGRESS } from "../types";

interface ActSplit {
  startedAt: number;
  completedAt: number | null;
  elapsed: number | null;
}

interface TimerState {
  state: "stopped" | "running" | "paused";
  startedAt: number | null;
  pausedElapsed: number;
  currentAct: number;
  actSplits: Record<number, ActSplit>;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  splitAct: (newAct: number) => void;
  load: () => Promise<void>;
  save: () => Promise<void>;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  state: "stopped",
  startedAt: null,
  pausedElapsed: 0,
  currentAct: 1,
  actSplits: {},

  start: () => {
    const now = Date.now();
    set({
      state: "running",
      startedAt: now,
      pausedElapsed: 0,
      currentAct: 1,
      actSplits: {
        1: { startedAt: now, completedAt: null, elapsed: null },
      },
    });
    get().save();
  },

  pause: () => {
    const { startedAt, pausedElapsed } = get();
    if (startedAt == null) return;
    const accumulated = pausedElapsed + (Date.now() - startedAt);
    set({ state: "paused", pausedElapsed: accumulated, startedAt: null });
    get().save();
  },

  resume: () => {
    set({ state: "running", startedAt: Date.now() });
    get().save();
  },

  reset: () => {
    set({
      state: "stopped",
      startedAt: null,
      pausedElapsed: 0,
      currentAct: 1,
      actSplits: {},
    });
    get().save();
  },

  splitAct: (newAct: number) => {
    const { currentAct, actSplits, startedAt, pausedElapsed, state } = get();
    if (newAct <= currentAct) return;
    if (state !== "running") return;

    const now = Date.now();
    const totalElapsed = startedAt != null ? pausedElapsed + (now - startedAt) : pausedElapsed;
    const currentSplit = actSplits[currentAct];
    const actElapsed = currentSplit ? now - currentSplit.startedAt : null;

    const updatedSplits: Record<number, ActSplit> = {
      ...actSplits,
      [currentAct]: {
        ...actSplits[currentAct],
        completedAt: now,
        elapsed: actElapsed,
      },
      [newAct]: { startedAt: now, completedAt: null, elapsed: null },
    };

    set({ currentAct: newAct, actSplits: updatedSplits });
    // Suppress unused variable warning
    void totalElapsed;
    get().save();
  },

  save: async () => {
    const { state, startedAt, pausedElapsed, actSplits } = get();
    try {
      const raw = await invoke<string>("read_user_data", { filename: "progress.json" });
      const existing: Progress = raw ? (JSON.parse(raw) as Progress) : DEFAULT_PROGRESS;

      // Convert actSplits keys (numbers) to strings with ISO timestamps
      const serializedSplits: Progress["actSplits"] = {};
      for (const [actKey, split] of Object.entries(actSplits)) {
        serializedSplits[actKey] = {
          startedAt: new Date(split.startedAt).toISOString(),
          completedAt: split.completedAt != null ? new Date(split.completedAt).toISOString() : null,
          elapsed: split.elapsed,
        };
      }

      const merged: Progress = {
        ...existing,
        timerState: state,
        timerStartedAt: startedAt != null ? new Date(startedAt).toISOString() : null,
        timerPausedElapsed: pausedElapsed,
        actSplits: serializedSplits,
      };

      await invoke("write_user_data", {
        filename: "progress.json",
        data: JSON.stringify(merged, null, 2),
      });
    } catch (e) {
      console.error("Failed to save timer:", e);
    }
  },

  load: async () => {
    try {
      const raw = await invoke<string>("read_user_data", { filename: "progress.json" });
      if (!raw) return;

      const progress = JSON.parse(raw) as Progress;
      if (!progress.timerState || progress.timerState === "stopped") return;

      // Deserialize actSplits from ISO strings back to epoch ms
      const actSplits: Record<number, ActSplit> = {};
      let maxAct = 1;
      for (const [actKey, split] of Object.entries(progress.actSplits ?? {})) {
        const act = Number(actKey);
        actSplits[act] = {
          startedAt: new Date(split.startedAt).getTime(),
          completedAt: split.completedAt != null ? new Date(split.completedAt).getTime() : null,
          elapsed: split.elapsed,
        };
        if (act > maxAct) maxAct = act;
      }

      // Find current act: highest act with no completedAt
      let currentAct = maxAct;
      for (const [actKey, split] of Object.entries(actSplits)) {
        if (split.completedAt == null) {
          currentAct = Number(actKey);
          break;
        }
      }

      if (progress.timerState === "running") {
        // Timer was running when saved — treat as paused now
        // (we don't know how long the app was closed, resume from pausedElapsed)
        set({
          state: "paused",
          startedAt: null,
          pausedElapsed: progress.timerPausedElapsed ?? 0,
          currentAct,
          actSplits,
        });
      } else if (progress.timerState === "paused") {
        set({
          state: "paused",
          startedAt: null,
          pausedElapsed: progress.timerPausedElapsed ?? 0,
          currentAct,
          actSplits,
        });
      }
    } catch (e) {
      console.error("Failed to load timer:", e);
    }
  },
}));
