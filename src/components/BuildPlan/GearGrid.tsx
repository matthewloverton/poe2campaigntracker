import { useState } from "react";
import type { GearLayout, GearSlotKey } from "../../types/buildPlan";
import { itemById } from "../../data/items";
import { GearSlot } from "./GearSlot";
import styles from "./GearGrid.module.css";

const TWO_HANDED_CLASSES = new Set([
  "Two Hand Sword", "Two Hand Axe", "Two Hand Mace",
  "Bow", "Staff", "Warstaff", "Spear", "Crossbow",
]);

interface GearGridProps {
  gear: GearLayout;
  onSlotClick: (slot: GearSlotKey) => void;
  onRemoveSlot: (slot: GearSlotKey) => void;
}

export function GearGrid({ gear, onSlotClick, onRemoveSlot }: GearGridProps) {
  const [weaponSet, setWeaponSet] = useState<1 | 2>(1);

  const weaponKey: GearSlotKey = weaponSet === 1 ? "weapon" : "weaponSwap";
  const offhandKey: GearSlotKey = weaponSet === 1 ? "offhand" : "offhandSwap";

  const weaponEntry = gear[weaponKey];
  const weaponItem = weaponEntry?.baseItemId ? itemById.get(weaponEntry.baseItemId) : undefined;
  const isTwoHanded = weaponItem ? TWO_HANDED_CLASSES.has(weaponItem.itemClass) : false;

  return (
    <div className={styles.wrapper}>
      <div className={styles.setToggle}>
        <button
          className={`${styles.setBtn} ${weaponSet === 1 ? styles.setBtnActive : ""}`}
          onClick={() => setWeaponSet(1)}
        >
          Set 1
        </button>
        <button
          className={`${styles.setBtn} ${weaponSet === 2 ? styles.setBtnActive : ""}`}
          onClick={() => setWeaponSet(2)}
        >
          Set 2
        </button>
      </div>

      <div className={styles.grid}>
        {/* Row 1+2: Weapon (tall) */}
        <div className={styles.cellWeapon}>
          <GearSlot
            slotKey={weaponKey}
            entry={gear[weaponKey]}
            onClick={() => onSlotClick(weaponKey)}
            onRemove={() => onRemoveSlot(weaponKey)}
          />
        </div>

        {/* Row 1: Helmet */}
        <div className={styles.cellHelmet}>
          <GearSlot
            slotKey="helmet"
            entry={gear.helmet}
            onClick={() => onSlotClick("helmet")}
            onRemove={() => onRemoveSlot("helmet")}
          />
        </div>

        {/* Row 1+2: Offhand (tall) — ghost when 2H weapon equipped */}
        <div className={styles.cellOffhand}>
          {isTwoHanded && weaponEntry?.iconPath ? (
            <div className={`${styles.ghostSlot}`}>
              <img className={styles.ghostImage} src={`/assets/${weaponEntry.iconPath}`} alt="2H" />
              <span className={styles.ghostLabel}>2H</span>
            </div>
          ) : (
            <GearSlot
              slotKey={offhandKey}
              entry={gear[offhandKey]}
              onClick={() => onSlotClick(offhandKey)}
              onRemove={() => onRemoveSlot(offhandKey)}
            />
          )}
        </div>

        {/* Row 2: Amulet */}
        <div className={styles.cellAmulet}>
          <GearSlot
            slotKey="amulet"
            entry={gear.amulet}
            onClick={() => onSlotClick("amulet")}
            onRemove={() => onRemoveSlot("amulet")}
          />
        </div>

        {/* Row 2: Body Armour */}
        <div className={styles.cellBody}>
          <GearSlot
            slotKey="bodyArmour"
            entry={gear.bodyArmour}
            onClick={() => onSlotClick("bodyArmour")}
            onRemove={() => onRemoveSlot("bodyArmour")}
          />
        </div>

        {/* Row 3: Ring 1 */}
        <div className={styles.cellRing1}>
          <GearSlot
            slotKey="ring1"
            entry={gear.ring1}
            onClick={() => onSlotClick("ring1")}
            onRemove={() => onRemoveSlot("ring1")}
          />
        </div>

        {/* Row 3: Belt */}
        <div className={styles.cellBelt}>
          <GearSlot
            slotKey="belt"
            entry={gear.belt}
            onClick={() => onSlotClick("belt")}
            onRemove={() => onRemoveSlot("belt")}
          />
        </div>

        {/* Row 3: Ring 2 */}
        <div className={styles.cellRing2}>
          <GearSlot
            slotKey="ring2"
            entry={gear.ring2}
            onClick={() => onSlotClick("ring2")}
            onRemove={() => onRemoveSlot("ring2")}
          />
        </div>

        {/* Row 3+4: Gloves */}
        <div className={styles.cellGloves}>
          <GearSlot
            slotKey="gloves"
            entry={gear.gloves}
            onClick={() => onSlotClick("gloves")}
            onRemove={() => onRemoveSlot("gloves")}
          />
        </div>

        {/* Row 3+4: Boots */}
        <div className={styles.cellBoots}>
          <GearSlot
            slotKey="boots"
            entry={gear.boots}
            onClick={() => onSlotClick("boots")}
            onRemove={() => onRemoveSlot("boots")}
          />
        </div>
      </div>
    </div>
  );
}
