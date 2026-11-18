import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

const game = {
  appid: 1,
  title: 'Test Co-op Horror',
  url: 'https://store.steampowered.com/app/1/',
  image: null,
  tags: ['Horror', 'Online Co-Op'],
  releasedText: 'Dec 4, 2026',
  releaseDate: Date.UTC(2026, 11, 4),
  reviews: null,
  price: 'Free / TBA',
  roblox: { score: 82, reasons: [{ text: 'Horror', positive: true }], angles: ['Co-op horror idea'], adult: false },
  hype: { kind: 'rank', rank: 1, daysUntilRelease: 16, value: 999 },
};

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ list: 'upcoming', label: 'x', totalOnSteam: 1, fetchedAt: Date.now(), games: [game] }),
    })
  );
});

test('loads and shows upcoming games with their Roblox fit', async () => {
  render(<App />);
  expect(screen.getByText(/Indie Radar/)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('Test Co-op Horror')).toBeInTheDocument());
  expect(screen.getByText('82')).toBeInTheDocument();
  expect(screen.getByText(/Co-op horror idea/)).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/games?list=upcoming'));
});
