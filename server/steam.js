// Steam store helpers: fetching, HTML parsing and "Roblox fit" scoring.
// Uses only Node built-ins (Node 18+ for global fetch).

const STORE = 'https://store.steampowered.com';
const INDIE_TAG = 492;
const PAGE_SIZE = 50;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; indie-radar/1.0)',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Each list maps to a Steam store search query (all filtered to the Indie tag).
const LISTS = {
  new: { label: 'Newest releases', params: { sort_by: 'Released_DESC' } },
  trending: { label: 'Popular new releases', params: { filter: 'popularnew' }, maxAgeDays: 60 },
  upcoming: { label: 'Most-wanted upcoming', params: { filter: 'popularcomingsoon' } },
  soon: { label: 'Releasing soonest', params: { filter: 'comingsoon' } },
};

// ---------- small utils ----------

function decodeEntities(str = '') {
  return str
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function stripTags(str = '') {
  return decodeEntities(str.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

// Steam dates look like "Nov 18, 2026", "Dec 2026", "Q1 2027", "2027", "Coming soon", "To be announced".
function parseSteamDate(text) {
  if (!text) return null;
  const t = text.trim();
  const q = t.match(/^Q([1-4])\s+(\d{4})$/i);
  if (q) return Date.UTC(Number(q[2]), (Number(q[1]) - 1) * 3, 1);
  if (/^\d{4}$/.test(t)) return Date.UTC(Number(t), 0, 1);
  const ms = Date.parse(t.includes(',') || /\d{1,2}\s/.test(t) ? `${t} UTC` : `1 ${t} UTC`);
  return Number.isNaN(ms) ? null : ms;
}

// "Very Positive<br>91% of the 3,456 user reviews for this game are positive."
function parseReviewTooltip(tooltip) {
  if (!tooltip) return null;
  const text = decodeEntities(tooltip);
  const summary = text.split(/<br\s*\/?>/i)[0].trim();
  const m = text.match(/(\d+)% of the ([\d,]+) user reviews/);
  return {
    summary,
    percentPositive: m ? Number(m[1]) : null,
    count: m ? Number(m[2].replace(/,/g, '')) : 0,
  };
}

// ---------- search results parsing ----------

function parseSearchHtml(html) {
  const rows = html.split(/<a\s+href=/).slice(1).filter((r) => r.includes('search_result_row'));
  const games = [];
  for (const row of rows) {
    const appid = (row.match(/data-ds-appid="(\d+)"/) || [])[1];
    if (!appid) continue; // bundles / packages
    const url = ((row.match(/^"([^"]+)"/) || [])[1] || `${STORE}/app/${appid}`).split('?')[0];
    const tagIds = ((row.match(/data-ds-tagids="\[([^\]]*)\]"/) || [])[1] || '')
      .split(',')
      .map((s) => Number(s))
      .filter(Boolean);
    const title = decodeEntities((row.match(/class="title">([^<]*)</) || [])[1] || '').trim();
    const image = (row.match(/class="search_capsule"><img src="([^"]+)"/) || [])[1] || null;
    const releasedText = stripTags((row.match(/class="search_released[^"]*">([\s\S]*?)<\/div>/) || [])[1] || '');
    const reviewClass = (row.match(/class="search_review_summary (\w+)"/) || [])[1] || null;
    const review = parseReviewTooltip((row.match(/search_review_summary[^"]*" data-tooltip-html="([^"]*)"/) || [])[1]);
    const priceText = stripTags((row.match(/class="discount_final_price[^"]*">([\s\S]*?)<\/div>/) || [])[1] || '');
    const priceCents = Number((row.match(/data-price-final="(\d+)"/) || [])[1] || 0);
    const platforms = [...row.matchAll(/platform_img (\w+)/g)].map((m) => m[1]);

    games.push({
      appid: Number(appid),
      title,
      url,
      image,
      tagIds,
      releasedText,
      releaseDate: parseSteamDate(releasedText),
      reviews: review ? { ...review, tone: reviewClass } : null,
      price: priceText || (priceCents ? `$${(priceCents / 100).toFixed(2)}` : 'Free / TBA'),
      platforms,
    });
  }
  return games;
}

// ---------- Roblox fit scoring ----------

// Keyword (matched against lower-cased Steam tag names) -> weight, reason, and Roblox "angle".
const SIGNALS = [
  { re: /co-op|multiplayer|mmo/, w: 3, why: 'Multiplayer / co-op', angle: 'social' },
  { re: /pvp|battle royale|arena shooter|hero shooter/, w: 2, why: 'PvP', angle: 'pvp' },
  { re: /party|social deduction/, w: 3, why: 'Party / social', angle: 'party' },
  { re: /tower defense/, w: 3, why: 'Tower defense', angle: 'td' },
  { re: /horror/, w: 2, why: 'Horror', angle: 'horror' },
  { re: /survival|open world survival craft/, w: 2, why: 'Survival', angle: 'survival' },
  { re: /parkour|platformer|climbing|obstacle/, w: 2, why: 'Platforming (obby-friendly)', angle: 'obby' },
  { re: /clicker|idler|incremental/, w: 2, why: 'Idle / incremental loop', angle: 'collect' },
  { re: /farming|fishing|agricultur|collectathon|creature collector|pet/, w: 2, why: 'Collect & grow', angle: 'collect' },
  { re: /simulation|management|cooking|economy|shop|tycoon|crafting|building|base building|automation/, w: 2, why: 'Sim / tycoon loop', angle: 'tycoon' },
  { re: /funny|comedy|memes|physics|ragdoll|silly/, w: 2, why: 'Funny / physics chaos', angle: 'chaos' },
  { re: /sandbox/, w: 1, why: 'Sandbox', angle: 'tycoon' },
  { re: /driving|racing|automobile|vehicular/, w: 1, why: 'Driving', angle: 'driving' },
  { re: /anime|fighting|martial arts|beat 'em up/, w: 1, why: 'Anime / fighting', angle: 'pvp' },
  { re: /casual|cute|cartoony|colorful|cozy|stylized|family friendly|low-poly/, w: 1, why: 'Casual / kid-friendly style', angle: null },
  { re: /^3d$|first-person|third person|3d platformer/, w: 1, why: '3D (easy to port to Roblox)', angle: null },

  { re: /pixel graphics|^2d$|top-down|side scroller/, w: -1, why: '2D (needs 3D rethink)', angle: null },
  { re: /turn-based|card game|deckbuilding|jrpg/, w: -1, why: 'Slow / turn-based', angle: null },
  { re: /story rich|point & click|hidden object|walking simulator/, w: -2, why: 'Narrative-heavy', angle: null },
  { re: /visual novel|text-based|interactive fiction|dating sim|grand strategy|4x|choose your own adventure/, w: -3, why: 'Hard to translate to Roblox', angle: null },
  { re: /utilities|software|design & illustration|audio production|video production|animation & modeling|game development|photo editing|web publishing/, w: -5, why: 'Not a game', angle: null },
  { re: /sexual content|nudity|nsfw|hentai/, w: -10, why: 'Adult content (not Roblox-safe)', angle: null, adult: true },
];

const ANGLES = {
  social: 'Co-op round: 2–6 friends, shared objective, cosmetic shop + private servers',
  pvp: 'Arena PvP: short rounds, unlockable weapons/abilities, ranked leaderboard',
  party: 'Party / social deduction rounds with voice-chat-friendly roles',
  td: 'Tower defense: unit summons (rarity tiers), waves, co-op lobbies',
  horror: 'Co-op horror: scavenge in rooms/floors, monster AI, revive mechanic',
  survival: 'Survival: gather → craft → defend at night, play with friends',
  obby: 'Obby: checkpointed stages, timer leaderboards, “skip stage” product',
  collect: 'Collect & grow: plant/catch/hatch, rarity tiers, trading, limited events',
  tycoon: 'Tycoon/Simulator: earn → buy upgrades → expand plot → rebirth',
  chaos: 'Physics chaos: ragdolls, goofy minigames, shareable funny moments',
  driving: 'Driving: road-trip survival or racing with car upgrades',
};

function scoreForRoblox(tagNames) {
  let raw = 0;
  const reasons = [];
  const angleCounts = {};
  let adult = false;
  const usedWhy = new Set();
  for (const name of tagNames) {
    const lower = name.toLowerCase();
    for (const s of SIGNALS) {
      if (!s.re.test(lower)) continue;
      if (s.adult) adult = true;
      if (usedWhy.has(s.why)) break; // count each signal once
      usedWhy.add(s.why);
      if (s.angle) angleCounts[s.angle] = (angleCounts[s.angle] || 0) + s.w;
      raw += s.w;
      reasons.push({ text: s.why, positive: s.w > 0 });
      break;
    }
  }
  const score = Math.max(0, Math.min(100, Math.round(30 + raw * 6)));
  const angles = Object.entries(angleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k]) => ANGLES[k]);
  return { score, reasons, angles, adult };
}

// ---------- hype ----------

const DAY = 24 * 60 * 60 * 1000;

function hypeFor(game, list, rank, now = Date.now()) {
  if (list === 'upcoming' || list === 'soon') {
    // Steam's "popular upcoming" order is driven by wishlists/follows; rank 0 is hottest.
    const days = game.releaseDate ? Math.round((game.releaseDate - now) / DAY) : null;
    return { kind: 'rank', rank: rank + 1, daysUntilRelease: days, value: 1000 - rank };
  }
  const days = game.releaseDate ? Math.max(1, Math.round((now - game.releaseDate) / DAY)) : null;
  const count = game.reviews ? game.reviews.count : 0;
  const perDay = days ? count / days : 0;
  return { kind: 'reviews', reviewsPerDay: Math.round(perDay * 10) / 10, daysSinceRelease: days, value: perDay };
}

// ---------- network ----------

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Steam responded ${res.status} for ${url}`);
  return res.json();
}

let tagCache = { at: 0, map: null };
async function getTagMap() {
  if (tagCache.map && Date.now() - tagCache.at < DAY) return tagCache.map;
  const tags = await getJson(`${STORE}/tagdata/populartags/english`);
  tagCache = { at: Date.now(), map: new Map(tags.map((t) => [t.tagid, t.name])) };
  return tagCache.map;
}

async function searchPage(params, start) {
  const qs = new URLSearchParams({
    ...params,
    tags: String(INDIE_TAG),
    category1: '998', // games only (no DLC, demos, soundtracks)
    start: String(start),
    count: String(PAGE_SIZE),
    infinite: '1',
    cc: 'us',
    l: 'english',
  });
  const data = await getJson(`${STORE}/search/results/?${qs}`);
  return { games: parseSearchHtml(data.results_html || ''), total: data.total_count || 0 };
}

async function fetchList(listKey, pages = 2) {
  const list = LISTS[listKey];
  if (!list) throw new Error(`Unknown list "${listKey}"`);
  const [tagMap] = await Promise.all([getTagMap()]);
  const seen = new Set();
  const raw = [];
  let total = 0;
  for (let p = 0; p < pages; p++) {
    const page = await searchPage(list.params, p * PAGE_SIZE);
    total = page.total;
    for (const g of page.games) {
      if (seen.has(g.appid)) continue;
      seen.add(g.appid);
      raw.push(g);
    }
    if (page.games.length < PAGE_SIZE) break;
  }

  const now = Date.now();
  const games = raw
    .filter((g) => !list.maxAgeDays || (g.releaseDate && now - g.releaseDate <= list.maxAgeDays * DAY))
    .map((g, i) => {
      const tags = g.tagIds.map((id) => tagMap.get(id)).filter(Boolean);
      return { ...g, tags, roblox: scoreForRoblox(tags), hype: hypeFor(g, listKey, i, now) };
    });

  return { list: listKey, label: list.label, totalOnSteam: total, fetchedAt: now, games };
}

async function fetchDetails(appid) {
  const [details, reviews] = await Promise.all([
    getJson(`${STORE}/api/appdetails?appids=${appid}&cc=us&l=english`),
    getJson(`${STORE}/appreviews/${appid}?json=1&language=all&purchase_type=all&num_per_page=0`).catch(() => null),
  ]);
  const entry = details[String(appid)];
  if (!entry || !entry.success) throw new Error('Steam has no details for this app');
  const d = entry.data;
  const q = reviews && reviews.query_summary;
  return {
    appid: Number(appid),
    name: d.name,
    shortDescription: stripTags(d.short_description || ''),
    headerImage: d.header_image,
    website: d.website || null,
    developers: d.developers || [],
    publishers: d.publishers || [],
    genres: (d.genres || []).map((g) => g.description),
    categories: (d.categories || []).map((c) => c.description),
    releaseDate: d.release_date || null,
    isFree: !!d.is_free,
    price: d.price_overview ? d.price_overview.final_formatted : null,
    screenshots: (d.screenshots || []).slice(0, 6).map((s) => s.path_thumbnail),
    movie: d.movies && d.movies[0] ? d.movies[0].mp4?.max || d.movies[0].mp4?.['480'] || null : null,
    reviewSummary: q
      ? { desc: q.review_score_desc, positive: q.total_positive, total: q.total_reviews }
      : null,
  };
}

module.exports = {
  LISTS,
  parseSearchHtml,
  parseSteamDate,
  parseReviewTooltip,
  scoreForRoblox,
  hypeFor,
  fetchList,
  fetchDetails,
  decodeEntities,
};
