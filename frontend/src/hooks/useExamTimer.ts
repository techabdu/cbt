"use client";

import * as React from "react";

/**
 * Counts down to the server-authoritative end time, correcting for any drift
 * between the client and offline-server clocks. Uses Date.now() diffing rather
 * than accumulating setInterval ticks so it stays accurate even if the tab is
 * backgrounded.
 */
export function useExamTimer(endsAt: string, serverTime: string, onExpire: () => void) {
  // Skew: how far ahead the client clock is vs the server (ms).
  const skew = React.useMemo(
    () => Date.now() - new Date(serverTime).getTime(),
    [serverTime]
  );
  const endClientMs = React.useMemo(
    () => new Date(endsAt).getTime() + skew,
    [endsAt, skew]
  );

  const compute = React.useCallback(
    () => Math.max(0, Math.round((endClientMs - Date.now()) / 1000)),
    [endClientMs]
  );

  const [remaining, setRemaining] = React.useState(compute);
  const firedRef = React.useRef(false);

  React.useEffect(() => {
    const tick = () => {
      const next = compute();
      setRemaining(next);
      if (next <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpire();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [compute, onExpire]);

  return remaining;
}

export function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
