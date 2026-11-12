import React, { createContext, useContext } from 'react';
import { useDraftState } from '@/hooks/useDraftState';

const DraftContext = createContext(null);

export function DraftProvider({ champions, children }) {
  const draft = useDraftState(champions);
  return <DraftContext.Provider value={draft}>{children}</DraftContext.Provider>;
}

export function useDraft() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useDraft must be used within a DraftProvider');
  return ctx;
}