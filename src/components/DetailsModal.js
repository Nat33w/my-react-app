import { useEffect, useState } from 'react';
import { getDetails } from '../api';
import { fitClass, hypeLabel } from './GameCard';

export default function DetailsModal({ game, isSaved, note, onToggleSave, onNote, onClose }) {
  const [details, setDetails] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setDetails(null);
    setError(null);
    getDetails(game.appid)
      .then((d) => alive && setDetails(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [game.appid]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hype = hypeLabel(game);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={game.title} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <img className="modal-hero" src={details?.headerImage || game.image} alt="" />

        <div className="modal-content">
          <div className="modal-head">
            <h2>{game.title}</h2>
            <span className={`fit-badge static ${fitClass(game.roblox.score)}`}>Roblox fit {game.roblox.score}</span>
          </div>
          <div className="card-meta">
            <span>{details?.releaseDate?.date || game.releasedText || 'TBA'}</span>
            {details?.developers?.length > 0 && <span>· by {details.developers.join(', ')}</span>}
            {hype && <span>· 🔥 {hype}</span>}
          </div>

          {error && <p className="error">Couldn't load Steam details: {error}</p>}
          {!details && !error && <p className="muted">Loading Steam details…</p>}
          {details && (
            <>
              <p className="description">{details.shortDescription}</p>
              {details.reviewSummary && details.reviewSummary.total > 0 && (
                <p className="muted">
                  Reviews: {details.reviewSummary.desc} ({details.reviewSummary.positive.toLocaleString()} of{' '}
                  {details.reviewSummary.total.toLocaleString()} positive)
                </p>
              )}
              {details.categories.length > 0 && (
                <div className="tags">Features: {details.categories.join(' · ')}</div>
              )}
              {details.screenshots.length > 0 && (
                <div className="shots">
                  {details.screenshots.map((src) => (
                    <img key={src} src={src} alt="" loading="lazy" />
                  ))}
                </div>
              )}
            </>
          )}

          <h3>Why it could work on Roblox</h3>
          <div className="chips">
            {game.roblox.reasons.length === 0 && <span className="muted">No strong signals in its Steam tags.</span>}
            {game.roblox.reasons.map((r) => (
              <span key={r.text} className={`chip ${r.positive ? 'chip-good' : 'chip-bad'}`}>
                {r.positive ? '+' : '−'} {r.text}
              </span>
            ))}
          </div>
          {game.roblox.angles.length > 0 && (
            <ul className="angles">
              {game.roblox.angles.map((a) => (
                <li key={a}>💡 {a}</li>
              ))}
            </ul>
          )}
          <div className="tags">Steam tags: {game.tags.join(' · ') || '—'}</div>

          {isSaved && (
            <label className="note">
              Your notes
              <textarea
                value={note || ''}
                onChange={(e) => onNote(game.appid, e.target.value)}
                placeholder="Your own twist, name ideas, core loop, monetization…"
                rows={4}
              />
            </label>
          )}

          <div className="card-actions">
            <button className={isSaved ? 'saved' : ''} onClick={() => onToggleSave(game)}>
              {isSaved ? '★ Saved' : '☆ Save idea'}
            </button>
            <a href={game.url} target="_blank" rel="noopener noreferrer">
              Open on Steam ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
