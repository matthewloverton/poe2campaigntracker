import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useTimerStore } from "./timerStore";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(""),
}));

/**
 * Regression tests for: act splits include pause time, desyncing from total timer.
 *
 * The total timer (pausedElapsed + (now - startedAt)) correctly excludes pause
 * duration. Act splits must share the same accounting — otherwise the sum of
 * act splits > total elapsed after any mid-act pause.
 */
describe("timerStore — act splits & pause accounting", () => {
  let now = 1_000_000;
  const advance = (ms: number) => {
    now += ms;
  };
  const getStore = () => useTimerStore.getState();

  beforeEach(() => {
    useTimerStore.setState({
      state: "stopped",
      startedAt: null,
      pausedElapsed: 0,
      currentAct: 1,
      actSplits: {},
      runHistory: [],
    });
    now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("act 1 elapsed excludes a mid-act pause before splitting", () => {
    getStore().start();
    advance(10_000); // 10s active in act 1
    getStore().pause();
    advance(60_000); // 60s paused — should NOT count toward act 1
    getStore().resume();
    advance(5_000); // 5s more active in act 1
    getStore().splitAct(2);

    expect(getStore().actSplits[1].elapsed).toBe(15_000);
  });

  it("sum of completed act splits + current act live time equals total elapsed", () => {
    getStore().start();
    advance(10_000);
    getStore().splitAct(2);

    getStore().pause();
    advance(30_000); // pause during act 2
    getStore().resume();

    advance(5_000);
    getStore().splitAct(3);

    advance(3_000); // still in act 3

    const state = getStore();
    const total =
      state.pausedElapsed +
      (state.startedAt != null ? Date.now() - state.startedAt : 0);

    const completedSum = Object.values(state.actSplits)
      .map((s) => s.elapsed ?? 0)
      .reduce((a, b) => a + b, 0);

    // Completed splits (acts 1 & 2) should leave a remainder for current (act 3)
    // equal to total - completedSum. With the bug, completedSum > total.
    expect(completedSum).toBeLessThanOrEqual(total);
    expect(total - completedSum).toBe(3_000); // time in act 3 so far
  });

  it("act 2 elapsed excludes pause time (second pause scenario)", () => {
    getStore().start();
    advance(10_000);
    getStore().splitAct(2);

    // 20s active in act 2, pause for 2 min, 10s more active, then split
    advance(20_000);
    getStore().pause();
    advance(120_000);
    getStore().resume();
    advance(10_000);
    getStore().splitAct(3);

    expect(getStore().actSplits[2].elapsed).toBe(30_000);
  });
});
