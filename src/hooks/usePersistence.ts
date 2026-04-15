import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useGuideStore } from "../store/guideStore";
import type { Progress } from "../types";
import { DEFAULT_PROGRESS } from "../types";

export function usePersistence() {
  const currentPageIndex = useGuideStore((s) => s.currentPageIndex);
  const pages = useGuideStore((s) => s.pages);
  const loadedRef = useRef(false);

  // Load progress on mount
  useEffect(() => {
    async function loadProgress() {
      try {
        const raw = await invoke<string>("read_user_data", { filename: "progress.json" });
        if (raw) {
          const progress = JSON.parse(raw) as Progress;
          if (progress.currentPageIndex >= 0 && progress.currentPageIndex < pages.length) {
            useGuideStore.setState({ currentPageIndex: progress.currentPageIndex });
          }
        }
      } catch {
        // First launch, no progress file
      }
      loadedRef.current = true;
    }
    loadProgress();
  }, [pages.length]);

  // Save progress on page change (debounced)
  useEffect(() => {
    if (!loadedRef.current) return;
    const timer = setTimeout(async () => {
      try {
        const raw = await invoke<string>("read_user_data", { filename: "progress.json" });
        const existing = raw ? (JSON.parse(raw) as Progress) : DEFAULT_PROGRESS;
        const merged = { ...existing, currentPageIndex };
        await invoke("write_user_data", {
          filename: "progress.json",
          data: JSON.stringify(merged, null, 2),
        });
      } catch (e) {
        console.error("Failed to save progress:", e);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [currentPageIndex]);
}
