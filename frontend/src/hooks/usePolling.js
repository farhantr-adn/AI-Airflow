/** usePolling - polls a fetcher every `interval` ms while `enabled` is true. */
import { useEffect } from "react";

export function usePolling(fetcher, interval, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    const t = setInterval(fetcher, interval);
    return () => clearInterval(t);
  }, [fetcher, interval, enabled]);
}
