const test = require('node:test');
const assert = require('node:assert');
const { parseSearchHtml, parseSteamDate, parseReviewTooltip, scoreForRoblox, hypeFor } = require('./steam');

// Trimmed copy of a real row from store.steampowered.com/search/results (Nov 2026).
const ROW = `
<a href="https://store.steampowered.com/app/3250210/taCam/?snr=1_7_7_240_150_2"
   data-ds-appid="3250210" data-ds-itemkey="App_3250210" data-ds-tagids="[19,599,1774,1663]" class="search_result_row ds_collapse_flag "
   data-search-page="1">
  <div class="search_capsule"><img src="https://example.com/capsule_231x87.jpg?t=1" ></div>
  <div class="responsive_search_name_combined">
    <div class="search_name ellipsis"><span class="title">taCam &amp; Friends</span></div>
    <div class="search_platforms"><span class="platform_img win"></span></div>
    <div class="search_released responsive_secondrow">
        Nov 18, 2026                </div>
    <div class="search_reviewscore responsive_secondrow">
      <span class="search_review_summary mixed" data-tooltip-html="Mixed&lt;br&gt;56% of the 1,016 user reviews for this game are positive."></span>
    </div>
    <div class="search_price_discount_combined responsive_secondrow" data-price-final="539">
      <div class="discount_block search_discount_block" data-price-final="539"><div class="discount_prices"><div class="discount_original_price">$8.99</div><div class="discount_final_price">$5.39</div></div></div>
    </div>
  </div>
</a>
<a href="https://store.steampowered.com/sub/123/" data-ds-packageid="123" class="search_result_row"><span class="title">A bundle</span></a>`;

test('parses a Steam search result row', () => {
  const [g, ...rest] = parseSearchHtml(ROW);
  assert.strictEqual(rest.length, 0, 'packages/bundles are skipped');
  assert.strictEqual(g.appid, 3250210);
  assert.strictEqual(g.title, 'taCam & Friends');
  assert.strictEqual(g.url, 'https://store.steampowered.com/app/3250210/taCam/');
  assert.deepStrictEqual(g.tagIds, [19, 599, 1774, 1663]);
  assert.strictEqual(g.releasedText, 'Nov 18, 2026');
  assert.strictEqual(g.releaseDate, Date.UTC(2026, 10, 18));
  assert.deepStrictEqual(g.reviews, { summary: 'Mixed', percentPositive: 56, count: 1016, tone: 'mixed' });
  assert.strictEqual(g.price, '$5.39');
  assert.deepStrictEqual(g.platforms, ['win']);
});

test('parses the date formats Steam uses', () => {
  assert.strictEqual(parseSteamDate('Dec 4, 2026'), Date.UTC(2026, 11, 4));
  assert.strictEqual(parseSteamDate('Dec 2026'), Date.UTC(2026, 11, 1));
  assert.strictEqual(parseSteamDate('Q2 2027'), Date.UTC(2027, 3, 1));
  assert.strictEqual(parseSteamDate('2027'), Date.UTC(2027, 0, 1));
  assert.strictEqual(parseSteamDate('Coming soon'), null);
  assert.strictEqual(parseSteamDate('To be announced'), null);
});

test('review tooltip without numbers', () => {
  assert.deepStrictEqual(parseReviewTooltip('1 user review'), { summary: '1 user review', percentPositive: null, count: 0 });
});

test('co-op horror scores higher than a visual novel', () => {
  const horror = scoreForRoblox(['Horror', 'Online Co-Op', 'First-Person', 'Funny']);
  const vn = scoreForRoblox(['Visual Novel', 'Story Rich', 'Anime', '2D']);
  assert.ok(horror.score > 75, `horror ${horror.score}`);
  assert.ok(vn.score < 40, `vn ${vn.score}`);
  assert.ok(horror.angles.length > 0);
});

test('adult content is flagged and sinks the score', () => {
  const r = scoreForRoblox(['Sexual Content', 'Casual']);
  assert.strictEqual(r.adult, true);
  assert.strictEqual(r.score, 0);
});

test('a signal is only counted once even if several tags match it', () => {
  const once = scoreForRoblox(['Incremental']);
  const twice = scoreForRoblox(['Incremental', 'Idler', 'Clicker']);
  assert.strictEqual(once.score, twice.score);
});

test('hype: reviews per day for releases, rank for upcoming', () => {
  const now = Date.UTC(2026, 10, 18);
  const released = { releaseDate: Date.UTC(2026, 10, 8), reviews: { count: 500 } };
  assert.strictEqual(hypeFor(released, 'new', 0, now).reviewsPerDay, 50);
  const upcoming = { releaseDate: Date.UTC(2026, 10, 25) };
  const h = hypeFor(upcoming, 'upcoming', 2, now);
  assert.strictEqual(h.rank, 3);
  assert.strictEqual(h.daysUntilRelease, 7);
});
