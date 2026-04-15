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
    }
  >;
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
  Customizations,
  GemData,
} from "./types/customizations";

export { DEFAULT_CUSTOMIZATIONS } from "./types/customizations";
