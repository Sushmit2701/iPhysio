import { useCallback } from 'react';
import { restoreDay, updateDay } from '../db/repo';
import type { DayLog } from '../domain/types';
import { useApp } from './app-context';

/** Edit a day and offer Undo in a toast. */
export function useDayEdit() {
  const { toast } = useApp();
  return useCallback(
    async (date: string, fn: (d: DayLog) => void, message?: string) => {
      const prev = await updateDay(date, fn);
      if (message) toast(message, () => restoreDay(date, prev));
      return prev;
    },
    [toast],
  );
}
