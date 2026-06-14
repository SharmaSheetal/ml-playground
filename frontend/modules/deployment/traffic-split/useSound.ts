'use client';

import { useRef, useCallback } from 'react';

export function useSound(muted: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);

  function ctx(): AudioContext {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    return ctxRef.current;
  }

  const tone = useCallback(
    (freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.08) => {
      if (muted) return;
      try {
        const c = ctx();
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.connect(gain);
        gain.connect(c.destination);
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
        osc.start(c.currentTime);
        osc.stop(c.currentTime + dur);
      } catch {}
    },
    [muted]
  );

  const playPacket = useCallback(
    (version: 'v1' | 'v2') => tone(version === 'v1' ? 720 : 560, 0.06),
    [tone]
  );

  const playError = useCallback(
    () => tone(180, 0.18, 'sawtooth', 0.12),
    [tone]
  );

  const playDegrade = useCallback(() => {
    [440, 350, 260].forEach((f, i) =>
      setTimeout(() => tone(f, 0.22, 'square', 0.1), i * 110)
    );
  }, [tone]);

  const playRecover = useCallback(() => {
    [320, 480].forEach((f, i) =>
      setTimeout(() => tone(f, 0.18, 'sine', 0.09), i * 100)
    );
  }, [tone]);

  return { playPacket, playError, playDegrade, playRecover };
}
