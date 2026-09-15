# Scoped, Unsanitized Custom Stylesheet for Markdown

Users can supply a Custom Stylesheet (raw CSS) to restyle rendered Markdown. We inject it as a single `<style>` element appended last in `<head>`, wrapped in `@scope (.markdown-view) { … }`, and we do **not** sanitize it. This trusts the single-user, self-hosted model already established in ADR-0002.

**Decision:**
- Scope: wrapped in `@scope (.markdown-view)` so the CSS can only affect rendered Markdown content, never the application shell. A broken stylesheet cannot lock the user out of settings.
- Injection: one `<style id="omkv-custom-stylesheet">` appended as the last child of `<head>`, updated live, so equal-specificity rules win by source order.
- No sanitization: stored and injected verbatim. The author is the sole owner of a self-hosted instance styling their own view; sanitizing CSS is complex and low-value here.
- One stylesheet for both themes: `.markdown-view` carries `data-theme`, so dark mode is targeted via `:scope[data-theme="dark"]`.
- Size cap ~100 KB to bound the SQLite settings row.
- Export is unaffected: PDF/HTML export uses a separate minimal renderer that already ignores all Markdown display settings.

**Considered Options:**
- Whole-page scope — rejected: a mistake could break the app chrome and the settings UI itself.
- Native CSS nesting (`.markdown-view { … }`) instead of `@scope` — viable and auto-raises specificity, but `@scope` gives cleaner containment; we accept that overriding built-in element styles then needs `:scope` specificity.
- Sanitizing/stripping `@import` and external `url()` — rejected for now: complex, and the trust model is single-user self-hosted. Caveat: external resources won't load offline (see ADR-0002).

**Consequences:**
- Requires a browser supporting CSS `@scope` (Chromium 118+, Safari 17.4+, Firefox 128+).
- Overriding built-in element styles (e.g. table padding) needs raised specificity, e.g. `:scope td { … }`.
- External `url()`/`@import` break offline PWA use and issue outbound requests.
