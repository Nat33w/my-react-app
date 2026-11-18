import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import { getGames } from './api';
import GameCard from './components/GameCard';
import DetailsModal from './components/DetailsModal';
import useSaved from './useSaved';

const TABS = [
  { key: 'upcoming', label: 'Most-wanted upcoming', hint: "Steam's popular upcoming indie games (ranked by wishlists/follows)." },
  { key: 'trending', label: 'Hot new releases', hint: 'Popular indie games released in the last 60 days.' },
  { key: 'new', label: 'Newest releases', hint: 'Every indie game, newest first. Lots of noise, but you see things first.' },
  { key: 'soon', label: 'Releasing soonest', hint: 'Indie games about to launch, soonest first.' },
  { key: 'saved', label: '★ Saved', hint: 'Games you saved, with your notes. Stored in this browser.' },
];

const SORTS = {
  fit: { label: 'Roblox fit', fn: (a, b) => b.roblox.score - a.roblox.score },
  hype: { label: 'Hype', fn: (a, b) => (b.hype?.value || 0) - (a.hype?.value || 0) },
  date: { label: 'Release date', fn: (a, b) => (b.releaseDate || 0) - (a.releaseDate || 0) },
  smart: {
    label: 'Fit × hype',
    fn: (a, b) => b.roblox.score * Math.log10(10 + (b.hype?.value || 0)) - a.roblox.score * Math.log10(10 + (a.hype?.value || 0)),
  },
};

export default function App() {
  const [tab, setTab] = useState('upcoming');
  const [pages, setPages] = useState(2);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [minFit, setMinFit] = useState(50);
  const [sort, setSort] = useState('smart');
  const [hideAdult, setHideAdult] = useState(true);
  const [open, setOpen] = useState(null);
  const { saved, toggle, setNote } = useSaved();
  const closeModal = useCallback(() => setOpen(null), []);

  const load = useCallback(
    async (refresh = false) => {
      if (tab === 'saved') return;
      setLoading(true);
      setError(null);
      try {
        const result = await getGames(tab, pages, refresh);
        setData((prev) => ({ ...prev, [`${tab}:${pages}`]: result }));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [tab, pages]
  );

  const current = data[`${tab}:${pages}`];
  useEffect(() => {
    if (tab !== 'saved' && !current) load();
  }, [tab, current, load]);

  const games = useMemo(() => {
    const source = tab === 'saved' ? Object.values(saved) : current?.games || [];
    const q = query.trim().toLowerCase();
    return source
      .filter((g) => (tab === 'saved' ? true : g.roblox.score >= minFit))
      .filter((g) => !hideAdult || !g.roblox.adult)
      .filter((g) => !q || g.title.toLowerCase().includes(q) || g.tags.some((t) => t.toLowerCase().includes(q)))
      .sort(SORTS[sort].fn);
  }, [tab, saved, current, query, minFit, hideAdult, sort]);

  const tabInfo = TABS.find((t) => t.key === tab);
  const savedCount = Object.keys(saved).length;

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>
            Indie Radar <span className="logo-dot">●</span>
          </h1>
          <p className="subtitle">Find fresh Steam indie games and spot the ones that would work on Roblox.</p>
        </div>
      </header>

      <nav className="tabs" aria-label="Lists">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.key === 'saved' ? `★ Saved (${savedCount})` : t.label}
          </button>
        ))}
      </nav>
      <p className="hint">{tabInfo.hint}</p>

      <section className="toolbar">
        <input
          type="search"
          placeholder="Search title or tag (e.g. horror, co-op, tycoon)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {tab !== 'saved' && (
          <label>
            Min fit <strong>{minFit}</strong>
            <input type="range" min="0" max="100" step="5" value={minFit} onChange={(e) => setMinFit(Number(e.target.value))} />
          </label>
        )}
        <label>
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {Object.entries(SORTS).map(([k, s]) => (
              <option key={k} value={k}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {tab !== 'saved' && (
          <label>
            Scan
            <select value={pages} onChange={(e) => setPages(Number(e.target.value))}>
              <option value={1}>50 games</option>
              <option value={2}>100 games</option>
              <option value={4}>200 games</option>
              <option value={6}>300 games</option>
            </select>
          </label>
        )}
        <label className="check">
          <input type="checkbox" checked={hideAdult} onChange={(e) => setHideAdult(e.target.checked)} />
          Hide adult
        </label>
        {tab !== 'saved' && (
          <button className="refresh" onClick={() => load(true)} disabled={loading}>
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
        )}
      </section>

      {error && <div className="error banner">{error}</div>}
      {tab !== 'saved' && current && !loading && (
        <p className="muted count">
          Showing {games.length} of {current.games.length} scanned · updated {new Date(current.fetchedAt).toLocaleTimeString()}
        </p>
      )}
      {loading && !current && <p className="muted count">Scanning Steam…</p>}
      {tab === 'saved' && savedCount === 0 && <p className="muted count">Nothing saved yet. Hit ☆ Save on games you like.</p>}

      <main className="grid">
        {games.map((g) => (
          <GameCard key={g.appid} game={g} isSaved={!!saved[g.appid]} onToggleSave={toggle} onOpen={setOpen} />
        ))}
      </main>

      <footer className="footer">
        Use these for <strong>genre and mechanic inspiration</strong>, not copies: Roblox removes games that reuse another
        game's name, characters, art or music after a DMCA report. Fit scores are a rough guide based on Steam tags.
      </footer>

      {open && (
        <DetailsModal
          game={open}
          isSaved={!!saved[open.appid]}
          note={saved[open.appid]?.note}
          onToggleSave={toggle}
          onNote={setNote}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
