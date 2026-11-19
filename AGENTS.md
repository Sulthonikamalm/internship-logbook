<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Codex logbook workflow

For natural-language logbook requests, follow `docs/CODEX_LOGBOOK.md`. Use the
project's `internflow` MCP tools or `npm run logbook -- <action> input.json`.
Keep requests restricted to repositories named by the user. Read every context
page, inspect actual candidate images, preserve manual activities, and never
infer an activity date from upload time. Use the same request UUID and payload
for retries. If photos are insufficient, reconstruct the requested commit's app
view using its local profile, then fall back to a genuine code/diff screenshot.
Include commit source references for reconstructed screenshots. Report unsupported
days as gaps. Save the activities and export the Excel, returning a clickable
local file link and any remaining gaps. Credentials and local artifacts belong
in the ignored `.codex/local/` directory; never put credentials in chat or source.
