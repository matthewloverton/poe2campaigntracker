import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CompanionLayout } from "./layouts/CompanionLayout";
import { GuidePanel } from "./components/GuidePanel/GuidePanel";
import { ItemBrowser } from "./components/ItemBrowser/ItemBrowser";
import { GemBrowser } from "./components/GemBrowser/GemBrowser";
import { CampaignTimer } from "./components/CampaignTimer/CampaignTimer";
import { LevelIndicator } from "./components/LevelIndicator/LevelIndicator";
import { ToastContainer } from "./components/Toast/Toast";
import { BuildPlan } from "./components/BuildPlan/BuildPlan";
import { Settings } from "./components/Settings/Settings";
import { useSettingsStore } from "./store/settingsStore";
import { useTimerStore } from "./store/timerStore";
import { useCustomizationsStore } from "./store/customizationsStore";
import { useGuideStore } from "./store/guideStore";
import { usePersistence } from "./hooks/usePersistence";
import { useAutoAdvance } from "./hooks/useAutoAdvance";

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 12px",
  background: "var(--bg-panel)",
  borderBottom: "1px solid var(--border-color)",
  flexShrink: 0,
  minHeight: 40,
};

const dbBtnStyle: React.CSSProperties = {
  padding: "4px 12px",
  background: "none",
  border: "1px solid var(--border-gold)",
  borderRadius: 4,
  color: "var(--color-gold)",
  fontSize: "0.72rem",
  fontWeight: 600,
  cursor: "pointer",
  letterSpacing: "0.3px",
};

export default function App() {
  const loadSettings = useSettingsStore((s) => s.load);
  const loadTimer = useTimerStore((s) => s.load);
  const loadCustomizations = useCustomizationsStore((s) => s.load);
  const clientTxtPath = useSettingsStore((s) => s.settings.clientTxtPath);
  const updateSettings = useSettingsStore((s) => s.update);
  const timerState = useTimerStore((s) => s.state);
  const splitAct = useTimerStore((s) => s.splitAct);
  const { toasts, dismissToast } = useAutoAdvance();
  usePersistence();

  const currentPage = useGuideStore((s) => s.pages[s.currentPageIndex]);

  const [showSettings, setShowSettings] = useState(false);
  const [showItemBrowser, setShowItemBrowser] = useState(false);
  const [showGemBrowser, setShowGemBrowser] = useState(false);

  useEffect(() => {
    if (clientTxtPath) return;
    invoke<string | null>("detect_client_txt").then((path) => {
      if (path) updateSettings({ clientTxtPath: path });
    });
  }, [clientTxtPath, updateSettings]);

  useEffect(() => {
    if (currentPage && timerState === "running") {
      splitAct(currentPage.act);
    }
  }, [currentPage?.act, timerState, splitAct]);

  useEffect(() => {
    loadSettings();
    loadTimer();
    loadCustomizations();
  }, [loadSettings, loadTimer, loadCustomizations]);

  return (
    <>
      <CompanionLayout
        primary={
          <>
            {/* Build plan header */}
            <div style={headerStyle}>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--accent-gold)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Build Plan
              </span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button style={dbBtnStyle} onClick={() => setShowItemBrowser(true)}>
                  Items
                </button>
                <button style={dbBtnStyle} onClick={() => setShowGemBrowser(true)}>
                  Gems
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <BuildPlan />
            </div>
          </>
        }
        secondary={
          <>
            {/* Campaign header */}
            <div style={headerStyle}>
              <CampaignTimer />
              <LevelIndicator />
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: clientTxtPath ? "var(--color-green)" : "var(--color-yellow)", fontSize: "0.7rem" }}>
                  {clientTxtPath ? "● Connected" : "○ No Client.txt"}
                </span>
                <button
                  onClick={() => setShowSettings(true)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-secondary)",
                    fontSize: "1rem",
                    cursor: "pointer",
                    padding: "2px 4px",
                    borderRadius: "3px",
                    lineHeight: 1,
                  }}
                  title="Settings"
                >
                  ⚙
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <GuidePanel />
            </div>
          </>
        }
      />

      {/* Item browser modal */}
      {showItemBrowser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={(e) => { if (e.target === e.currentTarget) setShowItemBrowser(false); }}>
          <div style={{ width: "95vw", maxWidth: "1400px", height: "85vh", borderRadius: "6px", overflow: "hidden" }}>
            <ItemBrowser onClose={() => setShowItemBrowser(false)} />
          </div>
        </div>
      )}

      {/* Gem browser modal */}
      {showGemBrowser && (
        <GemBrowser onClose={() => setShowGemBrowser(false)} />
      )}

      <ToastContainer messages={toasts} onDismiss={dismissToast} />
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
