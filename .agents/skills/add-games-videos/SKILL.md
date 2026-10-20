---
name: add-games-videos
description: Add timestamped YouTube show examples to matching existing Improv Circus game definition pages from a video link or ID and its chapter description.
---

# Add game video examples

Use this skill when given a YouTube video ID or link and a description containing timestamped game names. The timestamped description may be pasted text or a local text file. Do not upload videos, query YouTube, check availability or embedding, or search playlists.

Read `src/_models/data/game_data.yaml` and the matching files in `src/games/definitions/`. Match game labels case-insensitively while ignoring punctuation against catalog names and aliases. Add examples only to existing definition pages. Do not create catalog entries or game pages. Ignore non-game markers such as `Show start`, wrap-up, and stop-video labels. Report timestamped games that do not match the catalog and catalog games that have no definition page.

The timestamped description’s first nonblank line identifies the show and date. Use it as the basis for each video title, prefixed with `Improv Circus presents:`. Normalize a supplied ID or supported YouTube URL to `https://www.youtube.com/watch?v=<ID>` for the `youtube` field. Convert each matching game timestamp to integer seconds for `start`. Set `end` to the next timestamped segment’s start when present, even if that next segment has no matching page; omit `end` when no next timestamp is available.

Append entries to the existing `videos` frontmatter list without changing game instructions, relationships, or other metadata. Preserve all current examples. Treat an entry with the same YouTube video ID and start second as a duplicate and leave it unchanged. Keep the edit limited to the matched game definition pages, then report the pages updated and any skipped game labels.
