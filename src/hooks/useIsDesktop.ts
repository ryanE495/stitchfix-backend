import { useEffect, useState } from 'react';

export function useIsDesktop(query = '(min-width: 768px)'): boolean {
  const [match, setMatch] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatch(e.matches);
    mq.addEventListener('change', onChange);
    setMatch(mq.matches);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return match;
}
