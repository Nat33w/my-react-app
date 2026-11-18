export function fitClass(score) {
  if (score >= 75) return 'fit-high';
  if (score >= 50) return 'fit-mid';
  return 'fit-low';
}

export function hypeLabel(game) {
  const h = game.hype;
  if (!h) return null;
  if (h.kind === 'rank') {
    const when =
      h.daysUntilRelease == null
        ? ''
        : h.daysUntilRelease <= 0
          ? ' · out today'
          : ` · in ${h.daysUntilRelease}d`;
    return `#${h.rank} on Steam's list${when}`;
  }
  if (h.daysSinceRelease == null) return null;
  const age = `${h.daysSinceRelease}d old`;
  return h.reviewsPerDay > 0 ? `${h.reviewsPerDay} reviews/day · ${age}` : age;
}

export default function GameCard({ game, isSaved, onToggleSave, onOpen }) {
  const { roblox, reviews } = game;
  const hype = hypeLabel(game);

  return (
    <article className="card">
      <button className="card-image" onClick={() => onOpen(game)} aria-label={`Open details for ${game.title}`}>
        {game.image ? <img src={game.image} alt="" loading="lazy" /> : <div className="img-placeholder" />}
        <span className={`fit-badge ${fitClass(roblox.score)}`} title="Roblox fit score">
          {roblox.score}
        </span>
      </button>

      <div className="card-body">
        <h3 className="card-title" title={game.title}>{game.title}</h3>
        <div className="card-meta">
          <span>{game.releasedText || 'TBA'}</span>
          <span>·</span>
          <span>{game.price}</span>
        </div>
        {hype && <div className="hype">🔥 {hype}</div>}
        {reviews && reviews.count > 0 && (
          <div className={`reviews tone-${reviews.tone}`}>
            {reviews.summary} · {reviews.percentPositive}% of {reviews.count.toLocaleString()}
          </div>
        )}

        <div className="chips">
          {roblox.reasons.slice(0, 4).map((r) => (
            <span key={r.text} className={`chip ${r.positive ? 'chip-good' : 'chip-bad'}`}>
              {r.positive ? '+' : '−'} {r.text}
            </span>
          ))}
        </div>

        {roblox.angles[0] && <p className="angle">💡 {roblox.angles[0]}</p>}

        <div className="tags">{game.tags.join(' · ')}</div>
      </div>

      <div className="card-actions">
        <button onClick={() => onOpen(game)}>Details</button>
        <button className={isSaved ? 'saved' : ''} onClick={() => onToggleSave(game)}>
          {isSaved ? '★ Saved' : '☆ Save'}
        </button>
        <a href={game.url} target="_blank" rel="noopener noreferrer">
          Steam ↗
        </a>
      </div>
    </article>
  );
}
