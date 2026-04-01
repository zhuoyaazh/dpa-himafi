import { useEffect, useState } from "react";

type CountdownTime = {
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
};

// Use a fixed deadline so countdown does not roll over to the next day.
// Can be overridden in env: NEXT_PUBLIC_VOTING_CLOSE_AT=2026-04-01T23:59:59+07:00
const DEFAULT_VOTING_CLOSE_AT = "2026-04-01T23:59:59+07:00";

function resolveVotingDeadline() {
  const rawDeadline = process.env.NEXT_PUBLIC_VOTING_CLOSE_AT ?? DEFAULT_VOTING_CLOSE_AT;
  const parsed = new Date(rawDeadline);

  if (Number.isNaN(parsed.getTime())) {
    return new Date(DEFAULT_VOTING_CLOSE_AT);
  }

  return parsed;
}

export function useVotingCountdown() {
  const [time, setTime] = useState<CountdownTime>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    const deadline = resolveVotingDeadline();

    function calculateCountdown() {
      const now = new Date();

      if (now >= deadline) {
        setTime({
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true,
        });
        return;
      }

      const diff = deadline.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTime({
        hours,
        minutes,
        seconds,
        isExpired: false,
      });
    }

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  return time;
}
