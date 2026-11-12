import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Play, Square, Volume2, VolumeX, Vibrate } from 'lucide-react';
import { meta } from '@/lib/gameData';
import { SPOTS, STRUCTS, fmt, patchRules } from '@/lib/inGame';

const MAP = (import.meta.env.BASE_URL || '/') + 'data/map-sr.jpg';
const KIND_FR = { ward: 'Ward', obj: 'Objectif', danger: 'Danger', lane: 'Lane' };
const KIND_DOT = { ward: 'border-accent', obj: 'border-gold', danger: 'border-red-lose', lane: 'border-blue-info' };

function MiniMap({ keys, side }) {
  const pts = keys.map(k => SPOTS[k]).filter(Boolean), me = side === 'red' ? [88, 12] : [12, 88];
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label="Carte de la Faille avec les emplacements de ward" className="w-full h-auto rounded-lg border border-gold/40 bg-[#010a13] block">
      <image href={MAP} x="0" y="0" width="100" height="100" />
      {STRUCTS.map((x, i) => {
        const c = x[0] === 'b' ? '#3a8fe0' : '#e0463a';
        return x[1] === 't'
          ? <rect key={i} x={x[2] - 1.4} y={x[3] - 1.4} width="2.8" height="2.8" rx=".4" fill={c} stroke="#010a13" strokeWidth=".5" />
          : <circle key={i} cx={x[2]} cy={x[3]} r="1.5" fill="none" stroke={c} strokeWidth=".8" />;
      })}
      <text x="66.2" y="77" fontSize="3" fill="#f0e6d2" textAnchor="middle" fontFamily="sans-serif" fontWeight="700">DRAKE</text>
      <text x="42" y="30.5" fontSize="3" fill="#f0e6d2" textAnchor="middle" fontFamily="sans-serif" fontWeight="700">BARON</text>
      <circle cx={me[0]} cy={me[1]} r="8" fill="none" stroke="#c8aa6e" strokeWidth="1" strokeDasharray="2 1.5" />
      <text x={me[0]} y={me[1] + (me[1] > 50 ? -10 : 14)} fontSize="4.5" fill="#f0e6d2" textAnchor="middle" fontFamily="sans-serif" fontWeight="700">TOI</text>
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r="6" fill="#ffd34d" opacity=".25"><animate attributeName="r" values="3;5.5;3" dur="1.6s" repeatCount="indefinite" /></circle>
          <circle cx={p[0]} cy={p[1]} r="2.3" fill="#ffd34d" stroke="#010a13" strokeWidth=".6" />
          <text x={p[0]} y={p[1] + 1.1} fontSize="3.1" fontWeight="800" fill="#010a13" textAnchor="middle" fontFamily="sans-serif">{i + 1}</text>
        </g>
      ))}
    </svg>
  );
}

const Btn = ({ className, ...p }) => (
  <button type="button" {...p} className={cn('min-h-[44px] px-3 rounded-xl border border-border bg-secondary text-sm font-semibold active:scale-[0.97] transition-all disabled:opacity-50', className)} />
);

export default function TimingPanel({ clock, match, side, setSide, kills, setKills, role }) {
  const [showPast, setShowPast] = useState(false);
  const { t, events: ev } = clock;
  const nextIdx = t == null ? -1 : ev.findIndex(e => e.t >= t - 5);
  const next = t == null ? null : ev.find(e => e.t >= t);
  const nextWard = ev.find(e => e.kind === 'ward' && e.spots && e.spots.length && (t == null || e.t >= t - 20));
  const isPast = (e, i) => t != null && e.t < t - 5 && i !== nextIdx;
  const pastCount = t == null ? 0 : ev.filter(isPast).length;
  const T = meta().timers || {};

  const drake = () => {
    if (t == null) return toast('Lance d\'abord le chrono');
    setKills(k => ({ ...k, drakes: [...(k.drakes || []), Math.round(t)] }));
    toast('Prochain drake à ' + fmt(t + (T.dragonRespawn || 300)));
  };
  const soul = () => {
    if (t == null) return toast('Lance d\'abord le chrono');
    setKills(k => ({ ...k, soul: Math.round(t) }));
    toast('Ancien à ' + fmt(t + (T.elderAfterSoul || 360)));
  };

  return (
    <div className="space-y-3">
      {/* Chrono (collé en haut pendant le défilement) */}
      <div className="sticky z-[5] bg-card/95 backdrop-blur-lg border border-border shadow-lg rounded-xl p-3 space-y-2.5" style={{ top: 'calc(max(0.75rem, env(safe-area-inset-top, 0px)) + 53px)' }}>
        <div className="flex items-center gap-3">
          <span className="font-grotesk font-bold text-4xl tabular-nums min-w-[5.5rem]">{t == null ? '0:00' : fmt(t)}</span>
          <p className="text-xs text-muted-foreground min-w-0 flex-1">
            {t == null ? 'Lance le chrono au début de la partie (ou charge ta partie en cours pour le caler tout seul).'
              : next ? <>Dans <b className="text-foreground tabular-nums">{fmt(next.t - t)}</b> · {next.title}</> : 'Fin de la chronologie.'}
          </p>
        </div>
        <div className="flex gap-2">
          {t == null
            ? <Btn className="flex-1 bg-primary text-primary-foreground border-primary flex items-center justify-center gap-1.5" onClick={() => { setKills({ drakes: [], soul: null }); clock.start(0); toast('Chrono lancé, garde l\'app ouverte'); }}><Play className="w-4 h-4" />Démarrer</Btn>
            : <>
              <Btn className="flex-1" onClick={() => clock.shift(-10)}>−10 s</Btn>
              <Btn className="flex-1" onClick={() => clock.shift(10)}>+10 s</Btn>
              <Btn className="flex items-center gap-1.5" onClick={clock.stop}><Square className="w-3.5 h-3.5" />Stop</Btn>
            </>}
        </div>
      </div>

      <div className="glass rounded-xl p-3 space-y-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Ton côté</span>
          <div className="inline-flex bg-secondary rounded-lg p-0.5 border border-border" role="group" aria-label="Côté de la carte">
            {['blue', 'red'].map(s => (
              <button key={s} type="button" aria-pressed={side === s} onClick={() => setSide(s)}
                className={cn('px-3 min-h-[36px] rounded-md text-xs font-semibold', side === s ? (s === 'blue' ? 'bg-blue-info/20 text-blue-info' : 'bg-red-lose/20 text-red-lose') : 'text-muted-foreground')}>
                {s === 'blue' ? 'Bleu' : 'Rouge'}
              </button>
            ))}
          </div>
          <div className="ml-auto flex gap-1">
            <button type="button" aria-label={clock.prefs.sound ? 'Couper le son' : 'Activer le son'} onClick={() => { clock.unlockAudio(); clock.setPrefs({ sound: !clock.prefs.sound }); }}
              className={cn('w-9 h-9 rounded-lg grid place-items-center border border-border', clock.prefs.sound ? 'text-primary' : 'text-muted-foreground')}>
              {clock.prefs.sound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button type="button" aria-label="Vibration" aria-pressed={clock.prefs.vibrate} onClick={() => clock.setPrefs({ vibrate: !clock.prefs.vibrate })}
              className={cn('w-9 h-9 rounded-lg grid place-items-center border border-border', clock.prefs.vibrate ? 'text-primary' : 'text-muted-foreground')}>
              <Vibrate className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <Btn className="flex-1" onClick={drake}>Drake tué</Btn>
          <Btn className="flex-1" onClick={soul}>Âme prise</Btn>
        </div>
        <div className="flex gap-3 flex-wrap text-[11px] text-muted-foreground">
          {Object.entries(KIND_FR).map(([k, v]) => <span key={k} className="flex items-center gap-1"><i className={cn('inline-block w-2.5 h-2.5 rounded-full border-2', KIND_DOT[k])} />{v}</span>)}
        </div>
      </div>

      {nextWard && (
        <div className="glass rounded-xl p-3 space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-accent font-semibold">{t == null ? 'Première ward' : 'Prochaine ward'} · {fmt(nextWard.t)}</h3>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 items-start">
            <MiniMap keys={nextWard.spots} side={side} />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold leading-tight">{nextWard.title}</p>
              <p className="text-xs text-muted-foreground">{nextWard.text}</p>
              <ol className="list-decimal pl-4 text-xs space-y-0.5">{nextWard.spots.map(k => <li key={k}>{SPOTS[k][2]}</li>)}</ol>
              <p className="text-[11px] text-muted-foreground">Côté {side === 'blue' ? 'bleu (base en bas à gauche)' : 'rouge (base en haut à droite)'}.</p>
            </div>
          </div>
        </div>
      )}

      {pastCount > 0 && (
        <button type="button" onClick={() => setShowPast(v => !v)} className="text-xs text-muted-foreground underline underline-offset-2 min-h-[36px]">
          {showPast ? 'Masquer' : 'Voir'} les {pastCount} événements passés
        </button>
      )}

      <div>
        {ev.map((e, i) => ({ e, i })).filter(({ e, i }) => showPast || !isPast(e, i)).map(({ e, i }, k, arr) => (
          <div key={e.id + i} className={cn('grid grid-cols-[3.25rem_1.25rem_minmax(0,1fr)] gap-2', isPast(e, i) && 'opacity-45')}>
            <span className={cn('font-grotesk font-bold text-base text-right tabular-nums pt-1.5', i === nextIdx ? 'text-primary' : 'text-muted-foreground')}>{fmt(e.t)}</span>
            <div className="relative flex justify-center">
              {k < arr.length - 1 && <span className="absolute top-2 bottom-0 w-0.5 bg-border" />}
              <i className={cn('relative mt-2 w-3.5 h-3.5 rounded-full bg-background border-[3px]', KIND_DOT[e.kind])} />
            </div>
            <div className={cn('glass rounded-xl px-3 py-2 mb-3 min-w-0', i === nextIdx && 'ring-2 ring-primary', e.kind === 'danger' && 'border-l-[3px] border-l-red-lose')}>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{KIND_FR[e.kind]}</span>
              <p className="text-sm font-semibold leading-tight">{e.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{e.text}</p>
            </div>
          </div>
        ))}
      </div>

      {patchRules(role).length > 0 && (
        <div className="glass rounded-xl p-3 space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-gold font-semibold">Règles du patch{role === 'SUPPORT' ? ' pour le support' : ''}</h3>
          <ul className="space-y-1.5 text-sm">
            {patchRules(role).map((r, i) => <li key={i}><b>{r.title}.</b> <span className="text-muted-foreground">{r.text}</span></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
