import { useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { confirmDialog } from "../components/Dialog/Dialog";

export function useAutoUpdate() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const update = await check();
        if (cancelled || !update) return;
        const ok = await confirmDialog(
          `Version ${update.version} is available. Download and install now?`,
          { title: "Update available", confirmLabel: "Install", cancelLabel: "Later" },
        );
        if (!ok) return;
        await update.downloadAndInstall();
        await relaunch();
      } catch (err) {
        console.warn("Update check failed:", err);
      }
    })();
    return () => { cancelled = true; };
  }, []);
}
