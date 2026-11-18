# Keep Reply Authorship Free-Text with an Agent Flag

Annotations were designed as a human↔agent communication channel, but a Reply carried no authorship: an agent's note looked exactly like the human's, so a thread could not show who said what. The product is single-user with no account system, and non-interactive agent clients must be able to identify themselves without a browser login. We decided authorship is stored as a free-text name plus a voice flag rather than as identity.

**Decision:**
- Every note stores `author TEXT NULL` and `is_agent INTEGER NOT NULL DEFAULT 0`. The API accepts `author` and `isAgent` on create and reply, and echoes both (camelCase) on reads.
- The web UI stamps the logged-in username with `isAgent: false`. Agent clients supply their own name with `isAgent: true`.
- Threads render a per-note Author badge; agent notes are visibly marked. Notes with no Author (legacy rows) display "—".
- List endpoints accept `?author=` and keep threads containing at least one note by that Author. Filtering is exact-match on the stored string.
- Existing rows migrate to `author = NULL`, `is_agent = 0`; omitted authorship on writes has the same effect.

**Considered Options:**
- Author only, no Agent flag — rejected: a name alone cannot reliably distinguish an agent's voice from the human's, and nothing stops a name from imitating the other voice.
- Strong identity or a fixed enum of voices — rejected: overkill for a single-user product with no account system; an enum would hardcode which agents can exist and prevent free-text, per-client names.
- Server-derived authorship from the session cookie — rejected: agent clients are non-interactive and have no browser session (see ADR-0008 for their credentials), so they could never be attributed.
- Requiring Author on every write — rejected: legacy history and auth-disabled instances would need a fabricated name; nullable authorship preserves the "unknown" state honestly.

**Consequences:**
- Authorship is advisory, not authorization or an audit trail: any client can claim any Author, and `is_agent` is a self-declared voice marker. Acceptable because the instance owner controls who can reach the API at all.
- Free text allows inconsistent spellings and renames; `?author=` filtering matches the stored string exactly.
- The UI must keep handling `null` authorship indefinitely: rows written before the migration and writes from older clients both read back as unknown.
