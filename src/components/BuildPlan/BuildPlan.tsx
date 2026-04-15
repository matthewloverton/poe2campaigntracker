import { useState } from "react";
import { useCustomizationsStore } from "../../store/customizationsStore";
import { PhaseBar } from "./PhaseBar";
import { GearGrid } from "./GearGrid";
import { SkillRow } from "./SkillRow";
import { DragList } from "../DragList/DragList";
import { ItemBrowser } from "../ItemBrowser/ItemBrowser";
import { GemBrowser } from "../GemBrowser/GemBrowser";
import { VendorRegex } from "../VendorRegex/VendorRegex";
import { cleanModText } from "../../data/mods";
import { itemById } from "../../data/items";
import type { GearSlotKey, PhaseTrigger, BuildGearEntry, BuildGemEntry } from "../../types";
import { SLOT_ITEM_CLASSES } from "../../types/buildPlan";
import type { GemEntry, BaseItem, ItemMod, UniqueItem } from "../../types/itemDatabase";
import styles from "./BuildPlan.module.css";

function getSlotClassKey(slot: GearSlotKey): string {
  if (slot === "weaponSwap") return "weapon";
  if (slot === "offhandSwap") return "offhand";
  return slot;
}

export function BuildPlan() {
  const buildPhases = useCustomizationsStore((s) => s.buildPhases);
  const activePhaseId = useCustomizationsStore((s) => s.activePhaseId);
  const setActivePhase = useCustomizationsStore((s) => s.setActivePhase);
  const addPhase = useCustomizationsStore((s) => s.addPhase);
  const removePhase = useCustomizationsStore((s) => s.removePhase);
  const reorderPhases = useCustomizationsStore((s) => s.reorderPhases);
  const setGearSlot = useCustomizationsStore((s) => s.setGearSlot);
  const addSkillGroup = useCustomizationsStore((s) => s.addSkillGroup);
  const removeSkillGroup = useCustomizationsStore((s) => s.removeSkillGroup);
  const replaceSkillInGroup = useCustomizationsStore((s) => s.replaceSkillInGroup);
  const reorderSkillGroups = useCustomizationsStore((s) => s.reorderSkillGroups);
  const reorderSupportsInGroup = useCustomizationsStore((s) => s.reorderSupportsInGroup);
  const setSupportInGroup = useCustomizationsStore((s) => s.setSupportInGroup);
  const watchlist = useCustomizationsStore((s) => s.watchlist ?? []);
  const removeFromWatchlist = useCustomizationsStore((s) => s.removeFromWatchlist);

  const activePhase = buildPhases.find((p) => p.id === activePhaseId) ?? null;

  // Item browser state (for gear slots)
  const [browserSlot, setBrowserSlot] = useState<GearSlotKey | null>(null);

  // Gem search state
  const [gemSearchOpen, setGemSearchOpen] = useState(false);
  const [supportTarget, setSupportTarget] = useState<{ groupId: string; index: number } | null>(null);
  const [skillReplaceTarget, setSkillReplaceTarget] = useState<string | null>(null);



  const updatePhaseTrigger = useCustomizationsStore((s) => s.updatePhaseTrigger);
  const updatePhase = useCustomizationsStore((s) => s.updatePhase);

  function handleAddPhase(name: string, trigger: PhaseTrigger) {
    addPhase(name);
    // Set the trigger on the newly created phase
    const phases = useCustomizationsStore.getState().buildPhases;
    const newest = phases[phases.length - 1];
    if (newest) {
      updatePhaseTrigger(newest.id, trigger);
    }
  }

  function handleGearSlotClick(slot: GearSlotKey) {
    setBrowserSlot(slot);
  }

  function handleItemSelected(item: BaseItem) {
    if (!activePhaseId || !browserSlot) return;
    const entry: BuildGearEntry = {
      id: crypto.randomUUID(),
      slot: browserSlot,
      base: item.name,
      baseItemId: item.id,
      desiredMods: [],
      notes: "",
      iconPath: item.iconPath,
    };
    setGearSlot(activePhaseId, browserSlot, entry);
    setBrowserSlot(null);
  }

  function handleUniqueSelected(unique: UniqueItem) {
    if (!activePhaseId || !browserSlot) return;
    const entry: BuildGearEntry = {
      id: crypto.randomUUID(),
      slot: browserSlot,
      base: unique.name,
      uniqueId: unique.id,
      desiredMods: unique.mods,
      notes: "",
      iconPath: unique.iconPath,
    };
    setGearSlot(activePhaseId, browserSlot, entry);
    setBrowserSlot(null);
  }

  function handleRemoveGearSlot(slot: GearSlotKey) {
    if (!activePhaseId) return;
    setGearSlot(activePhaseId, slot, null);
  }

  function handleAddSkill(gem: GemEntry) {
    if (!activePhaseId) return;
    const entry: BuildGemEntry = {
      id: crypto.randomUUID(),
      gemId: gem.id,
      name: gem.name,
      category: gem.gemType === "active" ? "skill" : gem.gemType,
      priority: activePhase?.gems.length ?? 0,
      supports: [],
      iconPath: gem.iconPath,
      color: gem.color,
      craftingLevel: gem.craftingLevel,
    };
    if (skillReplaceTarget) {
      replaceSkillInGroup(activePhaseId, skillReplaceTarget, entry);
      setSkillReplaceTarget(null);
    } else {
      addSkillGroup(activePhaseId, entry);
    }
    setGemSearchOpen(false);
  }

  function handleSupportClick(groupId: string, index: number) {
    setSupportTarget({ groupId, index });
  }

  function handleSupportSelected(gem: GemEntry) {
    if (!activePhaseId || !supportTarget) return;
    const entry: BuildGemEntry = {
      id: crypto.randomUUID(),
      gemId: gem.id,
      name: gem.name,
      category: "support",
      priority: 0,
      supports: [],
      iconPath: gem.iconPath,
      color: gem.color,
      craftingLevel: gem.craftingLevel,
    };
    setSupportInGroup(activePhaseId, supportTarget.groupId, supportTarget.index, entry);
    setSupportTarget(null);
  }

  function handleRemoveSupport(groupId: string, index: number) {
    if (!activePhaseId) return;
    setSupportInGroup(activePhaseId, groupId, index, null);
  }

  // Empty state
  if (buildPhases.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>No build phases yet.</p>
        <button className={styles.createBtn} onClick={() => addPhase("League Start")}>
          Create Build Plan
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <PhaseBar
        phases={buildPhases}
        activePhaseId={activePhaseId}
        onSelectPhase={setActivePhase}
        onAddPhase={handleAddPhase}
        onRemovePhase={removePhase}
        onRenamePhase={(id, name) => updatePhase(id, { name })}
        onReorderPhases={(ids) => reorderPhases(ids)}
        onUpdateTrigger={updatePhaseTrigger}
      />

      {activePhase && (
        <div className={styles.content}>
          <div className={styles.topRow}>
            <div className={styles.gearSection}>
              <GearGrid
                gear={activePhase.gear}
                onSlotClick={handleGearSlotClick}
                onRemoveSlot={handleRemoveGearSlot}
              />
            </div>

            <div className={styles.regexSection}>
              <div className={styles.regexHeader}>Vendor Regex</div>
              <VendorRegex />

              {watchlist.length > 0 && (
                <>
                  <div className={styles.regexHeader} style={{ marginTop: 10 }}>Tracked</div>
                  <div className={styles.trackedList}>
                    {watchlist.map((w) => (
                      <div key={w.id} className={styles.trackedItem}>
                        {w.iconPath && (
                          <img
                            className={styles.trackedIcon}
                            src={`/assets/${w.iconPath}`}
                            alt={w.name}
                          />
                        )}
                        <span className={styles.trackedName}>{w.name}</span>
                        <span className={styles.trackedLevel}>Lv {w.unlockLevel}</span>
                        <button
                          className={styles.trackedRemove}
                          onClick={() => removeFromWatchlist(w.id)}
                          title="Stop tracking"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className={styles.gemsSection}>
            <div className={styles.sectionHeader}>Skill Gems</div>
            <DragList
              items={activePhase.gems}
              onReorder={(ids) => activePhaseId && reorderSkillGroups(activePhaseId, ids)}
              renderItem={(item) => {
                const group = item as typeof activePhase.gems[0];
                return (
                  <SkillRow
                    group={group}
                    onSkillClick={() => { setSkillReplaceTarget(group.id); setGemSearchOpen(true); }}
                    onSupportClick={(i) => handleSupportClick(group.id, i)}
                    onRemoveSupport={(i) => handleRemoveSupport(group.id, i)}
                    onRemoveSkill={() => activePhaseId && removeSkillGroup(activePhaseId, group.id)}
                    onReorderSupports={(from, to) => activePhaseId && reorderSupportsInGroup(activePhaseId, group.id, from, to)}
                  />
                );
              }}
            />
            <button className={styles.addSkillBtn} onClick={() => { setSkillReplaceTarget(null); setGemSearchOpen(true); }}>
              + Add Skill
            </button>
          </div>
        </div>
      )}

      {/* Item browser overlay for gear slots */}
      {browserSlot && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={(e) => { if (e.target === e.currentTarget) setBrowserSlot(null); }}>
          <div style={{ width: "95vw", maxWidth: "1400px", height: "85vh", borderRadius: "6px", overflow: "hidden" }}>
            <ItemBrowser
              onClose={() => setBrowserSlot(null)}
              onSelectItem={handleItemSelected}
              onSelectUnique={handleUniqueSelected}
              allowedClasses={SLOT_ITEM_CLASSES[getSlotClassKey(browserSlot)]}
              initialItemClass={activePhase?.gear[browserSlot]?.baseItemId ? itemById.get(activePhase.gear[browserSlot]!.baseItemId!)?.itemClass : undefined}
              onSaveCraft={(item: BaseItem, mods: ItemMod[]) => {
                if (!activePhaseId || !browserSlot) return;
                const entry: BuildGearEntry = {
                  id: crypto.randomUUID(),
                  slot: browserSlot,
                  baseItemId: item.id,
                  base: item.name,
                  desiredModIds: mods.map((m) => m.id),
                  desiredMods: mods.map((m) => cleanModText(m.text)),
                  notes: "",
                  iconPath: item.iconPath,
                };
                setGearSlot(activePhaseId, browserSlot, entry);
                setBrowserSlot(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Gem browser for adding/replacing skills */}
      {gemSearchOpen && (
        <GemBrowser
          onClose={() => { setGemSearchOpen(false); setSkillReplaceTarget(null); }}
          onSelectGem={(gem) => handleAddSkill(gem)}
          defaultSection="skills"
          selectLabel={skillReplaceTarget ? "Replace Skill" : undefined}
        />
      )}

      {/* Gem browser for adding/replacing supports */}
      {supportTarget && (
        <GemBrowser
          onClose={() => setSupportTarget(null)}
          onSelectGem={(gem) => handleSupportSelected(gem)}
          defaultSection="supports"
          selectLabel={supportTarget && activePhase?.gems.find(g => g.id === supportTarget.groupId)?.supports[supportTarget.index] ? "Replace Support" : undefined}
        />
      )}
    </div>
  );
}
