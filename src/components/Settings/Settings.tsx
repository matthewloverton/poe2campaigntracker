import { useSettingsStore } from "../../store/settingsStore";
import { useCustomizationsStore } from "../../store/customizationsStore";
import { useTimerStore } from "../../store/timerStore";
import { useGuideStore } from "../../store/guideStore";
import styles from "./Settings.module.css";

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Settings({ isOpen, onClose }: SettingsProps) {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);

  const buildPhases = useCustomizationsStore((s) => s.buildPhases);
  const stepReminders = useCustomizationsStore((s) => s.stepReminders);
  const activePhaseId = useCustomizationsStore((s) => s.activePhaseId);
  const vendorRegexes = useCustomizationsStore((s) => s.vendorRegexes);
  const inlineNotes = useCustomizationsStore((s) => s.inlineNotes);

  const resetTimer = useTimerStore((s) => s.reset);
  const resetGuide = useGuideStore((s) => s.reset);
  const setGuide = useGuideStore((s) => s.setGuide);
  const activeGuide = useGuideStore((s) => s.activeGuide);

  if (!isOpen) return null;

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  function handleBrowse() {
    const path = prompt("Paste the path to your Client.txt file:");
    if (path && path.trim()) {
      updateSettings({ clientTxtPath: path.trim() });
    }
  }

  function handleFontSize(e: React.ChangeEvent<HTMLInputElement>) {
    updateSettings({ fontSize: Number(e.target.value) });
  }

  function handleNotificationToggle(key: keyof typeof settings.notifications) {
    updateSettings({
      notifications: {
        ...settings.notifications,
        [key]: !settings.notifications[key],
      },
    });
  }

  function handleExport() {
    const data = JSON.stringify(
      { buildPhases, stepReminders, activePhaseId, vendorRegexes, inlineNotes },
      null,
      2
    );
    navigator.clipboard.writeText(data).catch(() => {
      // Fallback: show in a prompt so the user can copy manually
      prompt("Copy your customizations JSON:", data);
    });
  }

  function handleImport() {
    const raw = prompt("Paste your customizations JSON:");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        buildPhases?: typeof buildPhases;
        stepReminders?: typeof stepReminders;
        activePhaseId?: typeof activePhaseId;
        vendorRegexes?: typeof vendorRegexes;
        inlineNotes?: typeof inlineNotes;
      };
      // Validate basic structure and apply
      const store = useCustomizationsStore.getState();
      // Merge imported data into store, replacing arrays where provided
      useCustomizationsStore.setState({
        ...(parsed.buildPhases !== undefined && { buildPhases: parsed.buildPhases }),
        ...(parsed.stepReminders !== undefined && { stepReminders: parsed.stepReminders }),
        ...(parsed.activePhaseId !== undefined && { activePhaseId: parsed.activePhaseId }),
        ...(parsed.vendorRegexes !== undefined && { vendorRegexes: parsed.vendorRegexes }),
        ...(parsed.inlineNotes !== undefined && { inlineNotes: parsed.inlineNotes }),
      });
      // Persist the imported data
      store.save();
    } catch {
      alert("Invalid JSON. Import failed.");
    }
  }

  function handleResetCampaign() {
    const confirmed = confirm(
      "Reset campaign run? This will clear the timer and return the guide to the beginning."
    );
    if (!confirmed) return;
    resetTimer();
    resetGuide();
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>Settings</span>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* Client.txt path */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Client.txt Path</h3>
          <div className={styles.pathRow}>
            <input
              className={styles.pathInput}
              type="text"
              readOnly
              value={settings.clientTxtPath ?? ""}
              placeholder="Not set — click Browse to configure"
            />
            <button className={styles.browseBtn} onClick={handleBrowse}>
              Browse
            </button>
          </div>
        </section>

        {/* Font size */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Font Size</h3>
          <div className={styles.sliderRow}>
            <input
              className={styles.slider}
              type="range"
              min={10}
              max={20}
              value={settings.fontSize}
              onChange={handleFontSize}
            />
            <span className={styles.sliderValue}>{settings.fontSize}px</span>
          </div>
        </section>

        {/* Notifications */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Notifications</h3>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={settings.notifications.autoAdvance}
              onChange={() => handleNotificationToggle("autoAdvance")}
            />
            <span>Auto-advance guide on zone change</span>
          </label>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={settings.notifications.gemAlerts}
              onChange={() => handleNotificationToggle("gemAlerts")}
            />
            <span>Gem alerts</span>
          </label>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={settings.notifications.vendorReminders}
              onChange={() => handleNotificationToggle("vendorReminders")}
            />
            <span>Vendor reminders</span>
          </label>
        </section>

        {/* Campaign guide */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Campaign Guide</h3>
          <label className={styles.checkboxRow}>
            <input
              type="radio"
              name="guide"
              checked={activeGuide === "default"}
              onChange={() => {
                setGuide("default");
                updateSettings({ guide: "default" });
              }}
            />
            <span>Default</span>
          </label>
          <label className={styles.checkboxRow}>
            <input
              type="radio"
              name="guide"
              checked={activeGuide === "custom"}
              onChange={() => {
                setGuide("custom");
                updateSettings({ guide: "custom" });
              }}
            />
            <span>Custom</span>
          </label>
          <p className={styles.dangerNote} style={{ margin: "6px 0 0", opacity: 0.5 }}>
            Edit src/data/raw/guide-custom.json to customize
          </p>
        </section>

        {/* Data management */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Data Management</h3>
          <div className={styles.buttonRow}>
            <button className={styles.actionBtn} onClick={handleExport}>
              Export Customizations
            </button>
            <button className={styles.actionBtn} onClick={handleImport}>
              Import Customizations
            </button>
          </div>
        </section>

        {/* Reset campaign run */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Reset Campaign Run</h3>
          <p className={styles.dangerNote}>
            Resets the timer and returns the guide to the beginning. This cannot be undone.
          </p>
          <button className={styles.dangerBtn} onClick={handleResetCampaign}>
            Reset Campaign Run
          </button>
        </section>
      </div>
    </div>
  );
}
