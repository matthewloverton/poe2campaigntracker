// === Guide Data Types ===

export interface GuidePage {
  act: number; // 1-4 for campaign, 5-7 for postgame, 8 for endgame
  pageIndex: number; // index within the act
  globalIndex: number; // index across all pages
  targetAreaId: string; // zone ID that triggers advance (last areaid on page)
  targetZoneName: string; // human-readable zone name
  steps: GuideStep[];
  condition?: GuideCondition; // if this page is conditional
}

export interface GuideCondition {
  key: string; // e.g. "league-start"
  value: string; // e.g. "yes" or "no"
}

export interface GuideStep {
  raw: string; // original markup string
  tokens: StepToken[];
  isHint: boolean;
}

export type StepTokenType =
  | "text"
  | "icon"
  | "color_start"
  | "color_end"
  | "zone"
  | "arena"
  | "quest"
  | "separator"
  | "kill";

export interface StepToken {
  type: StepTokenType;
  value: string;
  color?: string;
  zoneId?: string;
}

// === Area Data Types ===

export interface Area {
  id: string;
  name: string;
  act: number;
  recommendation?: { min: number; max: number };
}

// === Persistence Types ===

export interface Settings {
  clientTxtPath: string | null;
  fontSize: number;
  displayMode: "companion" | "overlay";
  guide: string;
  notifications: {
    autoAdvance: boolean;
    gemAlerts: boolean;
    vendorReminders: boolean;
  };
  autoShowVendorRegex: boolean;
}

export interface Progress {
  currentPageIndex: number;
  timerState: "stopped" | "running" | "paused";
  timerStartedAt: string | null;
  timerPausedElapsed: number;
  actSplits: Record<
    string,
    {
      startedAt: string;
      completedAt: string | null;
      elapsed: number | null;
      // Total active-play ms when this act started. Used for split math so
      // pause time is excluded (matches top-level totalElapsed accounting).
      // Optional for back-compat with runs saved before this field existed.
      startedAtTotal?: number;
    }
  >;
}

export interface CompletedRun {
  id: string;
  date: string; // ISO string
  totalElapsed: number; // ms
  characterName: string | null;
  characterClass: string | null;
  finalLevel: number;
  actSplits: Record<
    string,
    {
      startedAt: string;
      completedAt: string | null;
      elapsed: number | null;
      startedAtTotal?: number;
    }
  >;
}

/** Page entry as persisted: either a plain page or a conditional page. */
export type StoredEntry =
  | { type: "page"; lines: string[] }
  | { type: "conditional"; condition: [string, string]; lines: string[] };

/** One act in a stored guide. `entries` preserves page order. */
export interface StoredAct {
  entries: StoredEntry[];
}

/** A user-editable guide persisted in guides.json. */
export interface StoredGuide {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  acts: StoredAct[];
  activeConditions: Record<string, string>;
}

/** On-disk shape of guides.json */
export interface GuidesFile {
  version: 1;
  activeGuideId: string;   // "default" or a StoredGuide.id
  guides: StoredGuide[];   // user-created only; default is bundled
}

export interface ZoneChangeEvent {
  areaId: string;
  level: number;
  timestamp: string;
}

export interface LevelUpEvent {
  characterName: string;
  level: number;
  class: string;
  timestamp: string;
}

// === Default Values ===

export const DEFAULT_SETTINGS: Settings = {
  clientTxtPath: null,
  fontSize: 14,
  displayMode: "companion",
  guide: "default",
  notifications: {
    autoAdvance: true,
    gemAlerts: true,
    vendorReminders: true,
  },
  autoShowVendorRegex: true,
};

export const DEFAULT_PROGRESS: Progress = {
  currentPageIndex: 0,
  timerState: "stopped",
  timerStartedAt: null,
  timerPausedElapsed: 0,
  actSplits: {},
};

export type {
  BuildPhase,
  BuildGemEntry,
  BuildGearEntry,
  StepReminder,
  PhaseTrigger,
  GearLayout,
  SkillGroup,
  GearSlotKey,
} from "./types/buildPlan";

export { DEFAULT_BUILD_PHASE, EMPTY_GEAR_LAYOUT, GEAR_SLOT_LABELS, SLOT_ITEM_CLASSES } from "./types/buildPlan";

export type {
  VendorRegexEntry,
  InlineNote,
  WatchlistEntry,
  FavouriteCraft,
  Customizations,
  GemData,
} from "./types/customizations";

export { DEFAULT_CUSTOMIZATIONS } from "./types/customizations";
