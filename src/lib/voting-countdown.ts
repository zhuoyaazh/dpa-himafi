import { useEffect, useState } from "react";

type CountdownTime = {
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
};

export function useVotingCountdown() {
  const [time, setTime] = useState<CountdownTime>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    function calculateCountdown() {
      const now = new Date();
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      if (now > today) {
        setTime({
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true,
        });
        return;
      }

      const diff = today.getTime() - now.getTime();
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
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
