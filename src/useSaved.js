import { useCallback, useEffect, useState } from 'react';

const KEY = 'indieRadar.saved';

function load() {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Saved games live in this browser's localStorage, keyed by Steam appid.
export default function useSaved() {
  const [saved, setSaved] = useState(load);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(saved));
    } catch {
      // storage full or blocked; keep working in memory
    }
  }, [saved]);

  const toggle = useCallback((game) => {
    setSaved((prev) => {
      const next = { ...prev };
      if (next[game.appid]) delete next[game.appid];
      else next[game.appid] = { ...game, note: '', savedAt: Date.now() };
      return next;
    });
  }, []);

  const setNote = useCallback((appid, note) => {
    setSaved((prev) => (prev[appid] ? { ...prev, [appid]: { ...prev[appid], note } } : prev));
  }, []);

  return { saved, toggle, setNote };
}
