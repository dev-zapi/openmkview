#!/usr/bin/env node
/**
 * omk — the OpenMKView agent annotation CLI (entry point).
 *
 * A zero-dependency Node (>= 18) client for the Annotation API. It exists so
 * an agent can read human feedback and write annotations without the web UI:
 * list/show annotations, create one from a file path plus quoted text, reply,
 * resolve, and delete.
 *
 * The implementation lives in `lib/`:
 *   - `lib/markdown.mjs` — pure block model and Anchor construction (mirrors
 *     the frontend rules; FNV-1a block hashes, whitespace-normalized block
 *     text, heading paths, 48-character quote context)
 *   - `lib/client.mjs` — config, argument parsing, HTTP, prompts, and the
 *     Tool Session exchange
 *   - `lib/domain.mjs` — pure project/thread helpers (normalization,
 *     containment, freshness)
 *   - `lib/commands.mjs` — command implementations and dispatch
 *
 * The whole `scripts/` directory travels with the skill; running this entry
 * needs only Node itself. The pure parser/anchor functions are re-exported
 * below so the frontend vitest suite can validate CLI-computed anchors
 * through its own resolver seam.
 *
 * Configuration (URL + token only, mode 0600):
 *   ~/.config/openmkview/agent.json
 * `OPENMKVIEW_URL` overrides the configured URL.
 */

import fs from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { main } from './lib/commands.mjs';

export {
  CONTEXT_LENGTH,
  normalizeBlockText,
  hashBlockContent,
  parseMarkdownBlocks,
  buildAnchorFromMarkdown,
} from './lib/markdown.mjs';
export { normalizeProject, projectMatchesFor } from './lib/domain.mjs';
export { writeIdentity } from './lib/client.mjs';

/**
 * True when this module is the process entry point. Symlinked invocations are
 * compared by real path: `import.meta.url` is the resolved file while
 * `process.argv[1]` keeps the symlink path, which must still run the CLI.
 */
function isEntryPoint() {
  if (!process.argv[1]) return false;
  try {
    return (
      fs.realpathSync(process.argv[1]) ===
      fs.realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
    process.exitCode = 1;
  });
}