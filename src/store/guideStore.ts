import { create } from "zustand";
import { guidePages, getGuidePages } from "../data/guide";
import type { GuidePage } from "../types";

interface GuideState {
  allPages: GuidePage[];
  pages: GuidePage[];
  currentPageIndex: number;
  conditions: Record<string, string>;
  currentZoneId: string | null;
  activeGuide: "default" | "custom";
  currentPage: GuidePage | null;
  currentAct: number;
  totalPages: number;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (globalIndex: number) => void;
  goToAct: (act: number) => void;
  setCondition: (key: string, value: string) => void;
  advanceToZone: (areaId: string) => void;
  setCurrentZone: (areaId: string) => void;
  setGuide: (guide: "default" | "custom") => void;
  reset: () => void;
}

function filterPages(allPages: GuidePage[], conditions: Record<string, string>): GuidePage[] {
  return allPages.filter((page) => {
    if (!page.condition) return true;
    const userChoice = conditions[page.condition.key];
    if (!userChoice) return true;
    return page.condition.value === userChoice;
  });
}


export const useGuideStore = create<GuideState>((set, get) => {
  const allPages = guidePages;
  const defaultConditions: Record<string, string> = { "league-start": "yes" };
  const filteredPages = filterPages(allPages, defaultConditions);

  return {
    allPages,
    pages: filteredPages,
    currentPageIndex: 0,
    conditions: defaultConditions,
    currentZoneId: null,
    activeGuide: "default" as "default" | "custom",

    get currentPage() { return get().pages[get().currentPageIndex] ?? null; },
    get currentAct() { return get().currentPage?.act ?? 1; },
    get totalPages() { return get().pages.length; },

    nextPage: () => set((s) => ({ currentPageIndex: Math.min(s.currentPageIndex + 1, s.pages.length - 1) })),
    prevPage: () => set((s) => ({ currentPageIndex: Math.max(s.currentPageIndex - 1, 0) })),
    goToPage: (globalIndex) => set((s) => {
      const idx = s.pages.findIndex((p) => p.globalIndex === globalIndex);
      return { currentPageIndex: idx >= 0 ? idx : s.currentPageIndex };
    }),
    goToAct: (act) => set((s) => {
      const idx = s.pages.findIndex((p) => p.act === act);
      return { currentPageIndex: idx >= 0 ? idx : s.currentPageIndex };
    }),
    setCondition: (key, value) => set((s) => {
      const conditions = { ...s.conditions, [key]: value };
      const pages = filterPages(s.allPages, conditions);
      return { conditions, pages, currentPageIndex: Math.min(s.currentPageIndex, pages.length - 1) };
    }),
    advanceToZone: (areaId) => set((s) => {
      const normalizedId = areaId.toLowerCase();
      const currentPage = s.pages[s.currentPageIndex];
      // Only advance if this zone matches the CURRENT page's target
      // (not future pages — the same zone may appear multiple times in the guide)
      if (currentPage && currentPage.targetAreaId === normalizedId) {
        const nextIdx = Math.min(s.currentPageIndex + 1, s.pages.length - 1);
        return { currentPageIndex: nextIdx, currentZoneId: normalizedId };
      }
      return { ...s, currentZoneId: normalizedId };
    }),
    setCurrentZone: (areaId) => set({ currentZoneId: areaId.toLowerCase() }),
    setGuide: (guide) => set((s) => {
      const newPages = getGuidePages(guide);
      const filtered = filterPages(newPages, s.conditions);
      return { allPages: newPages, pages: filtered, currentPageIndex: 0, activeGuide: guide };
    }),
    reset: () => set((s) => ({ currentPageIndex: 0, currentZoneId: null, pages: filterPages(s.allPages, s.conditions) })),
  };
});
