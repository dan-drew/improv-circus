---
name: add-player
description: Add an Improv Circus player from pasted player information and an attached or local image, creating the YAML entry and matching portraits or a square team logo.
---

# Add a player

Work from the project root. Add the player locally; committing, publishing, and changing show lineups require separate instructions.

## Intake and profile

- Read `src/_models/data/player_data.yaml`, its sibling `player_data.schema.yaml`, `theater_data.yaml`, and `src/_models/social.js` for current conventions. The actual player file is `player_data.yaml`; do not create a separate `player.yaml`.
- Accept free-form pasted information plus either an attached image or a local image path. Require a display name and usable image; ask for missing required inputs or ambiguous facts. Omit unavailable optional fields rather than guessing.
- When the supplied information identifies the player as a team, set `team: true` and treat the supplied image as a team logo. Teams support all regular player fields and use the same site presentation. Omit the flag for individuals unless explicitly supplied.
- Use a lowercase, filesystem-safe first-name key and matching filename stem by default. Use a surname suffix for collisions with another person. For teams, use a filesystem-safe key based on the team name. Check names, keys, and the applicable destination filenames before writing. If the person already exists or an output would overwrite an existing asset, ask whether to update or replace it before doing so.
- Map supplied details to `name`, `nickname`, `bio`, `location`, `home_town`, `improv_since` (numeric year), `theaters`, and `social`. Normalize supported social URLs into the handles expected by the model; retain full personal website URLs. Do not add social platforms the renderer cannot handle. Do not publish private contact information or add new schema fields without instruction.
- Match unambiguous theater names to existing IDs. Ask about unknown or ambiguous affiliations; do not silently discard them or create theater records.

### Biography approval

Preserve the supplied biography's voice, point of view, wording, facts, and paragraph structure. Propose **only spelling and grammar corrections**; do not rewrite, shorten, embellish, change first person to third person, or infer a bio from unrelated notes.

If corrections are needed, show the original and proposed text (or a clear diff) and ask the user to approve those specific changes. Explain that this approval is required by this skill's biography rule. Do not apply corrections until approved; silence is not approval. Continue independent photo work while awaiting a response. If declined, use the original. If there are no corrections, use the original without requesting approval. If no biography was supplied, omit it.

## Images

For a team, create only `src/images/people/<stem>.png`: an exactly 1024 × 1024 square version of the supplied logo. Use the built-in image editing tool and inspect local input images first. Preserve the logo's lettering, artwork, colors, and background; use padding or framing as needed to fit the full logo without clipping or distortion. Preserve existing transparency. Do not generate a transparent companion, remove or replace the background, or apply the portrait/theater treatment. Verify dimensions and visually inspect the finished logo. Follow the output-copying and tool-availability guidance below, then continue to integration.

### Individual portraits

Use the built-in image generation/editing tool for image edits. Inspect local input images with the image viewer before editing. Use local reference paths when available; for pasted images, include the smallest set of recent conversation images containing the target and needed references. Identify the supplied player as the edit target and existing players as background/style references only. Never transfer a reference player's face or clothing.

Before generating, visually inspect `src/images/people/dan.png`, `christian.png`, and `sara.png` (or comparable current player photos if those no longer exist). Match the observed style: natural, sharp head-and-shoulders portrait; warm illumination; dim traditional theater interior; red velvet curtains and red audience seating; warm amber wall-light bokeh; strongly defocused background. Existing references are 1254 square, but **both new deliverables must be exactly 1024 × 1024**.

Create these two real PNG files in `src/images/people/`:

1. `<stem>-transparent.png`: square head-and-shoulders cutout on a genuinely transparent background. Explicitly request transparent output. Preserve hair, clothing edges, and natural partially transparent edge pixels; no checkerboard, opaque backdrop, halo, or clipped head.
2. `<stem>.png`: the same player, pose, expression, clothing, subject scale, and placement against the blurry theater background matching the references. Use the cutout as the edit target where practical, changing only the background and modestly matching lighting. The finished site photo must be opaque.

Preserve identity, facial features, skin texture, hair, accessories, clothing, and expression. Allow modest exposure, color, and sharpness corrections; no beauty retouching or invented body details. Center the face naturally with room above the hair; use matching framing for both images. If the input cannot support this crop, ask for a framing decision or a better source rather than inventing missing anatomy.

Request 1024-square output in each prompt and verify the actual results. If a result has the wrong dimensions, request a corrected output through the image tool; do not accept the reference dimensions as the target. Inspect both outputs for identity drift, edge quality, framing, and style. Correct a specific defect if needed; after two unsuccessful corrective attempts, report the remaining issue and ask how to proceed.

Copy the selected tool outputs into the project destinations. Keep existing source files untouched and do not add source originals or discarded variants to the repository by default. If the built-in tool is unavailable, report the limitation; ask before using an API/CLI fallback rather than silently switching.

## Integrate and verify

Once the applicable images (one logo for a team, both portraits for an individual) are saved and any biography corrections are resolved, append the player entry using surrounding YAML conventions. Set `image: <stem>.png`; for individuals, the transparent image is a companion asset, not the site's player image. Preserve unrelated entries and formatting.

Check that YAML parses, the key is unique, supplied theater IDs resolve, and the image reference exists. Respect the current schema and runtime model; flag relevant discrepancies instead of expanding this task into unrelated fixes. Verify every deliverable is PNG and exactly 1024 × 1024. For individuals, verify the cutout contains both transparent and visible pixels and the site photo is fully opaque; for teams, verify the original logo and background are preserved without requiring opacity or a companion asset. Use available image metadata tools for dimensions and alpha checks and visually inspect the files; do not infer actual transparency from appearance alone.

Run the site's Eleventy build with `pnpm exec eleventy` under `TZ=UTC` (equivalent build engine without the package script's `prebuild` deletion of `dist`). Report any build limitation accurately. Review the diff for unrelated changes.

Finish with the player key, data-file link, links/previews of the generated image(s), the verification result, and whether approved bio corrections were applied. Leave the changes uncommitted and unpublished unless separately requested.
