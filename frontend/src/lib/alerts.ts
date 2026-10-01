/**
 * Device Alert, Ringtone & Vibration Engine for CareCircle
 * Provides loud, audible phone ringtone synthesis via Web Audio API,
 * customizable volume/loudness level, hardware vibration via navigator.vibrate,
 * and native bridge dispatch.
 */

export function playWebRingtone(durationSeconds: number = 3.5, volume: number = 1.0): () => void {
  try {
    const AudioContextClass =
      typeof window !== 'undefined'
        ? window.AudioContext || (window as any).webkitAudioContext
        : null;

    if (!AudioContextClass) return () => {};

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    let isStopped = false;
    const activeOscillators: OscillatorNode[] = [];

    // Scaled peak volume: full volume gives punchy 0.9 gain
    const safeVolume = Math.max(0.1, Math.min(1.0, volume));
    const peakGain = safeVolume * 0.85;

    const playBellTones = (startTime: number, toneDuration: number) => {
      if (isStopped) return;

      // Dual frequencies (US/European telephone standard: 440 Hz + 480 Hz)
      // plus harmonic overtone (880 Hz) for clear, loud acoustic resonance
      const freqs = [
        { f: 440, type: 'sine' as OscillatorType, weight: 0.5 },
        { f: 480, type: 'sine' as OscillatorType, weight: 0.5 },
        { f: 880, type: 'triangle' as OscillatorType, weight: 0.2 },
      ];

      freqs.forEach(({ f, type, weight }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(f, ctx.currentTime + startTime);

        const toneGain = peakGain * weight;
        gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
        gain.gain.linearRampToValueAtTime(toneGain, ctx.currentTime + startTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + toneDuration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + toneDuration);

        activeOscillators.push(osc);
      });
    };

    // Standard phone ring cadence: Ring (0.75s) -> Pause (0.35s) -> Ring (0.75s) -> Pause (0.35s) -> Ring (0.75s)
    const ringTones = [
      { start: 0.0, dur: 0.75 },
      { start: 1.1, dur: 0.75 },
      { start: 2.2, dur: 0.75 },
    ];

    ringTones.forEach(({ start, dur }) => {
      playBellTones(start, dur);
    });

    const stop = () => {
      isStopped = true;
      try {
        activeOscillators.forEach((osc) => {
          try {
            osc.stop();
          } catch {}
        });
        ctx.close().catch(() => {});
      } catch {}
    };

    setTimeout(() => {
      stop();
    }, durationSeconds * 1000);

    return stop;
  } catch (err) {
    console.warn('Web Audio synthesis note:', err);
    return () => {};
  }
}

export function triggerDeviceTestAlert(): () => void {
  const isNative =
    typeof window !== 'undefined' &&
    (Boolean((window as any).ReactNativeWebView) || Boolean((window as any).CareCircleNative?.isNative));

  // 1. In mobile companion: dispatch to native shell to ring phone's real system ringtone & trigger hardware vibration
  if (isNative) {
    try {
      (window as any).ReactNativeWebView?.postMessage(
        JSON.stringify({ type: 'TEST_ALARM' })
      );
    } catch {}
    return () => {};
  }

  // 2. Hardware vibration via Browser Web API
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate([0, 800, 400, 800, 400, 800]);
    } catch {}
  }

  // 3. Desktop/browser fallback: play synthesized audio tone
  const stopAudio = playWebRingtone(3.5, 1.0);

  return () => {
    stopAudio();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(0);
      } catch {}
    }
  };
}
