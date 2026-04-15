import { useState, useEffect } from "react";
import { useTimerStore } from "../store/timerStore";

export function useTimerTick(): number {
  const timerState = useTimerStore((s) => s.state);
  const startedAt = useTimerStore((s) => s.startedAt);
  const pausedElapsed = useTimerStore((s) => s.pausedElapsed);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (timerState === "running" && startedAt) {
      const interval = setInterval(() => {
        setElapsed(pausedElapsed + (Date.now() - startedAt));
      }, 100);
      return () => clearInterval(interval);
    } else if (timerState === "paused") {
      setElapsed(pausedElapsed);
    } else {
      setElapsed(0);
    }
  }, [timerState, startedAt, pausedElapsed]);

  return elapsed;
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
