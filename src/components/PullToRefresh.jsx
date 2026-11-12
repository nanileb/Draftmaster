import React, { useRef, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

const THRESHOLD = 70; // px to drag before triggering

export default function PullToRefresh({ onRefresh, children, className = '' }) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const containerRef = useRef(null);

  const handleTouchStart = useCallback((e) => {
    const el = containerRef.current;
    if (el && el.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (startY.current === null || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      setPullY(Math.min(delta * 0.5, THRESHOLD + 20));
    }
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (pullY >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullY(0);
      startY.current = null;
      try { await onRefresh(); } finally { setRefreshing(false); }
    } else {
      setPullY(0);
      startY.current = null;
    }
  }, [pullY, refreshing, onRefresh]);

  const indicatorHeight = refreshing ? THRESHOLD : pullY;
  const progress = Math.min(pullY / THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      className={`flex-1 overflow-y-auto overscroll-none ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        style={{ height: indicatorHeight, transition: refreshing ? 'none' : 'height 0.2s ease' }}
        className="flex items-center justify-center overflow-hidden"
      >
        {(pullY > 10 || refreshing) && (
          <div
            className="flex items-center gap-2"
            style={{ opacity: refreshing ? 1 : progress, transform: `scale(${0.5 + progress * 0.5})` }}
          >
            <Loader2
              className="w-5 h-5 text-primary"
              style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none', transform: `rotate(${progress * 360}deg)` }}
            />
            <span className="text-xs text-muted-foreground">
              {refreshing ? 'Actualisation…' : progress >= 1 ? 'Relâcher' : 'Tirer pour actualiser'}
            </span>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}