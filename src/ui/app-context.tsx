import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { RehabData } from '../db/hooks';
import { useRehab } from '../db/hooks';
import { todayStr } from '../domain/dates';

export interface ToastMsg {
  id: number;
  text: string;
  undo?: () => void | Promise<void>;
}

interface Ctx extends RehabData {
  dark: boolean;
  today: string;
  toast: (text: string, undo?: ToastMsg['undo']) => void;
  toastMsg: ToastMsg | null;
  dismissToast: () => void;
}
const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside provider');
  return c;
};

function useDark(theme: string) {
  const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const [sys, setSys] = useState(!!mq?.matches);
  useEffect(() => {
    if (!mq) return;
    const f = () => setSys(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [mq]);
  return theme === 'dark' || (theme === 'system' && sys);
}

/** The calendar day, refreshed when the app returns to the foreground or passes midnight. */
function useToday() {
  const [t, setT] = useState(todayStr());
  useEffect(() => {
    const check = () => setT((prev) => (prev === todayStr() ? prev : todayStr()));
    const id = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return t;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const data = useRehab();
  const dark = useDark(data.settings.theme);
  const today = useToday();
  const [toastMsg, setToast] = useState<ToastMsg | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const toast = useCallback((text: string, undo?: ToastMsg['undo']) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), text, undo });
    timer.current = window.setTimeout(() => setToast(null), undo ? 6000 : 2500);
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    const root = document.documentElement;
    if (data.settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', data.settings.theme);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#0e191e' : '#f1f5f6'));
  }, [data.settings.theme, dark]);

  const value = useMemo(() => ({ ...data, dark, today, toast, toastMsg, dismissToast }), [data, dark, today, toast, toastMsg, dismissToast]);
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
