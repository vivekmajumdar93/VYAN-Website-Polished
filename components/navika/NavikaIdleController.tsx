'use client';

import { useEffect } from 'react';
import { useNavikaStore, IdleAnimationType } from '../../store/navikaStore';

const IDLE_POOL: IdleAnimationType[] = [
  'headTilt', 'lookLeft', 'lookRight', 'rotate20',
  'inspectParticle', 'spinSlow', 'floatHigher', 'stretch', 'closeEyes',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function NavikaIdleController() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function schedule() {
      const delay = 8000 + Math.random() * 14000;
      timer = setTimeout(() => {
        const { triggerIdle, triggerRipplePulse, pointerActive } = useNavikaStore.getState();
        if (!pointerActive) {
          if (Math.random() < 0.15) {
            triggerRipplePulse();
          } else {
            triggerIdle(pickRandom(IDLE_POOL));
          }
        }
        schedule();
      }, delay);
    }

    schedule();
    return () => clearTimeout(timer);
  }, []);

  return null;
}
