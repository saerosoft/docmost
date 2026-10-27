import { createContext, useContext, useMemo } from 'react';

export function createNoteDateTimeFormatter(timeZone?: string) {
  const formatter = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone });
  const label = formatter.resolvedOptions().timeZone;
  return (value: string) => {
    const instant = new Date(value);
    return Number.isNaN(instant.getTime()) ? '시각 미상' : formatter.format(instant) + ' (' + label + ')';
  };
}

export const NoteDateTimeContext = createContext<ReturnType<typeof createNoteDateTimeFormatter> | null>(null);

export function useNoteDateTime() {
  const inherited = useContext(NoteDateTimeContext);
  return useMemo(() => inherited ?? createNoteDateTimeFormatter(), [inherited]);
}
