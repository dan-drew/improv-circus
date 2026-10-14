import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { load } from 'js-yaml';
import { buildGames, gameSlug, readDefinitions, videoEmbed } from '../src/_models/game.js';
import { matchesGame, initGames } from '../src/scripts/games.js';

const tags = [{ slug: 'musical', name: 'Musical', icon: '🎵' }, { slug: 'replay', name: 'Replay', icon: '🔁' }];
const catalog = [
  { names: ['Zulu', 'Alpha'], tags: ['musical'], slug: 'zulu' },
  { names: ['Beta'], tags: ['replay'], slug: 'beta' },
];

test('aliases sort individually, share links, and use full names for related games', () => {
  const games = buildGames(catalog, tags, { zulu: { relatedGames: ['beta'] } });
  assert.deepEqual(games.entries.map(entry => entry.name), ['Alpha', 'Beta', 'Zulu']);
  assert.equal(games.entries[0].game, games.entries[2].game);
  assert.equal(games.bySlug.zulu.pageLink, '/games/zulu/');
  assert.equal(games.bySlug.beta.pageLink, null);
  assert.equal(games.bySlug.zulu.fullName, 'Zulu/Alpha');
  assert.equal(games.bySlug.zulu.relatedGames[0].fullName, 'Beta');
});

test('slugs derive from first names and normalize punctuation and accents', () => {
  assert.equal(gameSlug('Replay at Bernie’s!'), 'replay-at-bernies');
  assert.equal(gameSlug('Naïve Expert'), 'naive-expert');
  assert.equal(buildGames([{ names: ['Naïve Expert'], tags: [] }], tags).entries[0].game.slug, 'naive-expert');
});

test('invalid references, tags, slugs, and duplicate names fail instead of generating broken pages', () => {
  assert.throws(() => buildGames(catalog, tags, { missing: {} }), /Orphan/);
  assert.throws(() => buildGames(catalog, tags, { zulu: { relatedGames: ['missing'] } }), /Unknown related/);
  assert.throws(() => buildGames([{ names: ['Name'], tags: ['unknown'] }], tags), /Unknown tags/);
  assert.throws(() => buildGames([catalog[0], catalog[0]], tags), /duplicate game slug/);
  assert.throws(() => buildGames([...catalog, { names: ['ALPHA'], tags: [] }], tags), /Duplicate game name/);
});

test('YouTube URL forms and zero-based clip times', () => {
  const video = { title: 'Example', youtube: 'https://youtu.be/4jkBsKzLNMs', start: 0, end: 30 };
  assert.equal(videoEmbed(video), 'https://www.youtube-nocookie.com/embed/4jkBsKzLNMs?start=0&end=30');
  for (const youtube of ['https://www.youtube.com/watch?v=4jkBsKzLNMs', 'https://www.youtube.com/shorts/4jkBsKzLNMs', 'https://www.youtube.com/embed/4jkBsKzLNMs']) {
    assert.equal(videoEmbed({ title: 'Example', youtube }), 'https://www.youtube-nocookie.com/embed/4jkBsKzLNMs');
  }
  for (const change of [{ start: -1 }, { start: 0.5 }, { end: 0 }, { start: 30 }, { youtube: 'https://example.com/watch?v=4jkBsKzLNMs' }, { title: '' }]) {
    assert.throws(() => videoEmbed({ ...video, ...change }));
  }
});

test('search is partial, trimmed, case-insensitive, and ANDed with every selected tag', () => {
  assert.equal(matchesGame('Musical Replay', ['musical', 'replay'], ' REPL ', new Set(['musical', 'replay'])), true);
  assert.equal(matchesGame('Musical Replay', ['musical'], 'repl', new Set(['musical', 'replay'])), false);
  assert.equal(matchesGame('Musical Replay', ['musical', 'replay'], 'opera', new Set()), false);
  assert.equal(matchesGame('Alpha', [], '', new Set()), true);
});

test('filter controls toggle, combine with search, show empty results, and restore the list', () => {
  const element = (extra = {}) => ({ hidden: true, listeners: {}, attributes: {}, addEventListener(event, handler) { this.listeners[event] = handler; }, setAttribute(name, value) { this.attributes[name] = value; }, ...extra });
  const search = element({ value: '' });
  const filters = element();
  const empty = element();
  const button = element({ dataset: { gameTag: 'musical' } });
  const rows = [element({ dataset: { gameName: 'Alpha', gameTags: 'musical' } }), element({ dataset: { gameName: 'Beta', gameTags: 'replay' } })];
  const root = {
    querySelector: selector => ({ '#game-search': search, '.game_filters': filters, '.game_empty': empty })[selector],
    querySelectorAll: selector => selector === '[data-game-tag]' ? [button] : rows,
  };
  initGames(root);
  assert.equal(filters.hidden, false);
  assert.deepEqual(rows.map(row => row.hidden), [false, false]);
  button.listeners.click();
  assert.equal(button.attributes['aria-pressed'], 'true');
  assert.deepEqual(rows.map(row => row.hidden), [false, true]);
  search.value = 'beta';
  search.listeners.input();
  assert.equal(empty.hidden, false);
  button.listeners.click();
  assert.equal(button.attributes['aria-pressed'], 'false');
  assert.deepEqual(rows.map(row => row.hidden), [true, false]);
  search.value = '';
  search.listeners.input();
  assert.deepEqual(rows.map(row => row.hidden), [false, false]);
  assert.equal(empty.hidden, true);
});

test('imported catalog joins all definitions and preserves supplied video references', () => {
  const yaml = name => load(readFileSync(new URL(`../src/_models/data/${name}.yaml`, import.meta.url), 'utf8'));
  const definitions = readDefinitions(new URL('../src/games/definitions/', import.meta.url));
  const games = buildGames(yaml('game_data'), yaml('game_tags'), definitions);
  assert.ok(Object.keys(definitions).length >= 16);
  assert.equal(Object.values(games.bySlug).filter(game => game.pageLink).length, Object.keys(definitions).length);
  assert.equal(games.bySlug.newscast.names.includes('Newscaster'), true);
  assert.notEqual(games.bySlug.bff, games.bySlug.casanova);
  assert.equal(games.bySlug.newscast.videos.length, 1);
  assert.ok(games.bySlug['greatest-hits'].videos.some(video => video.youtube === 'https://www.youtube.com/watch?v=s2RjlhBTfBo'));
  assert.equal(games.tags.length, 11);
});

test('definition files require matching frontmatter and actual How to Play content', () => {
  const directory = mkdtempSync(join(tmpdir(), 'game-definition-test-'));
  const url = pathToFileURL(directory + '/');
  const path = join(directory, 'example.md');
  try {
    writeFileSync(path, '---\ngameSlug: example\n---\n## How to Play\n\n## Examples\nSome dialogue.\n');
    assert.throws(() => readDefinitions(url), /Missing How to Play/);
    writeFileSync(path, '---\ngameSlug: another\n---\n## How to Play\nPlay a scene.\n');
    assert.throws(() => readDefinitions(url), /must match/);
    writeFileSync(path, '## How to Play\nPlay a scene.\n');
    assert.throws(() => readDefinitions(url), /Missing game frontmatter/);
    writeFileSync(path, '---\ngameSlug: example\n---\n## How to Play\n\nPlay a scene.\n\n## Examples\nSome dialogue.\n');
    assert.equal(readDefinitions(url).example.gameSlug, 'example');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
