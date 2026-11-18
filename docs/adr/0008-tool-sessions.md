# Use Non-Expiring Tool Sessions for Non-Interactive Clients

Interactive browser logins use an in-memory session cookie that expires after inactivity and dies on every server restart. Agents and other non-interactive clients cannot log in that way: they cannot complete a login form, and unattended work must not break when a cookie expires or a server restarts. They need a durable credential that the instance owner can still revoke.

**Decision:**
- A Tool Session is a row in a new `tool_sessions` SQLite table (Data Root): `id`, `token_hash`, `label`, `created_at`, `last_used_at`. The plaintext token is generated server-side and returned exactly once by `POST /api/auth/tool-sessions/exchange`, which reuses the existing username/password verification. Credentials are never stored on the client.
- Only the SHA-256 hash of the token is persisted. `Authorization: Bearer <token>` is accepted across `/api/*` alongside the browser cookie.
- Tool Sessions never expire. Only the last-used timestamp is updated on use. Revocation is `DELETE /api/auth/tool-sessions/{id}`, surfaced in the settings panel; deleting the row is the only invalidation path.
- The `AuthMiddleware` receives a clone of the shared `Arc<Mutex<Connection>>` database handle and validates the bearer token with one indexed lookup per request. This chooses live database truth over an in-memory token cache: revocation takes effect immediately, across workers, and across restarts, with no cache-invalidation logic to get wrong.
- The credential-exchange path is the only public `/api/auth/tool-sessions*` path; listing and deletion require an authenticated cookie or bearer token.

**Considered Options:**
- In-memory Tool Session tokens — rejected: they die on restart, which is the exact failure mode this feature exists to remove.
- A cached hash set held in `AuthState` — rejected: revocation needs cache invalidation on every worker, and a stale cache silently keeps revoked tokens alive.
- Self-contained signed tokens (JWT-style) — rejected: stateless tokens cannot be revoked without a denylist, and the single-user product has no need for distributed verification.
- Per-token expiry — rejected by design: unattended agent work should not fail on a clock; the owner controls lifetime by deleting the session.
- Storing the plaintext token — rejected: a leaked database would become a set of usable credentials.

**Consequences:**
- Every bearer-authenticated request performs one indexed SQLite lookup and a last-used update. Acceptable for a single-user, self-hosted server; the write is throttled only by request volume.
- A Tool Session cannot be scoped to a subset of the API or labelled by permission; it is full access until deleted. The label exists only so the owner can recognize the client.
- Losing the plaintext token means deleting the session and exchanging credentials again; the database cannot recover it.
- The frontend settings panel must list sessions and offer revocation to keep the credential lifecycle in the owner's hands.
