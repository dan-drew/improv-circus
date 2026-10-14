---
name: define-game
description: Create or update an Improv Circus game definition from a game name and requested changes, including rules, examples, tips, tags, related games, and YouTube videos.
---

# Define an improv game

Work from the project root. Make local content changes; committing or publishing requires separate instructions.

## Find the game and understand the update

- Read `src/_models/data/game_data.yaml`, `game_tags.yaml`, `src/_models/game.js`, and relevant definitions in `src/games/definitions/`.
- Accept a game name and one or more requested updates. Resolve names and aliases case-insensitively before adding a record. Ask when multiple games or materially different rule variants could match; preserve variants such as BFF and Casanova as separate games.
- Preserve existing slugs and unrelated content. For a new game, derive a lowercase hyphenated slug from its first name with the model's `gameSlug` helper, check collisions, and store it explicitly in the catalog. Confirm an ambiguous identity rather than merging games based only on similar names.

## Research a first-time game page

- Whenever creating a definition page for the first time, search the internet for the game and its catalog aliases, including when the catalog entry already exists or the user supplies rules. Open relevant sources rather than relying only on search snippets; prefer improv teachers, troupes, and game references.
- Incorporate useful, verified information such as clearer setup, playable examples, player/host tips, or documented variations. Preserve the user's supplied rules and house format; label materially different source versions as variations and confirm ambiguous game identities rather than mixing mechanics.
- Link the sources supporting added information in the page. Paraphrase instead of copying long passages. Do not add filler, unsupported rules, guessed aliases, or unrelated material merely because it appears in a search result.
- Research includes the required Shows playlist check and direct availability checks for any video candidates below. If useful sources cannot be found or accessed, create the page from the available supplied rules and report the research limitation; do not invent corroboration.
- Existing-page edits remain scoped to the user's request; this first-time requirement does not authorize a full rewrite on every later update.

## Edit catalog and definition

- The catalog is the source of truth for `names`, `slug`, and `tags`. Names are ordered; the first determines a new slug, and all names appear individually in the index. The full display name is `names.join("/")`.
- Definitions are `src/games/definitions/<slug>.md`. Frontmatter must contain `gameSlug: <slug>` matching the catalog and filename. The directory data supplies the layout and permalink; do not duplicate names or tags in the definition.
- Every definition needs a nonempty `## How to Play`. Use optional `## Examples`, `## Player Tips`, and `## Host Tips` sections when there is useful content; omit empty sections. Explain setup, progression, and ending clearly. Place example dialogue in quoted text or code so stage directions are not interpreted as HTML.
- Preserve the user's supplied rules, house variations, and requested scope. For a recognized game, draft missing guidance and useful tips as needed. Ask about unknown or ambiguous rules rather than inventing a version. Existing partial-update requests do not authorize rewriting the entire page.
- Use only the eleven existing category slugs from `game_tags.yaml`; infer categories from clear game mechanics. Do not add new categories unless requested.
- Optional frontmatter `relatedGames` is a list of existing catalog slugs. Catalog-only games are valid related games and render as text. Reference the matching variant; do not create placeholder games merely to satisfy a reference.
- Optional frontmatter `videos` is a list of objects with `title`, `youtube`, and optional `start`/`end` in integer seconds. Example:

```yaml
---
gameSlug: example-game
relatedGames: [another-existing-game]
videos:
  - title: Performance example
    youtube: https://www.youtube.com/watch?v=4jkBsKzLNMs
    start: 30
    end: 90
---
```

- Use supplied or verified YouTube video URLs, never guessed IDs. Supported forms are HTTPS watch, short, embed, and youtu.be links. Normalize supplied timestamps into `start`/`end`; both must be nonnegative and `end` must exceed `start` (or zero when start is absent). The page renders timed responsive players automatically; do not put iframe HTML in Markdown.

## Verify video availability

- Before adding a video, and when updating a page that already has videos, check every third-party video directly on YouTube. A link in a search result, blog, or other page confirms neither current availability nor embeddability.
- Inspect the watch page/player response for the actual video title and current playback and embedding status. Confirm it is the intended game demonstration. A successful HTTP response alone is insufficient: deleted/private videos can still return a page. Check Improv Circus recordings before adding them too.
- Remove existing embeds confirmed deleted, private, or unavailable, and do not add confirmed unavailable candidates. For a playable video with embedding disabled, omit the embed and retain a normal Markdown watch link when useful. Preserve other videos and unrelated page content.
- Treat a bot challenge, login restriction, failed fetch, or missing player data as an inconclusive check rather than evidence of deletion. Preserve existing entries in that case, do not describe new candidates as verified, and report which checks remain unresolved.

## Check Improv Circus show recordings

- Always check the **Shows** playlist on [Improv Circus’s YouTube channel](https://www.youtube.com/@improv-circus/playlists) when creating or updating a game definition, even when other video sources are supplied or the page already has videos. Find the playlist by its title and inspect every available show's full description for timestamped game names; follow playlist pagination when needed.
- Match description entries against the catalog's names and aliases, ignoring case and punctuation. Confirm uncertain names and materially different variants rather than attaching footage to the wrong game.
- Add applicable performances to frontmatter `videos`, preserving existing videos. Use the verified recording URL, a title identifying Improv Circus and the show/date, and the game's timestamp converted from `MM:SS` or `HH:MM:SS` to integer `start` seconds. Set `end` to the next timestamped segment when its boundary is clear; omit it when no reliable end is available. Do not guess timestamps or video IDs.
- Prefer Improv Circus performances before outside demonstrations and avoid duplicate recording/start pairs. Reuse the playlist inspection across games in a batch update, but refresh the playlist for a later task rather than assuming cached coverage is current.
- If the playlist or a description cannot be accessed, report the limitation and preserve existing videos. Distinguish an incomplete check from a completed check with no matching game; do not claim there are no recordings when the source was unavailable.

## Verify and report

Run `node --test` and `TZ=UTC pnpm exec eleventy` from the project root. Inspect the generated game page and relevant index aliases, tags, related-game links, and video embeds. If the package runner is unavailable, use `TZ=UTC node node_modules/@11ty/eleventy/cmd.cjs` with the installed dependencies.

Report what changed and validation results. Flag any unresolved ambiguity or unavailable supplied source rather than claiming verification passed.
