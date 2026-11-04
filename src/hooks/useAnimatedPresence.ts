import { useEffect, useState } from 'react';

export default function useAnimatedPresence(open: boolean, exitDuration = 280) {
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    let visibleFrame = 0;
    let exitTimer = 0;

    if (open) {
      setRendered(true);
      frame = window.requestAnimationFrame(() => {
        visibleFrame = window.requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      exitTimer = window.setTimeout(() => setRendered(false), exitDuration);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(visibleFrame);
      window.clearTimeout(exitTimer);
    };
  }, [exitDuration, open]);

  return { rendered, visible };
}
