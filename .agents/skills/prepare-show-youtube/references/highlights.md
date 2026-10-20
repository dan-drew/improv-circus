# Promotional stills

Use the original recording specification so source trims and joined-video offsets remain authoritative. This mode does not modify or depend on the rendered MP4. Organize originals before sampling for new jobs; when a render is active, leave them in place and export stills before deferred relocation. Avoid concurrent heavy decoding when it would interfere with an active render.

## Sample and review

```bash
node .agents/skills/prepare-show-youtube/scripts/prepare.mjs --spec /path/recording.json --mode highlights --candidates /local/temp/highlight-candidates
```

The candidate directory must be new and outside the show output directory. For a long run, launch the command as a detached process with its log in the temporary working directory so an execution-session timeout cannot terminate sampling. Resume an interrupted run with the same command plus `--resume`; it checks the original file sizes/modification times and exact sampling plan before reusing candidate images. Changed inputs require a new candidate directory. Sampling extracts roughly 30–60 evenly distributed thumbnails per game (fewer for very short segments), excludes segment edges and joined-video overlap intervals, and filters very dark/overexposed frames, obvious blur and near-duplicates. It writes numbered candidate JPEGs, paginated contact sheets, and `candidates.json`. Default games are segments with `titled: true`; set `highlights: {"includeEdges": true}` to include opening/closing segments.

Inspect every candidate contact sheet with the image-viewing tool. Technical scores are only filters, not estimates of humor or promotional quality. Choose five distinct moments per game, favoring expressive faces, readable gestures, physical action, interaction and varied compositions. Avoid blinks, obstructed faces, awkward blur and adjacent poses from the same moment. Inspect individual candidates or nearby frames if a sheet is ambiguous. Never fabricate a visual review or substitute quality-score ranking for it.

Write a temporary selection JSON using exact IDs from the manifest, one entry per sampled segment. `segmentIndex` is zero-based in the recording specification:

```json
{"segments": [{"segmentIndex": 1, "candidates": ["s02-c02", "s02-c08", "s02-c14", "s02-c22", "s02-c29"]}]}
```

If fewer than five distinct usable moments exist, supply fewer IDs and a nonempty `reason` on that entry. Include an empty list and explanation for a segment with none. Do not select rejected candidates. Candidate manifests refer to the original paths at sampling time; if sources have since moved, regenerate candidates against the updated specification rather than using stale references.

## Export

```bash
node .agents/skills/prepare-show-youtube/scripts/prepare.mjs --spec /path/recording.json --mode highlights --candidates /local/temp/highlight-candidates --selection /local/temp/selection.json
```

Export seeks the chosen timestamps in the originals and writes high-quality JPEGs at source resolution with no crop, upscaling, added text or branding. Filenames include the show slug, segment position/name, source index and original source timestamp (`HH-MM-SS-mmm`). Each game also gets a labeled contact sheet. The helper verifies publication checksums, refuses implicit replacement, and keeps its publication record in temporary storage. `--replace` is only for explicitly authorized replacement.

Inspect the selected full-resolution images and contact sheets; confirm labels, dimensions and variety. Report any games with fewer than five stills. These are suggested promotional images, not a claim to identify the funniest moments. Keep specifications, selections, candidates, logs and intermediate files out of the final show directory.
