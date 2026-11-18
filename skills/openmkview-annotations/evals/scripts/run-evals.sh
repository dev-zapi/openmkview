#!/usr/bin/env bash
#
# Run the openmkview-annotations eval loop end to end.
#
# What it does:
#   1. Boots a scratch open-mode instance against evals/fixture/.
#   2. Runs three realistic prompts twice — once "with the skill" (the CLI
#      commands SKILL.md teaches) and once "without" (raw HTTP + a naive,
#      hand-crafted Anchor; evals/scripts/baseline-raw.mjs).
#   3. Checks quantitative assertions and writes skill-creator-shaped
#      grading.json files under evals/results/iteration-1/.
#   4. Runs an auth-mode smoke for the init-first flow and 401 handling.
#
# Usage:
#   evals/scripts/run-evals.sh [RESULTS_DIR]
#
# Default RESULTS_DIR: evals/results/iteration-1
# Requires: bash, curl, node >= 18, and a built binary (cargo build).
# /tmp is deliberately avoided.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPO_ROOT="$(cd "$SKILL_DIR/../.." && pwd)"
OMK="$SKILL_DIR/scripts/omk.mjs"
BOOT="$SCRIPT_DIR/boot-fixture.sh"
STOP="$SCRIPT_DIR/stop-fixture.sh"
ASSERT="$SCRIPT_DIR/assert.mjs"
SUMMARIZE="$SCRIPT_DIR/summarize-list.mjs"
VERIFY="$SCRIPT_DIR/verify-anchor.mjs"
BASELINE="$SCRIPT_DIR/baseline-raw.mjs"
RESULTS="${1:-$SKILL_DIR/evals/results/iteration-1}"

if [[ ! -x "${OPENMKVIEW_BIN:-$REPO_ROOT/target/debug/openmkview}" ]]; then
  echo "FAIL: build the binary first: cargo build" >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "FAIL: node is required" >&2
  exit 1
fi

# Clear generated artifacts but keep hand-written review notes in the same dir.
rm -rf "$RESULTS"/eval-* "$RESULTS"/smoke-* "$RESULTS"/benchmark.json "$RESULTS"/benchmark.md
mkdir -p "$RESULTS"
OPEN_ROOT=""
AUTH_ROOT=""
cleanup() {
  local status=$?
  [[ -n "$OPEN_ROOT" ]] && "$STOP" "$OPEN_ROOT" >/dev/null 2>&1 || true
  [[ -n "$AUTH_ROOT" ]] && "$STOP" "$AUTH_ROOT" >/dev/null 2>&1 || true
  if [[ $status -ne 0 ]]; then
    echo "eval harness failed (exit $status); results kept in $RESULTS" >&2
  fi
  exit "$status"
}
trap cleanup EXIT

PASS_COUNT=0
FAIL_COUNT=0
EXPECTED_COUNT=0
pass() { PASS_COUNT=$((PASS_COUNT + 1)); echo "  ok $PASS_COUNT: $1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); echo "  FAIL: $1" >&2; }
# A baseline is allowed to fail the assertions that measure the skill's
# contribution (anchor fidelity). Record it, but do not fail the harness.
expected_fail() { EXPECTED_COUNT=$((EXPECTED_COUNT + 1)); echo "  expected fail: $1"; }

# jsonq/jget <file> <JS expression over `d`>
# The expression is a literal defined in this script (never user input), so
# eval keeps the assertions terse without adding a jq dependency.
jget() {
  node -e 'const fs=require("node:fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const v=eval(process.argv[2]);process.stdout.write(typeof v==="string"?v:JSON.stringify(v));' "$1" "$2"
}

is_json_array() {
  node -e 'const fs=require("node:fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!Array.isArray(d))process.exit(1);' "$1" >/dev/null 2>&1
}

grade() {
  # grade <run-dir> <true|false> <assertion> <evidence>
  node "$ASSERT" "$1/grading.json" "$2" "$3" "$4" >/dev/null
}

reset_annotations() {
  curl -sf -X DELETE "$OPENMKVIEW_URL/api/annotations/project/$PROJECT_ID" >/dev/null
}

# Seeds are shared setup (a human using the web UI would have written these);
# the runs under test only read or write what their prompt asks for.
seed_human_feedback() {
  local out=$1
  node "$OMK" create --file "$EVAL_ROOT/docs/README.md" \
    --quote "Install the dependencies" \
    --body "Please mention that Node 18 or newer is required before installing." \
    --author alice --human > "$out/seed-1.json"
  node "$OMK" create --file "$EVAL_ROOT/docs/README.md" \
    --quote "fox jumps" \
    --body "Replace this placeholder sentence with a real-world example." \
    --author alice --human > "$out/seed-2.json"
}

seed_resolve_fixture() {
  local out=$1
  node "$OMK" create --file "$EVAL_ROOT/docs/README.md" \
    --quote "npm run dev" --body "Agent note A." --author claude > "$out/seed-a.json"
  node "$OMK" create --file "$EVAL_ROOT/docs/guide.md" \
    --quote "never inside it" --body "Agent note B." --author claude > "$out/seed-b.json"
  node "$OMK" create --file "$EVAL_ROOT/docs/README.md" \
    --quote "Install the dependencies" --body "Human note." --author alice --human > "$out/seed-human.json"
}

echo "== booting open-mode fixture =="
BOOT_OUT="$("$BOOT" open)"
echo "$BOOT_OUT" | sed 's/^/  /'
OPEN_ROOT="$(echo "$BOOT_OUT" | sed -n 's/^root=//p')"
# shellcheck disable=SC1090
source "$OPEN_ROOT/env.sh"
PROJECT_ID="$OPENMKVIEW_EVAL_PROJECT_ID"

# --------------------------------------------------------------------------
# Eval 1 — read human feedback
# --------------------------------------------------------------------------
echo "== eval 1: read feedback on README.md =="
E1="$RESULTS/eval-1-read-feedback"
for run in with_skill without_skill; do mkdir -p "$E1/$run/outputs"; done

reset_annotations
seed_human_feedback "$E1/with_skill/outputs"
SEED1="$(jget "$E1/with_skill/outputs/seed-1.json" 'd.id')"
SEED2="$(jget "$E1/with_skill/outputs/seed-2.json" 'd.id')"
node "$OMK" list --file "$EVAL_ROOT/docs/README.md" > "$E1/with_skill/outputs/list.json"
node "$SUMMARIZE" "$E1/with_skill/outputs/list.json" "$E1/with_skill/outputs/answer.md" "Feedback on README.md" >/dev/null

if is_json_array "$E1/with_skill/outputs/list.json"; then
  grade "$E1/with_skill" true "With skill: list output parses as a JSON array" "node JSON.parse -> array"
  pass "eval1 with-skill list parses"
else
  grade "$E1/with_skill" false "With skill: list output parses as a JSON array" "JSON.parse failed or not an array"
  fail "eval1 with-skill list parse"
fi

if node -e 'const fs=require("node:fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const ids=new Set(d.map(x=>x.id));process.exit(ids.has(Number(process.argv[2]))&&ids.has(Number(process.argv[3]))?0:1)' "$E1/with_skill/outputs/list.json" "$SEED1" "$SEED2"; then
  grade "$E1/with_skill" true "With skill: both seeded human annotations are returned" "ids $SEED1 and $SEED2 present"
  pass "eval1 with-skill finds both seeds"
else
  grade "$E1/with_skill" false "With skill: both seeded human annotations are returned" "ids $SEED1/$SEED2 missing"
  fail "eval1 with-skill seeds"
fi

if node -e 'const fs=require("node:fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.exit(d.length>0&&d.every(a=>a.notes.length>0&&a.notes.every(n=>n.author==="alice"&&n.isAgent===false))?0:1)' "$E1/with_skill/outputs/list.json"; then
  grade "$E1/with_skill" true "With skill: every note exposes author alice and isAgent false" "42-style author/isAgent fields read back correctly"
  pass "eval1 with-skill authorship"
else
  grade "$E1/with_skill" false "With skill: every note exposes author alice and isAgent false" "author/isAgent mismatch"
  fail "eval1 with-skill authorship"
fi

if grep -q "Node 18" "$E1/with_skill/outputs/answer.md" && grep -qi "placeholder" "$E1/with_skill/outputs/answer.md"; then
  grade "$E1/with_skill" true "With skill: the answer names both requested changes" "answer.md mentions Node 18 and the placeholder sentence"
  pass "eval1 with-skill answer"
else
  grade "$E1/with_skill" false "With skill: the answer names both requested changes" "answer.md missing one request"
  fail "eval1 with-skill answer"
fi

reset_annotations
seed_human_feedback "$E1/without_skill/outputs"
SEED1B="$(jget "$E1/without_skill/outputs/seed-1.json" 'd.id')"
SEED2B="$(jget "$E1/without_skill/outputs/seed-2.json" 'd.id')"
curl -sf "$OPENMKVIEW_URL/api/annotations?project_id=$PROJECT_ID&relativePath=README.md" > "$E1/without_skill/outputs/list.json"
node "$SUMMARIZE" "$E1/without_skill/outputs/list.json" "$E1/without_skill/outputs/answer.md" "Feedback on README.md" >/dev/null

if is_json_array "$E1/without_skill/outputs/list.json"; then
  grade "$E1/without_skill" true "Baseline: list output parses as a JSON array" "node JSON.parse -> array"
  pass "eval1 baseline list parses"
else
  grade "$E1/without_skill" false "Baseline: list output parses as a JSON array" "JSON.parse failed or not an array"
  fail "eval1 baseline list parse"
fi
if node -e 'const fs=require("node:fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const ids=new Set(d.map(x=>x.id));process.exit(ids.has(Number(process.argv[2]))&&ids.has(Number(process.argv[3]))?0:1)' "$E1/without_skill/outputs/list.json" "$SEED1B" "$SEED2B"; then
  grade "$E1/without_skill" true "Baseline: both seeded human annotations are returned" "ids $SEED1B and $SEED2B present"
  pass "eval1 baseline finds both seeds"
else
  grade "$E1/without_skill" false "Baseline: both seeded human annotations are returned" "ids missing"
  fail "eval1 baseline seeds"
fi
if node -e 'const fs=require("node:fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.exit(d.length>0&&d.every(a=>a.notes.length>0&&a.notes.every(n=>n.author==="alice"&&n.isAgent===false))?0:1)' "$E1/without_skill/outputs/list.json"; then
  grade "$E1/without_skill" true "Baseline: every note exposes author alice and isAgent false" "author/isAgent fields read back correctly"
  pass "eval1 baseline authorship"
else
  grade "$E1/without_skill" false "Baseline: every note exposes author alice and isAgent false" "author/isAgent mismatch"
  fail "eval1 baseline authorship"
fi
if grep -q "Node 18" "$E1/without_skill/outputs/answer.md" && grep -qi "placeholder" "$E1/without_skill/outputs/answer.md"; then
  grade "$E1/without_skill" true "Baseline: the answer names both requested changes" "answer.md mentions Node 18 and the placeholder sentence"
  pass "eval1 baseline answer"
else
  grade "$E1/without_skill" false "Baseline: the answer names both requested changes" "answer.md missing one request"
  fail "eval1 baseline answer"
fi

# --------------------------------------------------------------------------
# Eval 2 — create an annotation from a quote
# --------------------------------------------------------------------------
echo "== eval 2: create an annotation quoting 'fox jumps' =="
E2="$RESULTS/eval-2-create-from-quote"
for run in with_skill without_skill; do mkdir -p "$E2/$run/outputs"; done
QUOTE="fox jumps"
BODY="Explain what the fox represents; this is a placeholder."

reset_annotations
node "$OMK" create --file "$EVAL_ROOT/docs/README.md" --quote "$QUOTE" \
  --body "$BODY" --author claude > "$E2/with_skill/outputs/create.json"
ID="$(jget "$E2/with_skill/outputs/create.json" 'd.id')"
VERIFY_STATUS=0
node "$VERIFY" --url "$OPENMKVIEW_URL" --project-id "$PROJECT_ID" \
  --relative-path README.md --annotation-id "$ID" --quote "$QUOTE" \
  > "$E2/with_skill/outputs/verify-anchor.json" 2> "$E2/with_skill/outputs/verify-anchor.err" || VERIFY_STATUS=$?

if jget "$E2/with_skill/outputs/create.json" 'Number.isInteger(d.id)' | grep -q true; then
  grade "$E2/with_skill" true "With skill: create response parses as JSON with an annotation id" "id=$ID"
  pass "eval2 with-skill create id"
else
  grade "$E2/with_skill" false "With skill: create response parses as JSON with an annotation id" "no id"
  fail "eval2 with-skill create id"
fi
if [[ "$(jget "$E2/with_skill/outputs/create.json" 'd.notes[0].author')" == "claude" && "$(jget "$E2/with_skill/outputs/create.json" 'd.notes[0].isAgent')" == "true" ]]; then
  grade "$E2/with_skill" true "With skill: created note carries author claude and isAgent true" "author=claude isAgent=true"
  pass "eval2 with-skill authorship"
else
  grade "$E2/with_skill" false "With skill: created note carries author claude and isAgent true" "author/isAgent wrong"
  fail "eval2 with-skill authorship"
fi
if [[ "$(jget "$E2/with_skill/outputs/create.json" 'd.anchor.segments.some(s=>s.kind==="text"&&s.quote==="fox jumps")')" == "true" ]]; then
  grade "$E2/with_skill" true "With skill: stored anchor quotes the requested span" 'text segment quote="fox jumps"'
  pass "eval2 with-skill quote"
else
  grade "$E2/with_skill" false "With skill: stored anchor quotes the requested span" "quote missing"
  fail "eval2 with-skill quote"
fi
if [[ "$VERIFY_STATUS" -eq 0 && "$(jget "$E2/with_skill/outputs/verify-anchor.json" 'd.storedMatchesCliBuilder')" == "true" ]]; then
  grade "$E2/with_skill" true "With skill: CLI-computed anchor is Active (stored anchor equals the CLI builder on the same content)" "verifier: $(jget "$E2/with_skill/outputs/verify-anchor.json" 'd.verdict'); blockText=$(jget "$E2/with_skill/outputs/verify-anchor.json" 'd.expectedBlockText')"
  pass "eval2 with-skill anchor Active"
else
  grade "$E2/with_skill" false "With skill: CLI-computed anchor is Active (stored anchor equals the CLI builder on the same content)" "verifier exit $VERIFY_STATUS"
  fail "eval2 with-skill anchor Active"
fi
if [[ "$(jget "$E2/with_skill/outputs/verify-anchor.json" 'd.blockTextInProjection')" == "true" && "$(jget "$E2/with_skill/outputs/verify-anchor.json" 'd.expectedBlockText')" == "The quick brownfox jumps overthe lazy dog." ]]; then
  grade "$E2/with_skill" true "With skill: hard-wrapped prose projects to rendered text (soft breaks concatenate)" "blockText='The quick brownfox jumps overthe lazy dog.'"
  pass "eval2 with-skill projection"
else
  grade "$E2/with_skill" false "With skill: hard-wrapped prose projects to rendered text (soft breaks concatenate)" "projection mismatch"
  fail "eval2 with-skill projection"
fi

# The verifier above proves stored == CLI builder. The frontend suite proves
# that builder resolves Active through the real Preview resolver seam.
SEAM_STATUS=0
( cd "$REPO_ROOT/frontend" && npx vitest run src/test/skills/omkCli.test.ts ) \
  > "$E2/with_skill/outputs/resolver-seam.txt" 2>&1 || SEAM_STATUS=$?
# Keep committed logs free of machine-specific absolute paths.
node -e 'const fs=require("node:fs");const p=process.argv[1];const root=process.argv[2];fs.writeFileSync(p,fs.readFileSync(p,"utf8").split(root).join("<repo>"));' \
  "$E2/with_skill/outputs/resolver-seam.txt" "$REPO_ROOT"
if [[ "$SEAM_STATUS" -eq 0 ]]; then
  grade "$E2/with_skill" true "With skill: the frontend resolver seam resolves CLI-built anchors as Active" "vitest src/test/skills/omkCli.test.ts passed"
  pass "eval2 with-skill resolver seam"
else
  grade "$E2/with_skill" false "With skill: the frontend resolver seam resolves CLI-built anchors as Active" "vitest exited $SEAM_STATUS"
  fail "eval2 with-skill resolver seam"
fi

reset_annotations
node "$BASELINE" create --url "$OPENMKVIEW_URL" --project-id "$PROJECT_ID" \
  --relative-path README.md --quote "$QUOTE" --body "$BODY" --author claude \
  > "$E2/without_skill/outputs/create.json"
IDB="$(jget "$E2/without_skill/outputs/create.json" 'd.id')"
VERIFY_STATUS_B=0
node "$VERIFY" --url "$OPENMKVIEW_URL" --project-id "$PROJECT_ID" \
  --relative-path README.md --annotation-id "$IDB" --quote "$QUOTE" \
  > "$E2/without_skill/outputs/verify-anchor.json" 2> "$E2/without_skill/outputs/verify-anchor.err" || VERIFY_STATUS_B=$?

if jget "$E2/without_skill/outputs/create.json" 'Number.isInteger(d.id)' | grep -q true; then
  grade "$E2/without_skill" true "Baseline: create response parses as JSON with an annotation id" "id=$IDB"
  pass "eval2 baseline create id"
else
  grade "$E2/without_skill" false "Baseline: create response parses as JSON with an annotation id" "no id"
  fail "eval2 baseline create id"
fi
if [[ "$(jget "$E2/without_skill/outputs/create.json" 'd.notes[0].author')" == "claude" && "$(jget "$E2/without_skill/outputs/create.json" 'd.notes[0].isAgent')" == "true" ]]; then
  grade "$E2/without_skill" true "Baseline: created note carries author claude and isAgent true" "author=claude isAgent=true"
  pass "eval2 baseline authorship"
else
  grade "$E2/without_skill" false "Baseline: created note carries author claude and isAgent true" "author/isAgent wrong"
  fail "eval2 baseline authorship"
fi
if [[ "$(jget "$E2/without_skill/outputs/create.json" 'd.anchor.segments.some(s=>s.kind==="text"&&s.quote==="fox jumps")')" == "true" ]]; then
  grade "$E2/without_skill" true "Baseline: stored anchor quotes the requested span" 'text segment quote="fox jumps"'
  pass "eval2 baseline quote"
else
  grade "$E2/without_skill" false "Baseline: stored anchor quotes the requested span" "quote missing"
  fail "eval2 baseline quote"
fi
if [[ "$VERIFY_STATUS_B" -eq 0 && "$(jget "$E2/without_skill/outputs/verify-anchor.json" 'd.storedMatchesCliBuilder')" == "true" ]]; then
  grade "$E2/without_skill" true "Baseline: hand-crafted anchor is Active" "verifier: Active"
  pass "eval2 baseline anchor Active"
else
  grade "$E2/without_skill" false "Baseline: hand-crafted anchor is Active" "verifier: $(jget "$E2/without_skill/outputs/verify-anchor.json" 'd.verdict'); storedBlockText=$(jget "$E2/without_skill/outputs/verify-anchor.json" 'd.storedBlockTexts[0]')"
  expected_fail "eval2 baseline anchor Outdated"
fi
if [[ "$(jget "$E2/without_skill/outputs/verify-anchor.json" 'd.blockTextInProjection')" == "true" ]]; then
  grade "$E2/without_skill" true "Baseline: stored blockText is a projected rendered block" "blockTextInProjection=true"
  pass "eval2 baseline projection"
else
  grade "$E2/without_skill" false "Baseline: stored blockText is a projected rendered block" "storedBlockText=$(jget "$E2/without_skill/outputs/verify-anchor.json" 'd.storedBlockTexts[0]') is a raw source line"
  expected_fail "eval2 baseline projection"
fi

# --------------------------------------------------------------------------
# Eval 3 — resolve all annotations from author claude
# --------------------------------------------------------------------------
echo "== eval 3: resolve all claude annotations =="
E3="$RESULTS/eval-3-resolve-author"
for run in with_skill without_skill; do mkdir -p "$E3/$run/outputs"; done

reset_annotations
seed_resolve_fixture "$E3/with_skill/outputs"
node "$OMK" list --project "$PROJECT_ID" --author claude --unresolved > "$E3/with_skill/outputs/before.json"
BEFORE_COUNT="$(jget "$E3/with_skill/outputs/before.json" 'd.length')"
CLAUDE_IDS="$(jget "$E3/with_skill/outputs/before.json" 'd.map(x=>x.id)')"
read -r -a ID_ARRAY <<< "$(node -e 'const fs=require("node:fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(d.map(x=>x.id).join(" "))' "$E3/with_skill/outputs/before.json")"
node "$OMK" batch-resolve "${ID_ARRAY[@]}" --project "$PROJECT_ID" > "$E3/with_skill/outputs/resolve.json"
node "$OMK" list --project "$PROJECT_ID" --author claude --unresolved > "$E3/with_skill/outputs/after.json"
node "$OMK" list --project "$PROJECT_ID" --author alice --unresolved > "$E3/with_skill/outputs/human.json"

if node -e 'const fs=require("node:fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.exit(d.length>=2&&d.every(a=>a.notes.some(n=>n.author==="claude"))?0:1)' "$E3/with_skill/outputs/before.json"; then
  grade "$E3/with_skill" true "With skill: author filter returns only threads containing a claude note" "before=$BEFORE_COUNT claude annotations"
  pass "eval3 with-skill filter"
else
  grade "$E3/with_skill" false "With skill: author filter returns only threads containing a claude note" "filter mismatch"
  fail "eval3 with-skill filter"
fi
if [[ "$(jget "$E3/with_skill/outputs/resolve.json" 'd.updated')" == "$BEFORE_COUNT" ]]; then
  grade "$E3/with_skill" true "With skill: batch resolve updates exactly the claude annotations" "updated=$BEFORE_COUNT"
  pass "eval3 with-skill batch resolve"
else
  grade "$E3/with_skill" false "With skill: batch resolve updates exactly the claude annotations" "updated != $BEFORE_COUNT"
  fail "eval3 with-skill batch resolve"
fi
if [[ "$(jget "$E3/with_skill/outputs/after.json" 'd.length')" == "0" ]]; then
  grade "$E3/with_skill" true "With skill: no unresolved claude annotations remain" "after=[]"
  pass "eval3 with-skill after"
else
  grade "$E3/with_skill" false "With skill: no unresolved claude annotations remain" "after is not empty"
  fail "eval3 with-skill after"
fi
if node -e 'const fs=require("node:fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.exit(d.length>=1&&d.every(a=>!a.resolved)?0:1)' "$E3/with_skill/outputs/human.json"; then
  grade "$E3/with_skill" true "With skill: annotations from other authors stay unresolved" "alice thread untouched"
  pass "eval3 with-skill human untouched"
else
  grade "$E3/with_skill" false "With skill: annotations from other authors stay unresolved" "alice thread resolved or missing"
  fail "eval3 with-skill human untouched"
fi

reset_annotations
seed_resolve_fixture "$E3/without_skill/outputs"
curl -sf "$OPENMKVIEW_URL/api/annotations/manage?project_id=$PROJECT_ID&author=claude" > "$E3/without_skill/outputs/before-all.json"
node -e 'const fs=require("node:fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).filter(x=>!x.resolved);fs.writeFileSync(process.argv[2],JSON.stringify(d,null,2));' "$E3/without_skill/outputs/before-all.json" "$E3/without_skill/outputs/before.json"
BEFORE_COUNT_B="$(jget "$E3/without_skill/outputs/before.json" 'd.length')"
node "$BASELINE" resolve --url "$OPENMKVIEW_URL" --project-id "$PROJECT_ID" --author claude > "$E3/without_skill/outputs/resolve.json"
curl -sf "$OPENMKVIEW_URL/api/annotations/manage?project_id=$PROJECT_ID&author=claude" > "$E3/without_skill/outputs/after-all.json"
node -e 'const fs=require("node:fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).filter(x=>!x.resolved);fs.writeFileSync(process.argv[2],JSON.stringify(d,null,2));' "$E3/without_skill/outputs/after-all.json" "$E3/without_skill/outputs/after.json"
curl -sf "$OPENMKVIEW_URL/api/annotations/manage?project_id=$PROJECT_ID&author=alice" > "$E3/without_skill/outputs/human-all.json"
node -e 'const fs=require("node:fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).filter(x=>!x.resolved);fs.writeFileSync(process.argv[2],JSON.stringify(d,null,2));' "$E3/without_skill/outputs/human-all.json" "$E3/without_skill/outputs/human.json"

if node -e 'const fs=require("node:fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.exit(d.length>=2&&d.every(a=>a.notes.some(n=>n.author==="claude"))?0:1)' "$E3/without_skill/outputs/before.json"; then
  grade "$E3/without_skill" true "Baseline: author filter returns only threads containing a claude note" "before=$BEFORE_COUNT_B claude annotations"
  pass "eval3 baseline filter"
else
  grade "$E3/without_skill" false "Baseline: author filter returns only threads containing a claude note" "filter mismatch"
  fail "eval3 baseline filter"
fi
if [[ "$(jget "$E3/without_skill/outputs/resolve.json" 'd.updated')" == "$BEFORE_COUNT_B" ]]; then
  grade "$E3/without_skill" true "Baseline: resolve updates exactly the claude annotations" "updated=$BEFORE_COUNT_B"
  pass "eval3 baseline resolve"
else
  grade "$E3/without_skill" false "Baseline: resolve updates exactly the claude annotations" "updated != $BEFORE_COUNT_B"
  fail "eval3 baseline resolve"
fi
if [[ "$(jget "$E3/without_skill/outputs/after.json" 'd.length')" == "0" ]]; then
  grade "$E3/without_skill" true "Baseline: no unresolved claude annotations remain" "after=[]"
  pass "eval3 baseline after"
else
  grade "$E3/without_skill" false "Baseline: no unresolved claude annotations remain" "after is not empty"
  fail "eval3 baseline after"
fi
if node -e 'const fs=require("node:fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.exit(d.length>=1&&d.every(a=>!a.resolved)?0:1)' "$E3/without_skill/outputs/human.json"; then
  grade "$E3/without_skill" true "Baseline: annotations from other authors stay unresolved" "alice thread untouched"
  pass "eval3 baseline human untouched"
else
  grade "$E3/without_skill" false "Baseline: annotations from other authors stay unresolved" "alice thread resolved or missing"
  fail "eval3 baseline human untouched"
fi

# --------------------------------------------------------------------------
# Auth smoke — init-first flow, bearer auth, revocation, 401 hint
# --------------------------------------------------------------------------
echo "== smoke: auth-mode init-first flow =="
SMOKE="$RESULTS/smoke-auth"
mkdir -p "$SMOKE/outputs"
AUTH_BOOT="$("$BOOT" auth)"
echo "$AUTH_BOOT" | sed 's/^/  /'
AUTH_ROOT="$(echo "$AUTH_BOOT" | sed -n 's/^root=//p')"
# shellcheck disable=SC1090
source "$AUTH_ROOT/env.sh"

OPENMKVIEW_USERNAME="$OPENMKVIEW_EVAL_USERNAME" OPENMKVIEW_PASSWORD="$OPENMKVIEW_EVAL_PASSWORD" \
  node "$OMK" init --url "$OPENMKVIEW_URL" --label "eval-auth" > "$SMOKE/outputs/init.json"
if [[ "$(jget "$SMOKE/outputs/init.json" 'd.authRequired')" == "true" && "$(jget "$SMOKE/outputs/init.json" 'd.tokenSaved')" == "true" ]]; then
  grade "$SMOKE" true "Auth: init exchanges credentials once and saves a token" "authRequired=true tokenSaved=true"
  pass "smoke init"
else
  grade "$SMOKE" false "Auth: init exchanges credentials once and saves a token" "init output wrong"
  fail "smoke init"
fi
TOKEN="$(jget "$OPENMKVIEW_AGENT_CONFIG" 'd.token')"
if [[ -n "$TOKEN" && "$TOKEN" != "null" && "$(stat -c '%a' "$OPENMKVIEW_AGENT_CONFIG")" == "600" ]]; then
  grade "$SMOKE" true "Auth: agent config is mode 0600 and holds a bearer token" "token present, mode 600"
  pass "smoke config"
else
  grade "$SMOKE" false "Auth: agent config is mode 0600 and holds a bearer token" "missing token or wrong mode"
  fail "smoke config"
fi
node "$OMK" list --file "$AUTH_ROOT/docs/README.md" > "$SMOKE/outputs/list-after-init.json"
if [[ "$(jget "$SMOKE/outputs/list-after-init.json" 'd.length')" == "0" ]]; then
  grade "$SMOKE" true "Auth: the CLI reads the API with the Bearer token" "list returned []"
  pass "smoke bearer read"
else
  grade "$SMOKE" false "Auth: the CLI reads the API with the Bearer token" "list failed"
  fail "smoke bearer read"
fi
curl -sf -H "Authorization: Bearer $TOKEN" "$OPENMKVIEW_URL/api/auth/tool-sessions" > "$SMOKE/outputs/sessions.json"
SESSION_ID="$(node -e 'const fs=require("node:fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const s=d.find(x=>x.label==="eval-auth");if(!s)process.exit(1);process.stdout.write(String(s.id));' "$SMOKE/outputs/sessions.json")"
curl -sf -X DELETE -H "Authorization: Bearer $TOKEN" "$OPENMKVIEW_URL/api/auth/tool-sessions/$SESSION_ID" >/dev/null
REVOKED_STATUS=0
node "$OMK" list --file "$AUTH_ROOT/docs/README.md" > "$SMOKE/outputs/revoked-out.json" 2> "$SMOKE/outputs/revoked-err.json" || REVOKED_STATUS=$?
if [[ "$REVOKED_STATUS" -ne 0 ]] && grep -q "Tool Session revoked — run omk.mjs init" "$SMOKE/outputs/revoked-err.json"; then
  grade "$SMOKE" true "Auth: a revoked Tool Session yields the actionable 401 hint" "exit $REVOKED_STATUS, hint printed"
  pass "smoke revoked hint"
else
  grade "$SMOKE" false "Auth: a revoked Tool Session yields the actionable 401 hint" "exit $REVOKED_STATUS, hint missing"
  fail "smoke revoked hint"
fi
UNAUTH_BODY="$(curl -s "$OPENMKVIEW_URL/api/annotations?project_id=1&relativePath=README.md")"
if [[ "$UNAUTH_BODY" == *"未登录或登录已过期"* ]]; then
  grade "$SMOKE" true "Auth: unauthenticated API requests return the Chinese 401 body" "$UNAUTH_BODY"
  pass "smoke 401 body"
else
  grade "$SMOKE" false "Auth: unauthenticated API requests return the Chinese 401 body" "$UNAUTH_BODY"
  fail "smoke 401 body"
fi
OPENMKVIEW_USERNAME="$OPENMKVIEW_EVAL_USERNAME" OPENMKVIEW_PASSWORD="$OPENMKVIEW_EVAL_PASSWORD" \
  node "$OMK" login --label "eval-auth-relogin" > "$SMOKE/outputs/login.json"
node "$OMK" list --file "$AUTH_ROOT/docs/README.md" > "$SMOKE/outputs/list-after-login.json"
if [[ "$(jget "$SMOKE/outputs/list-after-login.json" 'Array.isArray(d)')" == "true" ]]; then
  grade "$SMOKE" true "Auth: login re-exchanges and restores access" "list works after login"
  pass "smoke relogin"
else
  grade "$SMOKE" false "Auth: login re-exchanges and restores access" "list failed after login"
  fail "smoke relogin"
fi

# --------------------------------------------------------------------------
# Summary
# --------------------------------------------------------------------------
echo
echo "== writing benchmark summary =="
node "$SCRIPT_DIR/summarize-benchmark.mjs" "$RESULTS" >/dev/null

TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo
echo "RESULT: $PASS_COUNT/$TOTAL harness assertions passed ($FAIL_COUNT failed, $EXPECTED_COUNT expected baseline failures)"
echo "Results: $RESULTS"
if [[ "$FAIL_COUNT" -ne 0 ]]; then
  exit 1
fi
