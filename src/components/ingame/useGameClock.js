// Chrono de partie et alertes (son, vibration, bandeau) : port de tick / fireAlert / startClock du coach LoL.
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { buildEvents } from '@/lib/inGame';

export const LEAD = 15; // secondes d'avance pour les alertes d'objectif
const PREF_KEY = 'dm_alerts';
const readPrefs = () => { try { return { sound: true, vibrate: true, ...(JSON.parse(localStorage.getItem(PREF_KEY) || '{}')) }; } catch (e) { return { sound: true, vibrate: true }; } };

let audioCtx = null;
function unlockAudio() {
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.resume) audioCtx.resume(); } catch (e) { /* pas de son */ }
}
function beep() {
  if (!audioCtx) return;
  try {
    const t0 = audioCtx.currentTime;
    [0, 0.22].forEach(d => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.35, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.18);
      o.start(t0 + d); o.stop(t0 + d + 0.2);
    });
  } catch (e) { /* rien */ }
}
const alertAt = e => (e.kind === 'ward' || e.kind === 'lane' ? e.t : e.t - LEAD);

export function useGameClock(match, timerStart, setTimerStart) {
  const [nowMs, setNowMs] = useState(Date.now());
  const [alert, setAlert] = useState(null);
  const [prefs, setPrefsState] = useState(readPrefs);
  const fired = useRef({});
  const wake = useRef(null);
  const events = useMemo(() => buildEvents(match, LEAD), [match]);
  const t = timerStart ? (nowMs - timerStart) / 1000 : null;

  const setPrefs = useCallback((p) => { setPrefsState(prev => { const n = { ...prev, ...p }; try { localStorage.setItem(PREF_KEY, JSON.stringify(n)); } catch (e) { /* rien */ } return n; }); }, []);

  // Les événements déjà passés ne sonnent pas (reprise, chrono recalé)
  const markPast = useCallback((start) => {
    fired.current = {};
    if (!start) return;
    const tt = (Date.now() - start) / 1000;
    events.forEach(e => { if (alertAt(e) < tt - 1) fired.current[e.id] = true; });
  }, [events]);
  useEffect(() => { markPast(timerStart); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [timerStart]);

  // Écran allumé pendant la partie
  useEffect(() => {
    let off = false;
    const req = async () => { try { if (timerStart && 'wakeLock' in navigator && document.visibilityState === 'visible') wake.current = await navigator.wakeLock.request('screen'); } catch (e) { /* refusé */ } };
    const onVis = () => { if (!off && document.visibilityState === 'visible') req(); };
    req();
    document.addEventListener('visibilitychange', onVis);
    return () => { off = true; document.removeEventListener('visibilitychange', onVis); try { wake.current && wake.current.release(); } catch (e) { /* rien */ } wake.current = null; };
  }, [timerStart]);

  useEffect(() => {
    if (!timerStart) return undefined;
    const id = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(id);
  }, [timerStart]);

  useEffect(() => {
    if (t == null) return;
    for (const e of events) {
      const at = alertAt(e);
      if (t >= at && t < at + 6 && !fired.current[e.id]) {
        fired.current[e.id] = true;
        if (e.kind !== 'lane' || e.id === 'lane390') {
          setAlert(e);
          if (prefs.sound) beep();
          if (prefs.vibrate && navigator.vibrate) navigator.vibrate([220, 100, 220]);
        }
      }
    }
  }, [t, events, prefs]);
  useEffect(() => { if (!alert) return undefined; const id = setTimeout(() => setAlert(null), 9000); return () => clearTimeout(id); }, [alert]);

  const start = useCallback((offsetSec = 0) => { unlockAudio(); const s = Date.now() - offsetSec * 1000; setTimerStart(s); setNowMs(Date.now()); }, [setTimerStart]);
  const shift = useCallback((sec) => { if (!timerStart) return; unlockAudio(); setTimerStart(timerStart - sec * 1000); setNowMs(Date.now()); }, [timerStart, setTimerStart]);
  const stop = useCallback(() => setTimerStart(null), [setTimerStart]);

  return { t, events, alert, dismiss: () => setAlert(null), start, shift, stop, prefs, setPrefs, unlockAudio };
}
