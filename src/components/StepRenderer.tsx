import type { StepToken } from "../types";
import styles from "./StepRenderer.module.css";

/** Replace underscores with spaces for display (Exile-UI uses _ as word separator) */
function displayText(text: string): string {
  return text.replace(/_/g, " ");
}

/** Title Case a string */
function titleCase(text: string): string {
  return text.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Capitalize first letter of a string */
function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

interface StepRendererProps {
  tokens: StepToken[];
  isHint: boolean;
  isOptional?: boolean;
  isOptionalHint?: boolean;
  isLast?: boolean;
}

export function StepRenderer({ tokens, isHint, isOptional, isOptionalHint, isLast }: StepRendererProps) {
  const classNames = [
    styles.step,
    isHint && styles.hint,
    isOptional && styles.optional,
    isOptionalHint && styles.optionalHint,
    isLast && !isHint && styles.lastStep,
  ].filter(Boolean).join(" ");

  // Strip "optional: " prefix from tokens when we're showing the OPTIONAL tag
  const displayTokens = isOptional && !isHint ? stripOptionalPrefix(tokens) : tokens;

  return (
    <div className={classNames}>
      {isOptional && !isHint && <span className={styles.optionalTag}>optional</span>}
      {renderTokens(displayTokens)}
    </div>
  );
}

/** Remove leading "optional: " or "optional:" text from token list */
function stripOptionalPrefix(tokens: StepToken[]): StepToken[] {
  const result = [...tokens];
  if (result.length > 0 && result[0].type === "text") {
    const stripped = result[0].value.replace(/^optional:\s*/i, "");
    if (stripped) {
      result[0] = { ...result[0], value: stripped };
    } else {
      result.shift();
    }
  }
  return result;
}

/** Known NPC and boss names from the PoE2 campaign (lowercase → display name) */
const KNOWN_NAMES: Record<string, string> = {
  // Bosses
  "the_bloated_miller": "The Bloated Miller",
  "queen_of_filth": "Queen of Filth",
  "azarian": "Azarian",
  "elswyth": "Elswyth",
  "jamanra": "Jamanra",
  "ketzuli": "Ketzuli",
  "lachlann": "Lachlann",
  "mektul": "Mektul",
  "omniphobia": "Omniphobia",
  "oswin": "Oswin",
  "rudja": "Rudja",
  "siora": "Siora",
  "the_arbiter_of_ash": "The Arbiter of Ash",
  "torvian": "Torvian",
  "zalmarath": "Zalmarath",
  "zicoatl": "Zicoatl",
  "beira": "Beira",
  "crowbell": "Crowbell",
  "geonor": "Geonor",
  // NPCs
  "renly": "Renly",
  "una": "Una",
  "alva": "Alva",
  "asala": "Asala",
  "finn": "Finn",
  "hilda": "Hilda",
  "navali": "Navali",
  "oswald": "Oswald",
  "dannig": "Dannig",
  "tujen": "Tujen",
  "risu": "Risu",
  "doryani": "Doryani",
  "makoru": "Makoru",
  "leitis": "Leitis",
  "servi": "Servi",
  "shambrin": "Shambrin",
  "zarka": "Zarka",
  "blackjaw": "Blackjaw",
  "silverfist": "Silverfist",
  "tor_gul": "Tor Gul",
  "chimera": "Chimera",
  "halani": "Halani",
};

/** Replace known names with their proper capitalization */
function formatNames(text: string): string {
  let result = text;
  for (const [key, display] of Object.entries(KNOWN_NAMES)) {
    const pattern = new RegExp(`\\b${key.replace(/_/g, "[_ ]")}\\b`, "gi");
    result = result.replace(pattern, display);
  }
  return result;
}

function renderTokens(tokens: StepToken[]) {
  let currentColor: string | undefined;
  let isFirstText = true;
  return tokens.map((token, i) => {
    if (token.type === "color_start") {
      currentColor = token.color;
      return null;
    }
    if (token.type === "text" && currentColor) {
      const color = currentColor;
      currentColor = undefined;
      let text = formatNames(displayText(token.value));
      if (isFirstText) { text = capitalizeFirst(text); isFirstText = false; }
      return <span key={i} style={{ color: color.startsWith("#") ? color : `#${color}` }}>{text}</span>;
    }
    if (token.type === "text") {
      let text = formatNames(displayText(token.value));
      if (isFirstText) { text = capitalizeFirst(text); }
      isFirstText = false;
      return <span key={i}>{text}</span>;
    }
    isFirstText = false;
    return renderToken(token, i);
  });
}

function renderToken(token: StepToken, key: number) {
  switch (token.type) {
    case "text": return <span key={key}>{displayText(token.value)}</span>;
    case "icon": return (
      <img
        key={key}
        src={`/icons/${token.value}.png`}
        alt={token.value}
        title={token.value}
        className={styles.icon}
      />
    );
    case "color_start": return null;
    case "zone": return <span key={key} className={styles.zone}>{titleCase(displayText(token.value))}</span>;
    case "arena": return <span key={key} className={styles.arena}>{titleCase(displayText(token.value))}</span>;
    case "quest": return <span key={key} className={styles.quest}>🏆 {displayText(token.value)}</span>;
    case "separator": return <span key={key} className={styles.separator}> → </span>;
    case "kill": return <span key={key} className={styles.kill}>kill</span>;
    default: return <span key={key}>{token.value}</span>;
  }
}
