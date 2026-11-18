# Quote Anchors with Outdated State for Annotations

Annotations attach to rendered Markdown content, and that content gets edited — both in this app and, more often, externally in whatever editor the user prefers. Anchoring annotations to positions (line or block numbers) would silently misplace them after every edit. We decided to anchor annotations to content and make anchor failure explicit.

**Decision:**
- An Anchor stores content references, never positions: a text-range anchor stores the selected text per block plus short surrounding-context excerpts; a whole-block anchor stores the block text plus its heading path. Cross-block selections become one annotation with per-block segments.
- Anchors are re-located by fuzzy matching whenever the document content changes (load, and after in-app saves). A failed match marks the annotation **Outdated**: still listed with a badge and a snapshot of the anchored text, never silently repositioned or dropped.
- Outdated annotations can be manually re-anchored by re-selecting the target content, reusing the same selection→anchor pipeline as creation.

**Considered Options:**
- Line/block-number positions — rejected: silent mispositioning after edits; the failure mode is invisible wrongness.
- Editor-coupled anchor maintenance (update anchors live while editing in Edit Mode) — rejected: only covers in-app edits; a previewer's documents are mostly edited elsewhere.
- Exact-match-only quotes — rejected: whitespace and formatting tweaks would orphan annotations far too easily.

**Consequences:**
- Fuzzy-match quality defines the felt reliability of the whole feature; the matcher is the seam to test hardest.
- The Source-view echo derives source lines by locating the quote in the raw Markdown — best-effort, degrading to the Outdated badge rather than to a wrong line.
- Anchor payloads (quotes, context, heading paths) are committed to the storage format on day one; changing the anchor model later means a data migration.
