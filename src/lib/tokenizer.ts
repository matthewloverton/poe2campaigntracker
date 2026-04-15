import type { StepToken } from "../types";

const PATTERNS = {
  hint: /^\(hint\)_+\s*/,
  icon: /\(img:([a-z0-9_-]+)\)/,
  color: /\(color:([a-z0-9]+)\)/,
  zone: /areaid(\w+).*?;;\s*([^|]+?)(?=\s*\||$)/,
  arena: /arena:(\w+)/,
  quest: /\(quest:([^)]+)\)/,
  separator: /\|\|/,
  kill: /^kill (\w*_\w*)/,
};

type Candidate = { index: number; length: number; token: StepToken };

function pickEarliest(current: Candidate | null, next: Candidate): Candidate {
  if (!current || next.index < current.index) return next;
  return current;
}

export function tokenize(raw: string): StepToken[] {
  const tokens: StepToken[] = [];
  let input = raw;

  // Strip hint prefix
  const hintMatch = input.match(PATTERNS.hint);
  if (hintMatch) {
    input = input.slice(hintMatch[0].length);
  }

  // Strip leading "kill " — emit as kill token
  const killMatch = input.match(PATTERNS.kill);
  if (killMatch) {
    tokens.push({ type: "kill", value: "kill" });
    input = input.slice(4);
  }

  while (input.length > 0) {
    let earliest: { index: number; length: number; token: StepToken } | null = null;

    // Icon
    const iconMatch = input.match(PATTERNS.icon);
    if (iconMatch && iconMatch.index !== undefined) {
      const candidate = {
        index: iconMatch.index,
        length: iconMatch[0].length,
        token: { type: "icon" as const, value: iconMatch[1] },
      };
      earliest = pickEarliest(earliest, candidate);
    }

    // Color
    const colorMatch = input.match(PATTERNS.color);
    if (colorMatch && colorMatch.index !== undefined) {
      const candidate = {
        index: colorMatch.index,
        length: colorMatch[0].length,
        token: { type: "color_start" as const, value: "", color: colorMatch[1] },
      };
      earliest = pickEarliest(earliest, candidate);
    }

    // Zone
    const zoneMatch = input.match(PATTERNS.zone);
    if (zoneMatch && zoneMatch.index !== undefined) {
      const candidate = {
        index: zoneMatch.index,
        length: zoneMatch[0].length,
        token: { type: "zone" as const, value: zoneMatch[2].trim(), zoneId: zoneMatch[1].toLowerCase() },
      };
      earliest = pickEarliest(earliest, candidate);
    }

    // Arena
    const arenaMatch = input.match(PATTERNS.arena);
    if (arenaMatch && arenaMatch.index !== undefined) {
      const candidate = {
        index: arenaMatch.index,
        length: arenaMatch[0].length,
        token: { type: "arena" as const, value: arenaMatch[1] },
      };
      earliest = pickEarliest(earliest, candidate);
    }

    // Quest
    const questMatch = input.match(PATTERNS.quest);
    if (questMatch && questMatch.index !== undefined) {
      const candidate = {
        index: questMatch.index,
        length: questMatch[0].length,
        token: { type: "quest" as const, value: questMatch[1] },
      };
      earliest = pickEarliest(earliest, candidate);
    }

    // Separator
    const sepMatch = input.match(PATTERNS.separator);
    if (sepMatch && sepMatch.index !== undefined) {
      const candidate = {
        index: sepMatch.index,
        length: sepMatch[0].length,
        token: { type: "separator" as const, value: "||" },
      };
      earliest = pickEarliest(earliest, candidate);
    }

    if (earliest) {
      if (earliest.index > 0) {
        tokens.push({ type: "text", value: input.slice(0, earliest.index) });
      }
      tokens.push(earliest.token);
      input = input.slice(earliest.index + earliest.length);
    } else {
      if (input.length > 0) {
        tokens.push({ type: "text", value: input });
      }
      break;
    }
  }

  return tokens;
}
