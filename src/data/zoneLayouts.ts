/**
 * Zone layout image mappings from Mobalytics campaign layout guides.
 * Maps lowercase zone names (matching areas.json) to layout image filenames.
 * Images stored in /public/assets/layouts/
 */

const LAYOUTS_BASE = "/assets/layouts/";

/** Map of zone name (lowercase) → layout image filename(s) */
const ZONE_LAYOUT_MAP: Record<string, string[]> = {
  // Act 1
  "clearfell": ["Clearfell-Seed-1-Pilot.png", "Clearfell-Seed-2-Pilot.png"],
  "the grelwood": ["Grelwood-Pilot.png"],
  "the red vale": ["Red-Vale-Pilot.png"],
  "the grim tangle": ["Grim-Tangle-Pilot.png"],
  "cemetery of the eternals": ["Cemetery-Pilot.png"],
  "mausoleum of the praetor": ["Praetor-Pilot.png"],
  "tomb of the consort": ["Consort-Pilot.png"],
  "hunting grounds": ["Hunting-Grounds-Pilot.png", "Hunting-Grounds-Boss.png"],
  "freythorn": ["Freythorn-Pilot.png"],
  "ogham farmlands": ["Farmlands-Pilot.png", "Ogham-Clue.png"],
  "ogham village": ["Ogham-Village-Pilot.png"],
  "the manor ramparts": ["Manor-Ramparts-Pilot.png"],
  "ogham manor": ["Ogham-Manor-First.png", "Ogham-Manor-Second.png", "Ogham-Manor-Third.png"],

  // Act 2
  "vastiri outskirts": ["A2-01-Vastiri-Outskirts-No-Text.png"],
  "mawdun quarry": ["A2-02-Mawdun-Quarry.png"],
  "mawdun mine": ["A2-03-Mawdun-Mine.png"],
  "traitor's passage": ["A2-04-Traitors-Passage.png", "A2-04-Traitors-Passage-ESS.png"],
  "halani gates": ["A2-05-Halani-Gates.png"],
  "keth": ["A2-06-Keth.png"],
  "the lost city": ["A2-07-Lost-City.png"],
  "buried shrines": ["A2-08-Buried-Shrines.png"],
  "valley of the titans": ["A2-09-Valley-Of-The-Titans.png"],
  "the titan grotto": ["A2-10-Titan-Grotto.png"],
  "deshar": ["A2-11-Deshar.png"],
  "path of mourning": ["A2-12-Path-Of-Mourning.png"],
  "mastodon badlands": ["A2-13-Mastodon-Badlands.png"],
  "the bone pits": ["A2-14-Bone-Pits.png"],
  "the spires of deshar": ["A2-15-Spires-of-Deshar.png"],
  "the dreadnought": ["A2-16-Dreadnought.png"],
  "dreadnought vanguard": ["A2-16-Dreadnought.png"],

  // Act 3
  "sandswept marsh": ["A3-01-Sandswept-Marsh.png"],
  "jungle ruins": ["A3-02-Jungle-Ruins-2.png"],
  "infested barrens": ["A3-03-Infested-Barrens.png"],
  "azak bog": ["A3-14-Azak-Bog.png"],
  "chimeral wetlands": ["A3-04-Chimeral-Wetlands.png"],
  "jiquani's machinarium": ["A3-05-Jinquanis-Machinarium.png"],
  "jiquani's sanctum": ["A3-06-Jinquanis-Sanctum.png"],
  "the matlan waterways": ["A3-07-Matlan-Waterways.png"],
  "drowned city": ["A3-Drowned-City-Update.png"],
  "the drowned city": ["A3-Drowned-City-Update.png"],
  "apex of filth": ["A3-Apex-of-Filth-Updated.png"],
  "temple of kopec": ["A3-10-Temple-of-Kopec.png"],
  "utzaal": ["A3-Utzaal.png"],
  "aggorat": ["A3-12-Aggorat.png"],
  "the black chambers": ["A3-13-Black-Chambers.png"],

  // Act 4
  "isle of kin": ["A4-01-Isle_of_Kin.png"],
  "volcanic warrens": ["A4-02-Volcanic-Warrens.png"],
  "kedge bay": ["A4-03-Kedge-Bay.png"],
  "journey's end": ["A4-04-Journeys_End.png"],
  "shrike island": ["A4-05-Shrike-Island.png"],
  "whakapanu island": ["A4-06-Whakapanu_Island.png"],
  "singing caverns": ["A4-07-Singing-Caverns.png"],
  "solitary confinement": ["A4-09-Solitary-Confinement.png"],
  "eye of hinekora": ["A4-10-Eye-of-Hinekora.png"],
  "halls of the dead": ["A4-11-Halls-of-the-Dead.png"],
  "arastas": ["A4-12-Arastas.png"],
  "the excavation": ["A4-13-Excavation.png"],
  "ngakanu": ["A4-14-Ngakanu.png"],
  "heart of the tribe": ["A4-15-Heart-of-the-tribe.png"],
};

/** Get layout image paths for a zone name */
export function getZoneLayouts(zoneName: string): string[] {
  const layouts = ZONE_LAYOUT_MAP[zoneName.toLowerCase()];
  if (!layouts) return [];
  return layouts.map((f) => `${LAYOUTS_BASE}${f}`);
}

/** All layout image URLs for downloading */
export function getAllLayoutUrls(): { filename: string; url: string }[] {
  const seen = new Set<string>();
  const results: { filename: string; url: string }[] = [];

  // CDN base URLs differ by act
  const CDN_URLS: Record<string, string> = {
    "Clearfell-Seed-1-Pilot.png": "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Clearfell-Seed-1-Pilot.png",
    "Clearfell-Seed-2-Pilot.png": "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Clearfell-Seed-2-Pilot.png",
    "Grelwood-Pilot.png": "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Grelwood-Pilot.png",
    "Red-Vale-Pilot.png": "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Red-Vale-Pilot.png",
    "Grim-Tangle-Pilot.png": "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Grim-Tangle-Pilot.png",
    "Cemetery-Pilot.png": "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Cemetery-Pilot.png",
    "Praetor-Pilot.png": "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Praetor-Pilot.png",
    "Consort-Pilot.png": "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Consort-Pilot.png",
    "Hunting-Grounds-Pilot.png": "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Hunting-Grounds-Pilot.png",
    "Hunting-Grounds-Boss.png": "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Hunting-Grounds-Boss.png",
    "Freythorn-Pilot.png": "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Freythorn-Pilot.png",
    "Farmlands-Pilot.png": "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Farmlands-Pilot.png",
    "Ogham-Clue.png": "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Ogham-Clue.png",
    "Ogham-Village-Pilot.png": "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Ogham-Village-Pilot.png",
    "Manor-Ramparts-Pilot.png": "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Manor-Ramparts-Pilot.png",
    "Ogham-Manor-First.png": "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Ogham-Manor-First.png",
    "Ogham-Manor-Second.png": "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Ogham-Manor-Second.png",
    "Ogham-Manor-Third.png": "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Ogham-Manor-Third.png",
    // Act 2
    "A2-01-Vastiri-Outskirts-No-Text.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-01-Vastiri-Outskirts-No-Text.png",
    "A2-02-Mawdun-Quarry.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-02-Mawdun-Quarry.png",
    "A2-03-Mawdun-Mine.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-03-Mawdun-Mine.png",
    "A2-04-Traitors-Passage.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-04-Traitors-Passage.png",
    "A2-04-Traitors-Passage-ESS.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-04-Traitors-Passage-ESS.png",
    "A2-05-Halani-Gates.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-05-Halani-Gates.png",
    "A2-06-Keth.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-06-Keth.png",
    "A2-07-Lost-City.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-07-Lost-City.png",
    "A2-08-Buried-Shrines.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-08-Buried-Shrines.png",
    "A2-09-Valley-Of-The-Titans.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-09-Valley-Of-The-Titans.png",
    "A2-10-Titan-Grotto.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-10-Titan-Grotto.png",
    "A2-11-Deshar.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-11-Deshar.png",
    "A2-12-Path-Of-Mourning.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-12-Path-Of-Mourning.png",
    "A2-13-Mastodon-Badlands.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-13-Mastodon-Badlands.png",
    "A2-14-Bone-Pits.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-14-Bone-Pits.png",
    "A2-15-Spires-of-Deshar.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-15-Spires-of-Deshar.png",
    "A2-16-Dreadnought.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-16-Dreadnought.png",
    // Act 3
    "A3-01-Sandswept-Marsh.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a3-layouts/A3-01-Sandswept-Marsh.png",
    "A3-02-Jungle-Ruins-2.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a3-layouts/A3-02-Jungle-Ruins-2.png",
    "A3-03-Infested-Barrens.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a3-layouts/A3-03-Infested-Barrens.png",
    "A3-14-Azak-Bog.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a3-layouts/A3-14-Azak-Bog.png",
    "A3-04-Chimeral-Wetlands.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a3-layouts/A3-04-Chimeral Wetlands.png",
    "A3-05-Jinquanis-Machinarium.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a3-layouts/A3-05-Jinquanis-Machinarium.png",
    "A3-06-Jinquanis-Sanctum.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a3-layouts/A3-06-Jinquanis-Sanctum.png",
    "A3-07-Matlan-Waterways.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a3-layouts/A3-07-Matlan-Waterways.png",
    "A3-Drowned-City-Update.png": "https://cdn.mobalytics.gg/uploads/images/poe-2/A3-Drowned-City-Update.png",
    "A3-Apex-of-Filth-Updated.png": "https://cdn.mobalytics.gg/uploads/images/poe-2/A3-Apex-of-Filth-Updated.png",
    "A3-10-Temple-of-Kopec.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a3-layouts/A3-10-Temple-of-Kopec.png",
    "A3-Utzaal.png": "https://cdn.mobalytics.gg/uploads/images/poe-2/a3-utzaal.png",
    "A3-12-Aggorat.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a3-layouts/A3-12-Aggorat.png",
    "A3-13-Black-Chambers.png": "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a3-layouts/A3-13-Black-Chambers.png",
    // Act 4
    "A4-01-Isle_of_Kin.png": "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-01-Isle_of_Kin.png",
    "A4-02-Volcanic-Warrens.png": "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-02-Volcanic-Warrens.png",
    "A4-03-Kedge-Bay.png": "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-03-Kedge%20Bay.png",
    "A4-04-Journeys_End.png": "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-04-Journeys_End.png",
    "A4-05-Shrike-Island.png": "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-05-Shrike%20Island.png",
    "A4-06-Whakapanu_Island.png": "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-06-Whakapanu_Island.png",
    "A4-07-Singing-Caverns.png": "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-07-Singing-Caverns.png",
    "A4-09-Solitary-Confinement.png": "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-09-Solitary-Confinement.png",
    "A4-10-Eye-of-Hinekora.png": "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-10-Eye%20of%20Hinekora.png",
    "A4-11-Halls-of-the-Dead.png": "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-11-Halls-of-the-Dead.png",
    "A4-12-Arastas.png": "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-12-Arastas.png",
    "A4-13-Excavation.png": "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-13-Excavation.png",
    "A4-14-Ngakanu.png": "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-14-Ngakanu.png",
    "A4-15-Heart-of-the-tribe.png": "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-15-Heart-of-the-tribe.png",
  };

  for (const filenames of Object.values(ZONE_LAYOUT_MAP)) {
    for (const filename of filenames) {
      if (seen.has(filename)) continue;
      seen.add(filename);
      const url = CDN_URLS[filename];
      if (url) results.push({ filename, url });
    }
  }

  return results;
}
