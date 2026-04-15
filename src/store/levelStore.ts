import { create } from "zustand";

interface LevelState {
  characterName: string | null;
  characterClass: string | null;
  level: number;
  setLevel: (level: number, name: string | null, charClass: string | null) => void;
}

export const useLevelStore = create<LevelState>((set) => ({
  characterName: null,
  characterClass: null,
  level: 0,
  setLevel: (level, name, charClass) =>
    set({
      level,
      characterName: name,
      characterClass: charClass,
    }),
}));
