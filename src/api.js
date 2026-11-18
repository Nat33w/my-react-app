// Talks to the local API server (server/index.js). In development, CRA's
// "proxy" setting in package.json forwards /api requests to it.

async function request(path) {
  let res;
  try {
    res = await fetch(path);
  } catch {
    throw new Error('Could not reach the API server. Is it running? Try "npm run dev".');
  }
  const type = res.headers.get('content-type') || '';
  if (!type.includes('application/json')) {
    throw new Error('The API server is not running. Start everything with "npm run dev".');
  }
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export function getGames(list, pages, refresh = false) {
  const qs = new URLSearchParams({ list, pages: String(pages) });
  if (refresh) qs.set('refresh', '1');
  return request(`/api/games?${qs}`);
}

export function getDetails(appid) {
  return request(`/api/details/${appid}`);
}
