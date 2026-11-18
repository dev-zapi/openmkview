#!/usr/bin/env bash
#
# Repeatable end-to-end smoke for skills/openmkview-annotations/scripts/omk.mjs.
#
# Starts two scratch OpenMKView instances (open and auth-enabled) with
# isolated data/config homes, registers a synthetic project, and drives the
# CLI through init/list/create/reply/resolve/show/delete/batch plus Tool
# Session revocation. Exits non-zero on the first failed assertion.
#
# Requirements: bash, curl, node >= 18, and a built openmkview binary.
#   cargo build
#   skills/openmkview-annotations/scripts/smoke.sh
#
# Environment:
#   OPENMKVIEW_BIN       binary path (default: target/debug/openmkview)
#   OPENMKVIEW_SMOKE_ROOT scratch root (default: ~/.cache/omk-smoke.XXXXXX)
#   OPENMKVIEW_SMOKE_KEEP=1  keep the scratch tree and server logs
#
# /tmp is deliberately avoided (the test machine has a quota there).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
OMK="$SCRIPT_DIR/omk.mjs"
BIN="${OPENMKVIEW_BIN:-$REPO_ROOT/target/debug/openmkview}"

if [[ ! -x "$BIN" ]]; then
  echo "FAIL: openmkview binary not found at $BIN (run: cargo build)" >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "FAIL: node is required" >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "FAIL: curl is required" >&2
  exit 1
fi

SMOKE_ROOT="${OPENMKVIEW_SMOKE_ROOT:-$(mktemp -d "$HOME/.cache/omk-smoke.XXXXXX")}"
mkdir -p "$SMOKE_ROOT"
SERVER_PIDS=()
PASS=0

cleanup() {
  local status=$?
  for pid in "${SERVER_PIDS[@]:-}"; do
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  done
  if [[ "${OPENMKVIEW_SMOKE_KEEP:-0}" == "1" ]]; then
    echo "Kept scratch tree: $SMOKE_ROOT"
  elif [[ $status -eq 0 ]]; then
    rm -rf "$SMOKE_ROOT"
  else
    echo "Scratch tree kept after failure: $SMOKE_ROOT" >&2
  fi
  exit "$status"
}
trap cleanup EXIT

pass() {
  PASS=$((PASS + 1))
  echo "  ok $PASS: $1"
}

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

free_port() {
  node -e 'const net=require("node:net");const s=net.createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close();});'
}

# jsonq <file> <JS expression over `d`>
# The expression is a literal defined in this script (never user input); eval
# keeps the assertions terse without adding a jq dependency.
jsonq() {
  node -e 'const fs=require("node:fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const out=eval(process.argv[2]);process.stdout.write(typeof out==="string"?out:JSON.stringify(out));' "$1" "$2"
}

cli() {
  OPENMKVIEW_AGENT_CONFIG="$AGENT_CONFIG" node "$OMK" "$@"
}

wait_ready() {
  local url=$1
  for _ in $(seq 1 100); do
    if curl -sf "$url/api/auth/status" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.1
  done
  fail "server did not become ready at $url"
}

report_status() {
  local status=$1
  if [[ "$status" -ne 0 ]]; then fail "cli exited $status"; fi
}

write_fixture() {
  local docs=$1
  mkdir -p "$docs"
  cat > "$docs/guide.md" <<'MARKDOWN'
# Guide

The quick brown fox jumps over the lazy dog.

## Setup

Install the dependencies and run the development server.

```bash
npm install openmkview
npm run dev
```

## Repeat

Alpha beta gamma is a repeated sentence.

# Details

Alpha beta gamma is a repeated sentence.
MARKDOWN
}

start_server() {
  local mode=$1 port=$2 data_home=$3 config_home=$4
  local log="$SMOKE_ROOT/server-$mode.log"
  local pid

  if [[ "$mode" == "auth" ]]; then
    OPENMKVIEW_DATA_HOME="$data_home" \
    OPENMKVIEW_CONFIG_HOME="$config_home" \
    OPENMKVIEW_USERNAME=alice \
    OPENMKVIEW_PASSWORD=secret \
      "$BIN" serve --host 127.0.0.1 --port "$port" >"$log" 2>&1 &
  else
    env -u OPENMKVIEW_USERNAME -u OPENMKVIEW_PASSWORD \
      OPENMKVIEW_DATA_HOME="$data_home" \
      OPENMKVIEW_CONFIG_HOME="$config_home" \
      "$BIN" serve --host 127.0.0.1 --port "$port" >"$log" 2>&1 &
  fi

  pid=$!
  SERVER_PIDS+=("$pid")
  wait_ready "http://127.0.0.1:$port"
}

register_project() {
  local mode=$1 url=$2 docs=$3 token=${4:-}
  local args=(-sf -X POST "$url/api/projects" -H 'Content-Type: application/json' -d "{\"path\":\"$docs\"}")
  if [[ -n "$token" ]]; then
    args+=(-H "Authorization: Bearer $token")
  fi
  curl "${args[@]}" >/dev/null || fail "could not register project ($mode)"
}

run_mode() {
  local mode=$1
  local port url
  port=$(free_port)
  url="http://127.0.0.1:$port"

  local mode_root="$SMOKE_ROOT/$mode"
  local docs="$mode_root/docs"
  local data_home="$mode_root/data"
  local config_home="$mode_root/server-config"
  local agent_config="$mode_root/agent.json"
  mkdir -p "$mode_root" "$data_home" "$config_home"
  write_fixture "$docs"

  echo "== $mode instance on $url =="
  start_server "$mode" "$port" "$data_home" "$config_home"

  AGENT_CONFIG="$agent_config"

  if [[ "$mode" == "auth" ]]; then
    local init_json="$mode_root/init.json"
    cli init --url "$url" --username alice --password secret --label "smoke-$mode" >"$init_json"
    [[ "$(jsonq "$init_json" 'd.authRequired')" == "true" ]] || fail "init did not detect auth"
    TOKEN=$(jsonq "$agent_config" 'd.token')
    [[ -n "$TOKEN" && "$TOKEN" != "null" ]] || fail "init did not store a token"
    register_project "$mode" "$url" "$docs" "$TOKEN"
  else
    register_project "$mode" "$url" "$docs"
    local init_json="$mode_root/init.json"
    cli init --url "$url" >"$init_json"
    [[ "$(jsonq "$init_json" 'd.authRequired')" == "false" ]] || fail "open init reported auth"
    [[ "$(jsonq "$agent_config" 'd.token')" == "null" ]] || fail "open config should have a null token"
  fi
  pass "$mode init wrote config"

  # Config contract: 0600, URL + token only, never the password.
  [[ "$(stat -c '%a' "$agent_config")" == "600" ]] || fail "config mode is not 0600"
  [[ "$(jsonq "$agent_config" 'Object.keys(d).sort().join(",")')" == "token,url" ]] \
    || fail "config must hold URL + token only"
  if grep -q '"password"' "$agent_config" || grep -q 'secret' "$agent_config"; then
    fail "config leaked the password"
  fi
  pass "$mode config is 0600 with URL + token only"

  # Empty list.
  local list_json="$mode_root/list-empty.json"
  cli list --file "$docs/guide.md" >"$list_json"
  [[ "$(jsonq "$list_json" 'd.length')" == "0" ]] || fail "expected an empty annotation list"
  pass "$mode list starts empty"

  # Create (agent voice, client-built text anchor).
  local created_json="$mode_root/created.json"
  cli create --file "$docs/guide.md" --quote "development server" \
    --body "Agent note: clarify prerequisites." --author "claude" >"$created_json"
  ANNOTATION_ID=$(jsonq "$created_json" 'd.id')
  [[ "$(jsonq "$created_json" 'd.notes[0].author')" == "claude" ]] || fail "create did not stamp the author"
  [[ "$(jsonq "$created_json" 'd.notes[0].isAgent')" == "true" ]] || fail "create did not stamp isAgent"
  [[ "$(jsonq "$created_json" 'd.anchor.segments[0].kind')" == "text" ]] || fail "expected a text anchor"
  [[ "$(jsonq "$created_json" 'd.anchor.segments[0].quote')" == "development server" ]] || fail "quote mismatch"
  [[ "$(jsonq "$created_json" 'd.anchor.segments[0].blockHash.startsWith("blk-")')" == "true" ]] || fail "bad block hash"
  [[ "$(jsonq "$created_json" 'JSON.stringify(d.anchor.segments[0].headingPath)')" == '["Guide","Setup"]' ]] \
    || fail "heading path mismatch"
  [[ "$(jsonq "$created_json" 'd.anchor.segments[0].prefix.length <= 48 && d.anchor.segments[0].suffix.length <= 48')" == "true" ]] \
    || fail "prefix/suffix exceed 48 characters"
  pass "$mode create built a text anchor with author/isAgent"

  # --human flips isAgent and the default author.
  local human_json="$mode_root/human.json"
  cli create --file "$docs/guide.md" --quote "npm install openmkview" \
    --body "Human reviewer note." --human --author "Jonas" >"$human_json"
  [[ "$(jsonq "$human_json" 'd.notes[0].isAgent')" == "false" ]] || fail "--human did not clear isAgent"
  [[ "$(jsonq "$human_json" 'd.notes[0].author')" == "Jonas" ]] || fail "--human author mismatch"
  pass "$mode --human stamps a human note"

  # Reply.
  local reply_json="$mode_root/reply.json"
  cli reply "$ANNOTATION_ID" --body "Agent reply." --author "claude" >"$reply_json"
  [[ "$(jsonq "$reply_json" 'd.notes[d.notes.length-1].author')" == "claude" ]] || fail "reply author missing"
  [[ "$(jsonq "$reply_json" 'd.notes[d.notes.length-1].isAgent')" == "true" ]] || fail "reply isAgent missing"
  pass "$mode reply stamps author/isAgent"

  # Author filter.
  local filtered_json="$mode_root/filtered.json"
  cli list --file "$docs/guide.md" --author claude >"$filtered_json"
  [[ "$(jsonq "$filtered_json" 'd.every(a => a.notes.some(n => n.author === "claude")) && d.length >= 1')" == "true" ]] \
    || fail "--author filter returned unexpected rows"
  pass "$mode list --author filters"

  # Duplicate blocks remains anchorable.
  local duplicate_json="$mode_root/duplicate.json"
  cli create --file "$docs/guide.md" --quote "Alpha beta gamma" \
    --body "Duplicate-context note." --author "claude" >"$duplicate_json"
  [[ "$(jsonq "$duplicate_json" 'd.anchor.segments[0].kind')" == "text" ]] || fail "duplicate quote anchor kind"
  pass "$mode duplicate-block quote anchors"

  # Resolve / filter / undo.
  local resolved_json="$mode_root/resolved.json"
  cli resolve "$ANNOTATION_ID" >"$resolved_json"
  [[ "$(jsonq "$resolved_json" 'd.resolved')" == "true" ]] || fail "resolve failed"
  cli list --file "$docs/guide.md" --resolved >"$mode_root/resolved-list.json"
  [[ "$(jsonq "$mode_root/resolved-list.json" "d.some(a => a.id === $ANNOTATION_ID)")" == "true" ]] \
    || fail "--resolved filter missed the annotation"
  cli resolve "$ANNOTATION_ID" --undo >"$mode_root/undone.json"
  [[ "$(jsonq "$mode_root/undone.json" 'd.resolved')" == "false" ]] || fail "--undo failed"
  pass "$mode resolve/undo and --resolved filter"

  # Whole-file anchor (no --quote) and deletion.
  local whole_json="$mode_root/whole.json"
  cli create --file "$docs/guide.md" --body "Whole-file note." --author "claude" >"$whole_json"
  WHOLE_ID=$(jsonq "$whole_json" 'd.id')
  [[ "$(jsonq "$whole_json" 'd.anchor.segments.length > 1 && d.anchor.segments.every(s => s.kind === "block")')" == "true" ]] \
    || fail "whole-file anchor should contain block segments"
  cli delete "$WHOLE_ID" >"$mode_root/deleted.json"
  [[ "$(jsonq "$mode_root/deleted.json" "d.deleted.includes($WHOLE_ID)")" == "true" ]] || fail "delete failed"
  pass "$mode whole-file anchor + delete"

  # show finds the row through a list endpoint.
  local show_json="$mode_root/show.json"
  cli show "$ANNOTATION_ID" >"$show_json"
  [[ "$(jsonq "$show_json" "d.id === $ANNOTATION_ID")" == "true" ]] || fail "show returned the wrong row"
  pass "$mode show"

  if [[ "$mode" == "auth" ]]; then
    # Revoke the Tool Session and require the actionable 401 message.
    local sessions_json="$mode_root/sessions.json"
    curl -sf -H "Authorization: Bearer $TOKEN" "$url/api/auth/tool-sessions" >"$sessions_json"
    local session_id
    session_id=$(node -e 'const fs=require("node:fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const s=d.find(x=>x.label==="smoke-auth");if(!s)process.exit(1);process.stdout.write(String(s.id));' "$sessions_json")
    curl -sf -X DELETE -H "Authorization: Bearer $TOKEN" "$url/api/auth/tool-sessions/$session_id" >/dev/null

    local revoked_status=0
    set +e
    cli list --file "$docs/guide.md" >"$mode_root/revoked-out.json" 2>"$mode_root/revoked-err.json"
    revoked_status=$?
    set -e
    [[ "$revoked_status" -ne 0 ]] || fail "revoked session still succeeded"
    grep -q "Tool Session revoked — run omk.mjs init" "$mode_root/revoked-err.json" \
      || fail "revoked session did not print the re-init hint"
    pass "$mode revoked session prints the exact 401 hint"

    # login re-exchanges and restores access.
    local login_json="$mode_root/login.json"
    cli login --username alice --password secret --label "smoke-relogin" >"$login_json"
    cli list --file "$docs/guide.md" >"$mode_root/list-after-login.json"
    [[ "$(jsonq "$mode_root/list-after-login.json" 'd.length > 0')" == "true" ]] || fail "login did not restore access"
    pass "$mode login restores a working session"
  fi
}

run_mode open
run_mode auth

echo "PASS: $PASS smoke assertions across open + auth instances"
