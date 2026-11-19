#!/usr/bin/env bash
#
# Agent-run eval layer: execute the eval-1 and eval-2 prompts in a real
# `claude -p` session that has the skill installed in `.claude/skills/`, with
# Bash permitted. Commits the filtered transcripts and grades the agent's
# behavior, including a non-tautological synthesis check for eval 1 and a real
# resolver-status check for the annotation eval 2 creates.
#
# Usage: run-agent-evals.sh [RESULTS_DIR]
# Default RESULTS_DIR: evals/results/iteration-2
#
# Requires: bash, curl, node >= 18, the claude CLI, and a built binary.
# The nested session runs with --permission-mode bypassPermissions in an
# isolated scratch workspace; the coordinator authorized Bash for this check.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPO_ROOT="$(cd "$SKILL_DIR/../.." && pwd)"
OMK="$SKILL_DIR/scripts/omk.mjs"
BOOT="$SCRIPT_DIR/boot-fixture.sh"
STOP="$SCRIPT_DIR/stop-fixture.sh"
ASSERT="$SCRIPT_DIR/assert.mjs"
VERIFY="$SCRIPT_DIR/verify-anchor.mjs"
RESOLVER="$SCRIPT_DIR/resolver-status.mjs"
FILTER="$SCRIPT_DIR/filter-transcript.mjs"
BASE_RESULTS="${1:-$SKILL_DIR/evals/results/iteration-2}"
mkdir -p "$BASE_RESULTS"
RESULTS="$(cd "$BASE_RESULTS" && pwd)/agent-runs"
rm -rf "$RESULTS"
mkdir -p "$RESULTS"

if ! command -v claude >/dev/null 2>&1; then
  echo "FAIL: the claude CLI is required for agent-run evals" >&2
  exit 1
fi
if [[ ! -x "${OPENMKVIEW_BIN:-$REPO_ROOT/target/debug/openmkview}" ]]; then
  echo "FAIL: build the binary first: cargo build" >&2
  exit 1
fi

mkdir -p "$RESULTS"
OPEN_ROOT=""
cleanup() {
  local status=$?
  [[ -n "$OPEN_ROOT" ]] && "$STOP" "$OPEN_ROOT" >/dev/null 2>&1 || true
  if [[ $status -ne 0 ]]; then
    echo "agent-run evals failed (exit $status); results kept in $RESULTS" >&2
  fi
  exit "$status"
}
trap cleanup EXIT

PASS=0
FAIL=0
pass() { PASS=$((PASS + 1)); echo "  ok $PASS: $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  FAIL: $1" >&2; }
grade() { node "$ASSERT" "$1/grading.json" "$2" "$3" "$4" >/dev/null; }
# The expression passed to eval() is a literal defined in this script, never
# user input; this keeps the assertions terse without adding a jq dependency.
jget() {
  node -e 'const fs=require("node:fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const v=eval(process.argv[2]);process.stdout.write(typeof v==="string"?v:JSON.stringify(v));' "$1" "$2"
}
reset_annotations() {
  curl -sf -X DELETE "$OPENMKVIEW_URL/api/annotations/project/$PROJECT_ID" >/dev/null
}

echo "== booting fixture for agent runs =="
BOOT_OUT="$("$BOOT" open)"
echo "$BOOT_OUT" | sed 's/^/  /'
OPEN_ROOT="$(echo "$BOOT_OUT" | sed -n 's/^root=//p')"
OPENMKVIEW_URL="$(echo "$BOOT_OUT" | sed -n 's/^url=//p')"
PROJECT_ID="$(echo "$BOOT_OUT" | sed -n 's/^project_id=//p')"
AGENT_CONFIG="$OPEN_ROOT/agent.json"
export OPENMKVIEW_URL AGENT_CONFIG PROJECT_ID
OPENMKVIEW_AGENT_CONFIG="$AGENT_CONFIG" node "$OMK" init --url "$OPENMKVIEW_URL" >/dev/null

WS="$OPEN_ROOT/agent-workspace"
mkdir -p "$WS/.claude/skills"
ln -sfn "$SKILL_DIR" "$WS/.claude/skills/openmkview-annotations"
cat > "$WS/CLAUDE.md" <<EOF
# Eval workspace

An OpenMKView instance is running at $OPENMKVIEW_URL. The annotation CLI is
configured at $AGENT_CONFIG. The fixture project registered in OpenMKView is
at $OPEN_ROOT/docs; README.md is the file under review.
EOF

run_agent() {
  local prompt=$1 raw=$2
  local status=0
  ( cd "$WS" && \
    OPENMKVIEW_URL="$OPENMKVIEW_URL" OPENMKVIEW_AGENT_CONFIG="$AGENT_CONFIG" \
    claude -p "$prompt" \
      --permission-mode bypassPermissions \
      --allowedTools "Bash" "Read" "Write" \
      --output-format stream-json --verbose --max-turns 20 \
      > "$raw" 2> "$raw.err" ) || status=$?
  echo "$status"
}

# --------------------------------------------------------------------------
# Eval 1 — read feedback (real agent answer)
# --------------------------------------------------------------------------
echo "== agent run: eval 1 =="
E1="$RESULTS/eval-1-read-feedback"
mkdir -p "$E1"
reset_annotations
OPENMKVIEW_AGENT_CONFIG="$AGENT_CONFIG" OPENMKVIEW_URL="$OPENMKVIEW_URL" node "$OMK" create \
  --file "$OPEN_ROOT/docs/README.md" --quote "Install the dependencies" \
  --body "Please mention that Node 18 or newer is required before installing." \
  --author alice --human > "$E1/seed-1.json"
OPENMKVIEW_AGENT_CONFIG="$AGENT_CONFIG" OPENMKVIEW_URL="$OPENMKVIEW_URL" node "$OMK" create \
  --file "$OPEN_ROOT/docs/README.md" --quote "fox jumps" \
  --body "Replace this placeholder sentence with a real-world example." \
  --author alice --human > "$E1/seed-2.json"

PROMPT1="I'm reviewing feedback left on the fixture project's README.md. List the annotations on README.md and tell me what the human wants me to change. Don't change anything yet."
printf '%s\n' "$PROMPT1" > "$E1/prompt.txt"
RAW1="$E1/transcript-raw.jsonl"
STATUS1="$(run_agent "$PROMPT1" "$RAW1")"
node "$FILTER" "$RAW1" "$E1/transcript.jsonl" "$E1/final-answer.md" >/dev/null
rm -f "$RAW1" "$RAW1.err"

if grep -q "omk.mjs" "$E1/transcript.jsonl"; then
  grade "$E1" true "Agent: the installed skill drives the omk.mjs CLI" "transcript mentions omk.mjs"
  pass "agent eval1 skill use"
else
  grade "$E1" false "Agent: the installed skill drives the omk.mjs CLI" "no omk.mjs in transcript"
  fail "agent eval1 skill use"
fi
if grep -q 'omk.mjs list' "$E1/transcript.jsonl"; then
  grade "$E1" true "Agent: lists the annotations through the CLI" "Bash command contains omk.mjs list"
  pass "agent eval1 list"
else
  grade "$E1" false "Agent: lists the annotations through the CLI" "no omk.mjs list command"
  fail "agent eval1 list"
fi
ANSWER="$(cat "$E1/final-answer.md")"
if grep -Eiq "node(.js)? (version )?18|node 18|node\.js 18" <<<"$ANSWER"; then
  grade "$E1" true "Agent answer: names the Node 18 requirement" "answer mentions Node 18"
  pass "agent eval1 node request"
else
  grade "$E1" false "Agent answer: names the Node 18 requirement" "answer does not mention Node 18"
  fail "agent eval1 node request"
fi
if grep -Eiq "placeholder|replace.*(sentence|example)|real-world example" <<<"$ANSWER"; then
  grade "$E1" true "Agent answer: names the placeholder-sentence request" "answer mentions placeholder/replacement"
  pass "agent eval1 placeholder request"
else
  grade "$E1" false "Agent answer: names the placeholder-sentence request" "answer does not mention the placeholder request"
  fail "agent eval1 placeholder request"
fi
BODY1="Please mention that Node 18 or newer is required before installing."
BODY2="Replace this placeholder sentence with a real-world example."
# Non-tautological: remove both seeded bodies and require substantial
# synthesized content (a plan/paraphrase), not just echoed note text.
SYNTH_REMAINDER="$(node -e 'const fs=require("node:fs");const a=fs.readFileSync(process.argv[1],"utf8");const rest=a.split(process.argv[2]).join("").split(process.argv[3]).join("");process.stdout.write(rest.replace(/\s+/g," ").trim());' "$E1/final-answer.md" "$BODY1" "$BODY2")"
if [[ "${#SYNTH_REMAINDER}" -gt 200 ]] && grep -Eiq "want|should|plan|replace|add|prerequisite|thread|section" <<<"$SYNTH_REMAINDER"; then
  grade "$E1" true "Agent answer: synthesizes the requests rather than only echoing the note bodies" "non-echo remainder=${#SYNTH_REMAINDER} chars with a synthesis term"
  pass "agent eval1 synthesis"
else
  grade "$E1" false "Agent answer: synthesizes the requests rather than only echoing the note bodies" "remainder=${#SYNTH_REMAINDER} chars; looks like an echo"
  fail "agent eval1 synthesis"
fi
echo "  agent exit=$STATUS1"

# --------------------------------------------------------------------------
# Eval 2 — create from a quote (real agent action + resolver status)
# --------------------------------------------------------------------------
echo "== agent run: eval 2 =="
E2="$RESULTS/eval-2-create-from-quote"
mkdir -p "$E2"
reset_annotations
PROMPT2="Create an annotation on README.md quoting 'fox jumps' and saying: 'Explain what the fox represents; this is a placeholder.' Use your author name claude."
printf '%s\n' "$PROMPT2" > "$E2/prompt.txt"
RAW2="$E2/transcript-raw.jsonl"
STATUS2="$(run_agent "$PROMPT2" "$RAW2")"
node "$FILTER" "$RAW2" "$E2/transcript.jsonl" "$E2/final-answer.md" >/dev/null
rm -f "$RAW2" "$RAW2.err"

curl -sf "$OPENMKVIEW_URL/api/annotations?project_id=$PROJECT_ID&relativePath=README.md" > "$E2/annotations.json"
AGENT_ANNOTATION_ID="$(node -e '
const fs=require("node:fs");const rows=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const hit=rows.filter(r=>(r.notes??[]).some(n=>n.author==="claude"&&n.isAgent===true)).at(-1);
if(hit) process.stdout.write(String(hit.id));
' "$E2/annotations.json")"

if grep -q 'omk.mjs create' "$E2/transcript.jsonl"; then
  grade "$E2" true "Agent: creates the annotation through the CLI" "Bash command contains omk.mjs create"
  pass "agent eval2 create command"
else
  grade "$E2" false "Agent: creates the annotation through the CLI" "no omk.mjs create command"
  fail "agent eval2 create command"
fi

if [[ -n "$AGENT_ANNOTATION_ID" ]]; then
  node -e '
const fs=require("node:fs");const rows=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const row=rows.find(r=>r.id===Number(process.argv[2]));
fs.writeFileSync(process.argv[3],JSON.stringify(row,null,2));
' "$E2/annotations.json" "$AGENT_ANNOTATION_ID" "$E2/created.json"
  grade "$E2" true "Agent: annotation exists with author claude and isAgent true" "id=$AGENT_ANNOTATION_ID"
  pass "agent eval2 annotation exists"
else
  grade "$E2" false "Agent: annotation exists with author claude and isAgent true" "no claude/isAgent annotation found"
  fail "agent eval2 annotation exists"
fi

if [[ -n "$AGENT_ANNOTATION_ID" ]]; then
  node "$VERIFY" --url "$OPENMKVIEW_URL" --project-id "$PROJECT_ID" \
    --relative-path README.md --annotation-id "$AGENT_ANNOTATION_ID" --quote "fox jumps" \
    > "$E2/verify-anchor.json" 2>/dev/null || true
  node -e '
const fs=require("node:fs");
const markdown=fs.readFileSync(process.argv[1],"utf8");
const created=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const baseline={version:1,segments:[{kind:"block",blockHash:"blk-00000000",blockText:"fox jumps over",blockType:"p",headingPath:["OpenMKView Fixture","Overview"]}]};
fs.writeFileSync(process.argv[3],JSON.stringify([
  {name:"agent_created",markdown,anchor:created.anchor},
  {name:"baseline_control",markdown,anchor:baseline},
],null,2));
' "$OPEN_ROOT/docs/README.md" "$E2/created.json" "$E2/resolver-cases.json"
  node "$RESOLVER" --cases "$E2/resolver-cases.json" --out "$E2/resolver-status.json" >/dev/null
  CREATED_STATUS="$(node -e 'const fs=require("node:fs");const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(r.find(x=>x.name==="agent_created").status);' "$E2/resolver-status.json")"
  CONTROL_STATUS="$(node -e 'const fs=require("node:fs");const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(r.find(x=>x.name==="baseline_control").status);' "$E2/resolver-status.json")"
  if [[ "$CREATED_STATUS" == "resolved" && "$CONTROL_STATUS" == "outdated" ]]; then
    grade "$E2" true "Agent: the created anchor resolves Active through the real resolver (control is Outdated)" "agent=$CREATED_STATUS control=$CONTROL_STATUS"
    pass "agent eval2 resolver status"
  else
    grade "$E2" false "Agent: the created anchor resolves Active through the real resolver (control is Outdated)" "agent=$CREATED_STATUS control=$CONTROL_STATUS"
    fail "agent eval2 resolver status"
  fi
  if [[ "$(jget "$E2/created.json" '(d.notes??[]).some(n=>n.author==="claude"&&n.isAgent===true)')" == "true" &&
        "$(jget "$E2/created.json" '(d.notes??[]).some(n=>/fox represents/i.test(n.body))')" == "true" ]]; then
    grade "$E2" true "Agent: the note body carries the requested review request" "body mentions the fox placeholder"
    pass "agent eval2 body"
  else
    grade "$E2" false "Agent: the note body carries the requested review request" "body missing or authorship wrong"
    fail "agent eval2 body"
  fi
fi
echo "  agent exit=$STATUS2"

echo
echo "RESULT: agent runs $PASS passed, $FAIL failed"
if [[ "$FAIL" -ne 0 ]]; then
  exit 1
fi
