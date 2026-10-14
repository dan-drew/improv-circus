import { readFileSync, readdirSync } from 'node:fs';
import { load } from 'js-yaml';

export function gameSlug(name) {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function videoEmbed(video) {
  if (!video || typeof video.title !== 'string' || !video.title.trim()) throw new Error('Video requires a title');
  const url = new URL(video.youtube);
  if (url.protocol !== 'https:') throw new Error('Video requires an HTTPS YouTube URL');
  let id;
  if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
    id = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1];
  }
  if (!/^[\w-]{11}$/.test(id ?? '')) throw new Error(`Invalid YouTube video: ${video.youtube}`);
  const embed = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
  for (const key of ['start', 'end']) {
    if (video[key] !== undefined) {
      if (!Number.isInteger(video[key]) || video[key] < 0) throw new Error(`Video ${key} must be nonnegative integer seconds`);
      embed.searchParams.set(key, video[key]);
    }
  }
  if (video.end !== undefined && video.end <= (video.start ?? 0)) throw new Error('Video end must exceed start');
  return embed.href;
}

export function readDefinitions(directory) {
  return Object.fromEntries(readdirSync(directory).filter(name => name.endsWith('.md')).map(name => {
    const source = readFileSync(new URL(name, directory), 'utf8');
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) throw new Error(`Missing game frontmatter: ${name}`);
    const metadata = load(match[1]);
    const slug = name.slice(0, -3);
    if (metadata?.gameSlug !== slug) throw new Error(`Game slug must match definition filename: ${name}`);
    const instructions = match[2].match(/^## How to Play\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[1];
    if (!instructions?.trim()) throw new Error(`Missing How to Play content: ${name}`);
    return [slug, { ...metadata, body: match[2] }];
  }));
}

export function buildGames(catalog, tags, definitions = {}) {
  const bySlug = {};
  const tagSlugs = new Set(tags.map(tag => tag.slug));
  if (tagSlugs.size !== tags.length) throw new Error('Duplicate game tag');
  const nameOwners = new Map();
  for (const item of catalog) {
    if (!Array.isArray(item.names) || !item.names.length || item.names.some(name => typeof name !== 'string' || !name.trim())) {
      throw new Error('Game requires nonempty names');
    }
    const slug = item.slug ?? gameSlug(item.names[0]);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || bySlug[slug]) throw new Error(`Invalid or duplicate game slug: ${slug}`);
    if (!Array.isArray(item.tags) || item.tags.some(tag => !tagSlugs.has(tag))) throw new Error(`Unknown tags for ${slug}`);
    const names = [...new Set(item.names)];
    for (const name of names) {
      const normalized = name.toLocaleLowerCase('en');
      if (nameOwners.has(normalized)) throw new Error(`Duplicate game name: ${name}`);
      nameOwners.set(normalized, slug);
    }
    const definition = definitions[slug];
    bySlug[slug] = {
      slug, names, fullName: names.join('/'),
      tags: tags.filter(tag => item.tags.includes(tag.slug)),
      pageLink: definition ? `/games/${slug}/` : null,
      videos: (definition?.videos ?? []).map(video => ({ ...video, embed: videoEmbed(video) })),
      relatedSlugs: definition?.relatedGames ?? [],
    };
  }
  for (const slug of Object.keys(definitions)) {
    if (!bySlug[slug]) throw new Error(`Orphan game definition: ${slug}`);
  }
  for (const game of Object.values(bySlug)) {
    game.relatedGames = game.relatedSlugs.map(slug => {
      if (!bySlug[slug]) throw new Error(`Unknown related game ${slug} in ${game.slug}`);
      return bySlug[slug];
    });
  }
  const entries = Object.values(bySlug).flatMap(game => game.names.map(name => ({ name, game })))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  return { bySlug, entries, tags };
}
