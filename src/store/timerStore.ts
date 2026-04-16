import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { Progress, CompletedRun } from "../types";
import { DEFAULT_PROGRESS } from "../types";

interface ActSplit {
  startedAt: number;          // wall-clock epoch when act began (for persistence/date)
  completedAt: number | null; // wall-clock epoch when act ended
  startedAtTotal: number;     // active-play ms (total elapsed) when act began
  elapsed: number | null;     // active-play ms in this act (excludes pause)
}

interface TimerState {
  state: "stopped" | "running" | "paused";
  startedAt: number | null;
  pausedElapsed: number;
  currentAct: number;
  actSplits: Record<number, ActSplit>;
  runHistory: CompletedRun[];
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: (characterName?: string | null, characterClass?: string | null, level?: number) => void;
  splitAct: (newAct: number) => void;
  deleteRun: (runId: string) => void;
  load: () => Promise<void>;
  save: () => Promise<void>;
  loadHistory: () => Promise<void>;
  saveHistory: () => Promise<void>;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  state: "stopped",
  startedAt: null,
  pausedElapsed: 0,
  currentAct: 1,
  actSplits: {},
  runHistory: [],

  start: () => {
    const now = Date.now();
    set({
      state: "running",
      startedAt: now,
      pausedElapsed: 0,
      currentAct: 1,
      actSplits: {
        1: { startedAt: now, completedAt: null, startedAtTotal: 0, elapsed: null },
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

  reset: (characterName, characterClass, level) => {
    const { actSplits, startedAt, pausedElapsed, state: timerState } = get();

    // Save the current run if there are any splits
    const hasAnySplit = Object.keys(actSplits).length > 0;
    if (hasAnySplit && timerState !== "stopped") {
      const now = Date.now();
      const totalElapsed = startedAt != null ? pausedElapsed + (now - startedAt) : pausedElapsed;

      // Finalize the current (in-progress) act so splits sum to totalElapsed
      const { currentAct } = get();
      const finalized: Record<number, ActSplit> = { ...actSplits };
      const currentSplit = finalized[currentAct];
      if (currentSplit && currentSplit.elapsed == null) {
        finalized[currentAct] = {
          ...currentSplit,
          completedAt: now,
          elapsed: totalElapsed - (currentSplit.startedAtTotal ?? 0),
        };
      }

      const serializedSplits: CompletedRun["actSplits"] = {};
      for (const [actKey, split] of Object.entries(finalized)) {
        serializedSplits[actKey] = {
          startedAt: new Date(split.startedAt).toISOString(),
          completedAt: split.completedAt != null ? new Date(split.completedAt).toISOString() : null,
          elapsed: split.elapsed,
          startedAtTotal: split.startedAtTotal,
        };
      }

      const run: CompletedRun = {
        id: crypto.randomUUID(),
        date: new Date(now).toISOString(),
        totalElapsed,
        characterName: characterName ?? null,
        characterClass: characterClass ?? null,
        finalLevel: level ?? 0,
        actSplits: serializedSplits,
      };

      set((s) => ({ runHistory: [run, ...s.runHistory] }));
      get().saveHistory();
    }

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
    const totalElapsed =
      startedAt != null ? pausedElapsed + (now - startedAt) : pausedElapsed;
    const currentSplit = actSplits[currentAct];
    // Act elapsed = active-play time since this act started. Uses totalElapsed
    // deltas so mid-act pauses are excluded (matches the top-level timer).
    const actStartTotal = currentSplit?.startedAtTotal ?? 0;
    const actElapsed = currentSplit ? totalElapsed - actStartTotal : null;

    const updatedSplits: Record<number, ActSplit> = {
      ...actSplits,
      [currentAct]: {
        ...actSplits[currentAct],
        completedAt: now,
        elapsed: actElapsed,
      },
      [newAct]: {
        startedAt: now,
        completedAt: null,
        startedAtTotal: totalElapsed,
        elapsed: null,
      },
    };

    set({ currentAct: newAct, actSplits: updatedSplits });
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
          startedAtTotal: split.startedAtTotal,
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
          startedAtTotal: split.startedAtTotal ?? 0,
        };
        if (act > maxAct) maxAct = act;
      }

      // Back-compat: for data saved before startedAtTotal existed, rebuild it
      // by walking acts in order and summing prior elapsed. Best-effort only —
      // pre-fix elapsed values themselves may include pause time.
      const hasNewField = Object.values(progress.actSplits ?? {}).some(
        (s) => s.startedAtTotal != null,
      );
      if (!hasNewField) {
        const sortedActs = Object.keys(actSplits)
          .map(Number)
          .sort((a, b) => a - b);
        let running = 0;
        for (const act of sortedActs) {
          actSplits[act].startedAtTotal = running;
          running += actSplits[act].elapsed ?? 0;
        }
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

  deleteRun: (runId: string) => {
    set((s) => ({ runHistory: s.runHistory.filter((r) => r.id !== runId) }));
    get().saveHistory();
  },

  loadHistory: async () => {
    try {
      const raw = await invoke<string>("read_user_data", { filename: "run_history.json" });
      if (!raw) return;
      const runs = JSON.parse(raw) as CompletedRun[];
      set({ runHistory: runs });
    } catch {
      // No history yet — that's fine
    }
  },

  saveHistory: async () => {
    try {
      await invoke("write_user_data", {
        filename: "run_history.json",
        data: JSON.stringify(get().runHistory, null, 2),
      });
    } catch (e) {
      console.error("Failed to save run history:", e);
    }
  },
}));
