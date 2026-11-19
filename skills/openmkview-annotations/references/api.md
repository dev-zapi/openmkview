# OpenMKView annotation and auth HTTP API

The raw HTTP surface behind the `omk.mjs` CLI. Use it when Node is unavailable,
or when you need an endpoint the CLI does not expose (edit a Note, re-anchor,
clear a project).

Everything below was exercised against a locally built `openmkview` instance
at commit `c9b2954` on 2026-11-19, except the author-length error, which was
verified directly against `src/services/annotation_service.rs`. Status codes,
field names, and error strings are copied from the responses or source, not
reconstructed.

## Contents

1. [Conventions](#conventions)
2. [Authentication](#authentication)
3. [Auth endpoints](#auth-endpoints)
4. [Project endpoints](#project-endpoints)
5. [File endpoints](#file-endpoints)
6. [Annotation endpoints](#annotation-endpoints)
7. [Object shapes](#object-shapes)
8. [Anchor construction](#anchor-construction)
9. [Curl recipes for every CLI operation](#curl-recipes-for-every-cli-operation)
10. [Error reference](#error-reference)

## Conventions

- Base URL: `http://127.0.0.1:4567` by default (`openmkview serve --port`).
  The examples use `$BASE`.
- Request and response bodies are JSON unless an endpoint serves raw bytes.
- Send `Accept: application/json`. Send `Content-Type: application/json` on
  writes (a body is mandatory for the POST/PUT routes documented here).
- **Creates return `200 OK`**, not `201`. Mutation counts come back in the body
  (`{"deleted": n}`, `{"updated": n}`, `{"success": true}`).
- Timestamps are SQLite UTC strings such as `2026-11-18 12:46:41` (note the
  space, not `T`). File `lastModified` values are RFC 3339 with a `+00:00`
  offset.
- Casing is not uniform; it matches the wire format:
  - Query parameters: `project_id` (snake), `relativePath` (camel), `author`,
    `open`.
  - Annotation request bodies: **camelCase** — `projectId`, `relativePath`,
    `isAgent`.
  - Annotation responses: camelCase — `projectId`, `relativePath`,
    `isAgent`, `createdAt`, `updatedAt`.
  - `GET /api/projects` responses: **snake_case** — `created_at`,
    `last_opened_at`, `is_open`.
  - Auth and Tool Session responses: camelCase.

## Authentication

An instance is either **open** or **auth-enabled**, decided at startup by
`OPENMKVIEW_USERNAME` + `OPENMKVIEW_PASSWORD` (or config/CLI credentials).

- Open instance: every `/api/*` route is reachable without credentials, and
  `GET /api/auth/status` answers `{"authRequired": false, ...}`.
- Auth-enabled instance: every `/api/*` route except the public ones requires
  either the browser session cookie or a Tool Session bearer token.

Public paths (no credential required):

```
/api/auth/status
/api/auth/login
/api/auth/tool-sessions/exchange
/api/auth/passkey/login/start
/api/auth/passkey/login/finish
/api/version
```

Everything else under `/api/` is protected, including
`GET /api/auth/tool-sessions` and `DELETE /api/auth/tool-sessions/{id}`.

### Browser cookie

`POST /api/auth/login` sets the `openmkview_session` cookie (`HttpOnly`,
`SameSite=Strict`, path `/`; `Secure` when the instance is configured for it).
The cookie slides on use and dies when the server restarts. Use `curl -c` /
`curl -b` with a cookie jar for scripted browser-style access.

### Tool Session bearer token

For non-interactive clients. Exchange username/password once:

```bash
curl -s -X POST "$BASE/api/auth/tool-sessions/exchange" \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"secret","label":"my-agent"}' \
  -H 'Cache-Control: no-store'
```

Response (the plaintext token appears exactly once — store it):

```json
{"id":1,"label":"my-agent","token":"<TOKEN>","createdAt":"2026-11-18 12:47:47"}
```

Then send `Authorization: Bearer <token>` on every request. Tool Sessions never
expire; they survive restarts and are invalidated only by deleting the row.

### 401 handling

A missing or revoked credential returns `401 Unauthorized`:

```json
{"error":"未登录或登录已过期"}
```

That message means "not logged in or the login expired". For a Tool Session it
means the session was deleted (or the server has no such token) — re-run the
credential exchange. `omk.mjs` maps it to
`Tool Session revoked — run omk.mjs init`.

## Auth endpoints

### GET /api/auth/status

Open instance (200):

```json
{"authRequired":false,"authenticated":true,"passkeyConfigured":false,"passkeyAvailable":false}
```

Auth-enabled, no credential (200):

```json
{"authRequired":true,"authenticated":false,"sessionTimeoutMinutes":60,"passkeyConfigured":false,"passkeyAvailable":false}
```

Auth-enabled, valid cookie (200) adds `"username":"alice"`. `username` and
`passkeyOrigin` are omitted when absent, as are `sessionTimeoutMinutes` on open
instances.

### POST /api/auth/login

Body: `{"username":"alice","password":"secret"}`. Success (200) sets the session
cookie and returns the authenticated status object above. Failure (401):

```json
{"error":"用户名或密码错误"}
```

"Wrong username or password." On an open instance the route returns the open
status object and sets no cookie.

### POST /api/auth/logout

Removes the session and clears the cookie. Returns 200 with an empty body.

### PUT /api/auth/session-timeout

Body: `{"sessionTimeoutMinutes":60}`. Returns the authenticated status object.
On an open instance (400):

```json
{"error":"当前未启用登录认证"}
```

"Login authentication is not enabled."

### POST /api/auth/tool-sessions/exchange

Body: `{"username":"alice","password":"secret","label":"my-agent"}`. `label` is
optional; blank/omitted becomes `"Tool session"`. Response is the object shown
under [Tool Session bearer token](#tool-session-bearer-token), with
`Cache-Control: no-store`.

Errors:

- 401 `{"error":"用户名或密码错误"}` — bad credentials.
- 400 `{"error":"当前未启用登录认证"}` — the instance is open; no exchange needed.

### GET /api/auth/tool-sessions

Authenticated only. Returns the sessions as an array; `lastUsedAt` appears once
the session has been used:

```json
[{"id":1,"label":"my-agent","createdAt":"2026-11-18 12:47:47","lastUsedAt":"2026-11-18 12:48:05"}]
```

Unauthenticated: 401 `{"error":"未登录或登录已过期"}`. Open instance: 400
`{"error":"当前未启用登录认证"}`.

### DELETE /api/auth/tool-sessions/{id}

Authenticated only. Revokes immediately (the next request with that token gets
401). Success (200): `{"success":true}`. Missing id (404):

```json
{"error":"Not found: Tool Session 不存在"}
```

## Project endpoints

The CLI covers these directly: `projects list [--open]` (GET /api/projects),
`projects open <dir>` (POST /api/projects/validate, then POST
/api/projects/open), and `projects detect [<dir>]` (GET /api/projects plus
client-side path matching). The CLI normalizes the snake_case rows below into
camelCase (`isOpen`, `createdAt`, `lastOpenedAt`); the raw wire format stays
snake_case.

### GET /api/projects

Returns every registered project. `?open=true` keeps only open ones. Response
fields are snake_case:

```json
[{"id":1,"path":"/home/you/fixture/docs","name":"docs","created_at":"2026-11-18 12:46:30","last_opened_at":"2026-11-18 12:46:30","is_open":true,"color":null,"icon":null}]
```

### POST /api/projects

Body: `{"path":"/absolute/path/to/docs"}`. Registers (or re-opens) the
directory and returns the project object. A newly registered directory is open,
so the response is `200 OK`. A path that does not exist is a 400 with a Chinese
message, e.g. `{"error":"目录不存在: /bad/path"}`.

`GET /api/projects/recent` returns the 10 most recently opened projects;
`POST /api/projects/open` returns `{success, project}` instead of a bare
project.

## File endpoints

### GET /api/files/tree?project_id={id}

Returns the file tree as an array of nodes:

```json
[{"id":"README.md","name":"README.md","path":"README.md","isFolder":false,"fileType":"markdown","hidden":false,"isPlaceholder":false,"size":594}]
```

Directories carry `children` (omitted when not loaded) and `isFolder:true`.
`isPlaceholder:true` marks a Placeholder Directory that cannot be expanded.
Hidden Entries are still listed with `hidden:true`.

### GET /api/files/content?project_id={id}&relativePath={path}

Returns the annotatable text. `relativePath` is relative to the project root
and may contain `/`:

```json
{"binary":false,"content":"# OpenMKView Fixture\n\n...","fileName":"README.md","path":"README.md","fileSize":594,"lastModified":"2026-11-18T12:40:11.512345678+00:00","truncated":false,"lossy":false,"size":594}
```

- Markdown/HTML are read strictly as UTF-8 and never truncated.
- Other text files are read as bytes: `binary:true` with `content:""` when a NUL
  byte is found; `truncated:true` past 1 MiB; `lossy:true` when invalid UTF-8
  was replaced.
- Missing file: 404 `{"error":"Not found: File does not exist"}`.
- Path traversal: 400 `{"error":"Validation error: Path traversal is not allowed"}`.

`omk.mjs create` refuses `binary` or `truncated` files because a partial file
cannot be anchored safely.

### GET /api/files/raw?project_id={id}&relativePath={path}

Serves the bytes with a detected content type. Markdown is currently served as
`text/plain`. Observed headers:

```
content-type: text/plain
content-disposition: inline; filename="README.md"
x-content-type-options: nosniff
```

SVG additionally gets a restrictive `Content-Security-Policy`.

## Annotation endpoints

All annotation payloads use the [Annotation shape](#annotation). The Anchor is
opaque JSON owned by the frontend; the server validates its structure (see
[Anchor construction](#anchor-construction)) and stores it verbatim.

### GET /api/annotations?project_id={id}&relativePath={path}[&author={name}]

The annotations for one existing file, ordered by creation. `author` keeps
threads that contain at least one note by that exact author string.

```json
[{"id":1,"projectId":1,"relativePath":"README.md","anchor":{"segments":[{"blockHash":"blk-0736af34","blockText":"The quick brownfox jumps overthe lazy dog.","blockType":"p","headingPath":["OpenMKView Fixture","Overview"],"kind":"text","prefix":"The quick brown","quote":"fox jumps","suffix":" overthe lazy dog."}],"version":1},"snapshot":"fox jumps","resolved":false,"createdAt":"2026-11-18 12:46:41","updatedAt":"2026-11-18 12:46:41","notes":[{"id":1,"annotationId":1,"body":"Eval seed note.","author":"claude","isAgent":true,"createdAt":"2026-11-18 12:46:41"}]}]
```

If the file does not exist at `relativePath`, this endpoint returns `[]`
(200) — annotations whose path disappeared are not attached to a document.
`relativePath` must still be a legal relative path (traversal is 400).

### GET /api/annotations/manage?project_id={id}[&author={name}]

Project-wide management list. Every row is an Annotation plus
`"missingFile": true|false`, where `true` means the stored relative path no longer
exists on disk (the **Missing File** state). Ordered by `relativePath`, then
creation. `author` filters the same way as above.

This is the only way to see Missing File rows, and the only list the CLI uses
for `show` (there is no single-annotation GET).

### POST /api/annotations

Creates a thread and its first note. Body:

```json
{
  "projectId": 1,
  "relativePath": "README.md",
  "anchor": { "version": 1, "segments": [ ... ] },
  "body": "Please clarify the prerequisites.",
  "author": "claude",
  "isAgent": true
}
```

- `author` is free text, trimmed; blank/omitted stores `NULL`. Names longer
  than 200 characters are rejected with a 400 (see below).
- `isAgent` defaults to `false` (human voice) when omitted.
- `body` is trimmed and must be non-empty.
- `anchor` must be an Anchor object accepted by the validator below.

Success is `200 OK` with the full Annotation. The server also derives `snapshot`
from the Anchor (the quoted text, or block text, joined with blank lines).

Validation errors are 400 with one of these bodies:

```json
{"error":"Anchor must be a JSON object"}
{"error":"Anchor requires a numeric version"}
{"error":"Anchor requires at least one segment"}
{"error":"Anchor segment kind must be block or text"}
{"error":"Anchor segment requires a blockHash"}
{"error":"Anchor segment requires blockText"}
{"error":"Anchor segment requires a blockType"}
{"error":"Anchor segment requires a headingPath array"}
{"error":"Text segment requires a quote"}
{"error":"Text segment requires a prefix"}
{"error":"Text segment requires a suffix"}
{"error":"Note body is required"}
{"error":"Author must be 200 characters or fewer"}
```

Unknown project: 404 `{"error":"Not found: Project not found"}`.
Note that `create` validates the *relative path*, not that the file exists; a
row created for a missing file simply shows up as Missing File.

### PUT /api/annotations/{id}/anchor

Manual re-anchor. Body: `{"anchor": { ... }}`. Replaces the Anchor and refreshes
`snapshot` from it; notes and Resolved are untouched. Returns the updated
Annotation. Invalid Anchor: the same 400 list as create. Missing annotation:
404 `{"error":"Not found: Annotation not found"}`.

### DELETE /api/annotations/{id}

Deletes the thread and its notes. Success (200): `{"success":true}`. Missing
annotation: 404 `{"error":"Not found: Annotation not found"}`.

### POST /api/annotations/{id}/notes

Appends a Reply. Body:

```json
{"body":"Thanks, I updated the setup section.","author":"claude","isAgent":true}
```

Same author/isAgent rules as create. Success (200) returns the whole thread with
the new note appended. Empty body: 400 `{"error":"Note body is required"}`.
Author longer than 200 characters: 400
`{"error":"Author must be 200 characters or fewer"}`.
Missing annotation: 404 `{"error":"Not found: Annotation not found"}`.

### PUT /api/annotations/{id}/notes/{note_id}

Edits one note body. Body: `{"body":"..."}`. Author and isAgent are preserved.
Returns the whole thread. Empty body: 400 `{"error":"Note body is required"}`.
Missing annotation: 404 `{"error":"Not found: Annotation not found"}`. Missing
note: 404 `{"error":"Not found: Note not found"}`.

### PUT /api/annotations/{id}/resolved

Body: `{"resolved":true}` (or `false` to un-resolve). Resolved applies to the
whole thread, never a single Reply. Returns the updated Annotation. Missing:
404 `{"error":"Not found: Annotation not found"}`.

### POST /api/annotations/batch-delete

Body: `{"projectId":1,"ids":[2,3]}`. Ids from another project (or already gone)
are ignored. Success (200): `{"deleted":2}`. Unknown project: 404
`{"error":"Not found: Project not found"}`.

### POST /api/annotations/batch-resolve

Body: `{"projectId":1,"ids":[2,3],"resolved":true}`. Ids from another project
are ignored. Success (200): `{"updated":2}`.

### DELETE /api/annotations/project/{project_id}

Deletes every annotation in the project. Success (200):
`{"deleted":12}`. Unknown project: 404 `{"error":"Not found: Project not found"}`.

## Object shapes

### Annotation

```json
{
  "id": 1,
  "projectId": 1,
  "relativePath": "README.md",
  "anchor": { "version": 1, "segments": [] },
  "snapshot": "fox jumps",
  "resolved": false,
  "createdAt": "2026-11-18 12:46:41",
  "updatedAt": "2026-11-18 12:46:41",
  "notes": []
}
```

`snapshot` is nullable. `notes` is time-ordered. Managed rows add
`"missingFile": false`.

### AnnotationNote

```json
{
  "id": 1,
  "annotationId": 1,
  "body": "Eval seed note.",
  "author": "claude",
  "isAgent": true,
  "createdAt": "2026-11-18 12:46:41"
}
```

`author` is nullable: `null` is a legacy/unknown note and renders as "—".
`isAgent:false` is the human voice; `true` is an agent voice. Authorship is
advisory (ADR-0007), not authorization.

### Anchor

```json
{
  "version": 1,
  "segments": [
    {
      "kind": "text",
      "blockHash": "blk-0736af34",
      "blockText": "The quick brownfox jumps overthe lazy dog.",
      "blockType": "p",
      "headingPath": ["OpenMKView Fixture", "Overview"],
      "quote": "fox jumps",
      "prefix": "The quick brown",
      "suffix": " overthe lazy dog."
    }
  ]
}
```

A whole-block segment uses `"kind":"block"` and omits `quote`/`prefix`/`suffix`.
A whole-file Anchor is one `block` segment per block. The validator requires
`version`, a non-empty `segments` array, and on every segment `kind`
(`block|text`), `blockHash`, `blockText`, `blockType`, and a string array
`headingPath`; text segments additionally require non-empty `quote`, `prefix`,
and `suffix`.

## Anchor construction

The server cannot see rendered Markdown, so a client must build an Anchor from
the text a reader sees. The rules are the frontend's block model:

- **blockHash** = `"blk-"` + 8 lowercase hex digits of FNV-1a (32-bit) over
  `"<blockType>\u0001<blockText>\u0001<occurrence>"`, where `occurrence` is the
  0-based count of earlier blocks with the same `(blockType, blockText)` pair.
- **blockText** is the rendered text with all whitespace collapsed to single
  spaces and trimmed. Because the renderer is configured with `breaks: true`,
  a soft line break contributes **no separator**: hard-wrapped prose
  `quick brown\nfox jumps` renders and anchors as `quick brownfox jumps`.
  List items are separated by one space; a list item's continuation line joins
  with no separator; table cells are separated by one space; image alt text is
  dropped; link labels survive.
- **quote** is the selected span, whitespace-normalized, matched against
  `blockText`. If it equals the whole block, emit a `block` segment instead.
- **prefix** / **suffix** are up to 48 characters of `blockText` immediately
  before / after the quote.
- **headingPath** is the chain of ancestor headings, excluding the block's own
  heading text.
- Frontmatter is not an annotatable block.

The `omk.mjs` CLI implements this exactly. Without Node, the following
zero-dependency Python 3 helper produces the same result (verified against the
CLI on paragraphs, wrapped prose, ATX/setext headings, fenced and indented
code, blockquotes, lists with continuations, tables, images, and whole-file
anchors):

```python
#!/usr/bin/env python3
"""anchor.py FILE [QUOTE] -> Anchor JSON. Mirrors omk.mjs."""
import html, json, re, sys

CONTEXT = 48
ESCAPABLE = set("\\`*_{}[]()#+-.!>~|")

def normalize(text):
    return re.sub(r"\s+", " ", str(text)).strip()

def fnv1a(text):
    h = 0x811C9DC5
    for ch in text:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"

def strip_inline(line):
    out, in_code, i = [], False, 0
    while i < len(line):
        ch = line[i]
        if ch == "\\" and i + 1 < len(line) and line[i + 1] in ESCAPABLE:
            out.append(line[i + 1]); i += 2; continue
        if ch == "`":
            in_code = not in_code; i += 1; continue
        if not in_code and ch in "*_~":
            j = i
            while j + 1 < len(line) and line[j + 1] == ch:
                j += 1
            run = j - i + 1
            if ch != "~" or run >= 2:
                prev = line[i - 1] if i > 0 else " "
                nxt = line[j + 1] if j + 1 < len(line) else " "
                left = i == 0 or prev.isspace()
                right = j == len(line) - 1 or nxt.isspace()
                if (left and not right) or ((not left) and (right or nxt in ".,;:!?)]}")):
                    i = j + 1; continue
            out.append(line[i:j + 1]); i = j + 1; continue
        out.append(ch); i += 1
    return "".join(out)

def project_line(line):
    t = line.strip()
    if re.fullmatch(r"=+", t) or re.fullmatch(r"([*_-])(\s*\1){2,}", t) or re.fullmatch(r"-+", t):
        return ""
    if "-" in t and re.fullmatch(r"\|?[\s:|-]+\|?", t):
        return ""
    text = re.sub(r"^\s{0,3}#{1,6}\s+", "", line)
    text = re.sub(r"^(\s{0,3}>\s?)+", "", text)
    text = re.sub(r"^\s{0,3}([-+*]|\d{1,9}[.)])\s+", "", text)
    text = re.sub(r"^\[[ xX]\]\s+", "", text)
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)
    text = re.sub(r"!\[[^\]]*\]\[[^\]]*\]", "", text)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"\[([^\]]*)\]\[[^\]]*\]", r"\1", text)
    text = re.sub(r"<((?:https?|mailto):[^>]+)>", r"\1", text)
    text = re.sub(r"<[^>]+>", "", text)
    return html.unescape(strip_inline(text))

def create_builder():
    return {"chars": [], "pending": False}

def push_character(builder, ch):
    if ch.isspace():
        if builder["chars"] and builder["chars"][-1] != " ":
            builder["pending"] = True
        return
    if builder["pending"]:
        builder["chars"].append(" ")
        builder["pending"] = False
    builder["chars"].append(ch)

def push_text(builder, text):
    content = re.sub(r"\s+$", "", text)
    for ch in content:
        push_character(builder, ch)

def push_line(builder, line):
    for ch in line:
        push_character(builder, ch)
    push_character(builder, "\n")

def push_separator(builder):
    push_character(builder, " ")

def strip_indent(line, width):
    index = 0
    while index < len(line) and index < width and line[index] == " ":
        index += 1
    return line[index:]

FENCE = re.compile(r"^\s{0,3}(`{3,}|~{3,})(.*)$")
ATX = re.compile(r"^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$")
SETEXT = re.compile(r"^\s{0,3}(=+|-+)\s*$")
HR = re.compile(r"^\s{0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$")
LIST = re.compile(r"^(\s{0,3})([-+*]|\d{1,9}[.)])(\s+)(.*)$")
BQ = re.compile(r"^\s{0,3}>\s?(.*)$")
INDENTED = re.compile(r"^(\t| {4})")
TABLE_DELIM = re.compile(r"^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$")

def is_table_start(lines, i):
    return i + 1 < len(lines) and "|" in lines[i] and bool(TABLE_DELIM.match(lines[i + 1]))

def starts_block(lines, i):
    line = lines[i]
    if not line.strip():
        return True
    return bool(FENCE.match(line) or ATX.match(line) or LIST.match(line) or BQ.match(line)
                or HR.match(line) or is_table_start(lines, i))

def parse_blocks(markdown):
    lines, blocks, headings, i = markdown.split("\n"), [], [], 0
    if lines and lines[0].strip() == "---":
        for at in range(1, len(lines)):
            if lines[at].strip() in ("---", "..."):
                i = at + 1; break
    def path():
        return [h[1] for h in headings]
    def finish(builder, kind):
        blocks.append({"text": "".join(builder["chars"]), "type": kind, "headingPath": path()})
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1; continue
        fence = FENCE.match(line)
        if fence:
            marker = fence.group(1)[0]
            close = re.compile(r"^\s{0,3}" + re.escape(marker) + r"{" + str(len(fence.group(1))) + r",}\s*$")
            builder, j = create_builder(), i + 1
            while j < len(lines) and not close.match(lines[j]):
                push_line(builder, lines[j]); j += 1
            finish(builder, "code")
            i = j + 1 if j < len(lines) else len(lines); continue
        atx = ATX.match(line)
        if atx:
            level = len(atx.group(1))
            while headings and headings[-1][0] >= level: headings.pop()
            builder = create_builder()
            push_text(builder, project_line(atx.group(2)))
            finish(builder, f"h{level}")
            headings.append((level, normalize("".join(builder["chars"]))))
            i += 1; continue
        if INDENTED.match(line):
            builder, j = create_builder(), i
            while j < len(lines):
                if not lines[j].strip():
                    nxt = lines[j + 1] if j + 1 < len(lines) else None
                    if nxt is not None and INDENTED.match(nxt):
                        j += 1; continue
                    break
                if not INDENTED.match(lines[j]): break
                push_line(builder, INDENTED.sub("", lines[j], count=1)); j += 1
            finish(builder, "code"); i = j; continue
        if BQ.match(line):
            builder, j = create_builder(), i
            while j < len(lines) and BQ.match(lines[j]):
                content = BQ.match(lines[j]).group(1)
                if content.strip():
                    push_text(builder, project_line(content))
                else:
                    push_separator(builder)
                j += 1
            finish(builder, "blockquote"); i = j; continue
        if is_table_start(lines, i):
            builder, rows, j = create_builder(), [lines[i]], i + 2
            while j < len(lines) and lines[j].strip() and "|" in lines[j]:
                rows.append(lines[j]); j += 1
            for row in rows:
                # Split only on unescaped pipes, like the CLI's splitTableRow.
                for cell in re.split(r"(?<!\\)\|", re.sub(r"^\||\|$", "", row.strip())):
                    push_separator(builder)
                    push_text(builder, normalize(project_line(cell)))
            finish(builder, "table"); i = j; continue
        lst = LIST.match(line)
        if lst:
            builder, ordered, j, count = create_builder(), lst.group(2)[0].isdigit(), i, 0
            content_indent = len(lst.group(1)) + len(lst.group(2)) + len(lst.group(3))
            while j < len(lines) and lines[j].strip():
                item = LIST.match(lines[j])
                if item:
                    if count > 0: push_separator(builder)
                    push_text(builder, project_line(item.group(4)))
                    count += 1; j += 1; continue
                if starts_block(lines, j): break
                # Strip only the list container indent, like stripIndent.
                push_text(builder, project_line(strip_indent(lines[j], content_indent)))
                j += 1
            finish(builder, "ol" if ordered else "ul"); i = j; continue
        if HR.match(line) or SETEXT.match(line):
            i += 1; continue
        builder, j, setext_level = create_builder(), i, None
        while j < len(lines) and lines[j].strip():
            if j > i and SETEXT.match(lines[j]):
                setext_level = 1 if lines[j].strip().startswith("=") else 2
                j += 1; break
            if j > i and starts_block(lines, j): break
            push_text(builder, project_line(lines[j])); j += 1
        if setext_level:
            while headings and headings[-1][0] >= setext_level: headings.pop()
            finish(builder, f"h{setext_level}")
            headings.append((setext_level, normalize("".join(builder["chars"]))))
        else:
            finish(builder, "p")
        i = j
    return blocks

def blocks_with_ids(markdown):
    seen, result = {}, []
    for block in parse_blocks(markdown):
        key = f"{block['type']}\x01{block['text']}"
        occurrence = seen.get(key, 0); seen[key] = occurrence + 1
        result.append({"id": "blk-" + fnv1a(f"{key}\x01{occurrence}"),
                       "type": block["type"], "text": block["text"],
                       "headingPath": block["headingPath"]})
    return result

def build_anchor(markdown, quote=None):
    blocks = blocks_with_ids(markdown)
    if not blocks: raise SystemExit("File has no annotatable content")
    def segment(b):
        return {"kind": "block", "blockHash": b["id"], "blockText": b["text"],
                "blockType": b["type"], "headingPath": b["headingPath"]}
    if quote is None:
        return {"version": 1, "segments": [segment(b) for b in blocks]}
    needle = normalize(quote)
    if not needle: raise SystemExit("Quote cannot be empty")
    whole = next((b for b in blocks if b["text"] == needle), None)
    if whole: return {"version": 1, "segments": [segment(whole)]}
    block = next((b for b in blocks if needle in b["text"]), None)
    start = block["text"].find(needle) if block else -1
    if not block:
        lower = needle.lower()
        block = next((b for b in blocks if b["text"].lower().find(lower) >= 0), None)
        if block: start = block["text"].lower().find(lower)
    if not block or start < 0: raise SystemExit(f'Quote not found in file: "{needle}"')
    end = start + len(needle)
    return {"version": 1, "segments": [{
        "kind": "text", "blockHash": block["id"], "blockText": block["text"],
        "blockType": block["type"], "headingPath": block["headingPath"],
        "quote": block["text"][start:end],
        "prefix": block["text"][max(0, start - CONTEXT):start],
        "suffix": block["text"][end:end + CONTEXT]}]}

if __name__ == "__main__":
    with open(sys.argv[1], encoding="utf-8") as handle:
        markdown = handle.read()
    print(json.dumps(build_anchor(markdown, sys.argv[2] if len(sys.argv) > 2 else None), indent=2))
```

Run it from a file you saved from the `content` endpoint (or the project file
directly) and POST the output as `anchor`:

```bash
BASE=http://127.0.0.1:4567
PROJECT_ID=1
curl -s "$BASE/api/files/content?project_id=$PROJECT_ID&relativePath=README.md" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["content"])' > ./omk-target.md
ANCHOR="$(python3 anchor.py ./omk-target.md 'fox jumps')"
curl -s -X POST "$BASE/api/annotations" -H 'Content-Type: application/json' \
  -d "{\"projectId\":$PROJECT_ID,\"relativePath\":\"README.md\",\"anchor\":$ANCHOR,\"body\":\"Please explain the fox.\",\"author\":\"claude\",\"isAgent\":true}"
```

One known limitation: the FNV loop hashes Python Unicode code points, while the
CLI hashes UTF-16 code units. For characters outside the Basic Multilingual
Plane (emoji, some CJK extensions) the hash differs; the anchor still validates
but may resolve Outdated. Use the CLI for such documents.

## Curl recipes for every CLI operation

Set these once:

```bash
BASE=http://127.0.0.1:4567
PROJECT_ID=1
FILE=README.md
TOKEN=            # auth-enabled instances only
AUTH=()
[[ -n "$TOKEN" ]] && AUTH=(-H "Authorization: Bearer $TOKEN")
```

Every recipe below was run against the fixture instance. JSON responses are
shown trimmed.

### `omk.mjs init` / `login` — configure a client

1. Ask whether auth is required:

```bash
curl -s "$BASE/api/auth/status"
# {"authRequired":false,"authenticated":true,"passkeyConfigured":false,"passkeyAvailable":false}
# or auth-required with "sessionTimeoutMinutes" and no "username"
```

2. Open instance: done — `{"url": "...", "token": null}` is the whole config.

3. Auth instance: exchange once and keep the token:

```bash
curl -s -X POST "$BASE/api/auth/tool-sessions/exchange" \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"secret","label":"my-agent"}'
# {"id":1,"label":"my-agent","token":"<TOKEN>","createdAt":"..."}
```

Config file the CLI writes (`~/.config/openmkview/agent.json`, mode 0600):
`{"url":"http://127.0.0.1:4567","token":"<TOKEN or null>"}`. Never store the
password.

### `omk.mjs list --file` — annotations for one file

```bash
curl -s "${AUTH[@]}" "$BASE/api/annotations?project_id=$PROJECT_ID&relativePath=$FILE"
```

Filter by author:

```bash
curl -s "${AUTH[@]}" "$BASE/api/annotations?project_id=$PROJECT_ID&relativePath=$FILE&author=claude"
```

The CLI's `--resolved` / `--unresolved` are client-side filters over
`resolved`; add `| jq '[.[] | select(.resolved)]'` if you have `jq`, or filter
in your language of choice.

### `omk.mjs list` (no --file) — project management list

```bash
curl -s "${AUTH[@]}" "$BASE/api/annotations/manage?project_id=$PROJECT_ID"
```

`--orphans` keeps rows with `"missingFile": true`; `--author` maps to the query
parameter of the same name.

### `omk.mjs show <id>` — find one annotation

There is no single-annotation GET. List projects, then each project's
management rows, and select the id:

```bash
curl -s "${AUTH[@]}" "$BASE/api/projects"
for id in $(curl -s "${AUTH[@]}" "$BASE/api/projects" \
  | python3 -c 'import json,sys; print(" ".join(str(p["id"]) for p in json.load(sys.stdin)))'); do
  curl -s "${AUTH[@]}" "$BASE/api/annotations/manage?project_id=$id"
done
# pipe through jq '.[] | select(.id == 7)' (or the equivalent)
```

### `omk.mjs create` — annotate a quote

1. Fetch the text and save it locally:

```bash
curl -s "${AUTH[@]}" \
  "$BASE/api/files/content?project_id=$PROJECT_ID&relativePath=$FILE" \
  | python3 -c 'import json,sys; sys.stdout.write(json.load(sys.stdin)["content"])' > ./target.md
```

2. Build the Anchor (the Python helper above, or the CLI):

```bash
ANCHOR="$(python3 anchor.py ./target.md 'fox jumps')"
```

3. POST it:

```bash
curl -s "${AUTH[@]}" -X POST "$BASE/api/annotations" \
  -H 'Content-Type: application/json' \
  -d "{\"projectId\":$PROJECT_ID,\"relativePath\":\"$FILE\",\"anchor\":$ANCHOR,\"body\":\"Explain the fox.\",\"author\":\"claude\",\"isAgent\":true}"
```

Omit `author`/`isAgent` for the human voice. Omit the quote to build a
whole-file Anchor (the helper handles that when the second argument is absent).

### `omk.mjs reply` — add a Reply

```bash
curl -s "${AUTH[@]}" -X POST "$BASE/api/annotations/7/notes" \
  -H 'Content-Type: application/json' \
  -d '{"body":"Handled in commit abc123.","author":"claude","isAgent":true}'
```

The response is the whole thread; the new note is last.

### `omk.mjs resolve` — mark a thread Resolved

```bash
curl -s "${AUTH[@]}" -X PUT "$BASE/api/annotations/7/resolved" \
  -H 'Content-Type: application/json' -d '{"resolved":true}'
```

`--undo` sends `false`.

### `omk.mjs batch-resolve` — many ids in one project

```bash
curl -s "${AUTH[@]}" -X POST "$BASE/api/annotations/batch-resolve" \
  -H 'Content-Type: application/json' \
  -d "{\"projectId\":$PROJECT_ID,\"ids\":[7,8],\"resolved\":true}"
# {"updated":2}
```

### `omk.mjs delete` — delete threads

Single:

```bash
curl -s "${AUTH[@]}" -X DELETE "$BASE/api/annotations/7"
# {"success":true}
```

Batch (`delete id... --project`):

```bash
curl -s "${AUTH[@]}" -X POST "$BASE/api/annotations/batch-delete" \
  -H 'Content-Type: application/json' \
  -d "{\"projectId\":$PROJECT_ID,\"ids\":[7,8]}"
# {"deleted":2}
```

### `omk.mjs batch-delete`

Same endpoint as the batch form of `delete`; the CLI only differs in how ids are
collected.

### Operations the CLI does not expose

- Edit a note: `PUT /api/annotations/{id}/notes/{note_id}` with
  `{"body":"..."}` — author and isAgent are preserved.
- Re-anchor: `PUT /api/annotations/{id}/anchor` with `{"anchor":{...}}`.
- Clear a project: `DELETE /api/annotations/project/{project_id}`.
- Revoke a Tool Session: `DELETE /api/auth/tool-sessions/{id}`.
- List Tool Sessions: `GET /api/auth/tool-sessions`.

## Error reference

All errors are JSON `{"error": "<message>"}`. The message may be Chinese; it is
copied verbatim from the server.

| Status | Body | Cause |
|---|---|---|
| 400 | `{"error":"当前未启用登录认证"}` | Auth endpoint called on an open instance |
| 400 | `{"error":"Note body is required"}` | Empty/whitespace note body |
| 400 | `{"error":"Author must be 200 characters or fewer"}` | `author` longer than 200 characters on create or reply |
| 400 | `{"error":"Anchor requires at least one segment"}` | Empty `segments` |
| 400 | `{"error":"Anchor segment kind must be block or text"}` | Bad segment kind |
| 400 | `{"error":"Text segment requires a quote"}` | Text segment without quote |
| 400 | `{"error":"Validation error: Path traversal is not allowed"}` | `relativePath` escapes the project |
| 401 | `{"error":"未登录或登录已过期"}` | Missing/expired cookie or revoked token |
| 401 | `{"error":"用户名或密码错误"}` | Wrong username/password on login or exchange |
| 404 | `{"error":"Not found: Project not found"}` | Unknown `project_id` |
| 404 | `{"error":"Not found: Annotation not found"}` | Unknown annotation id |
| 404 | `{"error":"Not found: Note not found"}` | Unknown note id |
| 404 | `{"error":"Not found: File does not exist"}` | `files/content` or `files/raw` for a missing path |
| 404 | `{"error":"Not found: Tool Session 不存在"}` | Deleting an unknown session id |
| 500 | `{"error":"Internal error: ..."}` | Unexpected server failure |
