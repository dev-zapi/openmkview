# Fresh-session trigger check

Goal (acceptance criterion): the skill triggers in a fresh session from a
natural annotation request, without a manual pointer to the skill.

## Method

1. Booted an open-mode fixture instance with two human annotations on
   `README.md`.
2. Created a temp workspace whose only project state was
   `.claude/skills/openmkview-annotations` symlinked to this skill directory.
3. Ran `claude -p` (Claude Code 2.1.326) in that workspace with this prompt —
   the prompt never names the skill:

   > OpenMKView is running at http://127.0.0.1:39295. I left some review
   > comments on README.md in the fixture project it has registered. Please
   > list the annotations on that README and tell me what the reviewer asked
   > for. Don't change anything yet.

4. Inspected the `--output-format stream-json` transcript for skill discovery
   and CLI invocations.

## What happened

- The session read `.claude/skills/openmkview-annotations/SKILL.md` on its own
  and said "The skill's loaded".
- It followed the init-first flow, attempting:

  ```
  omk.mjs init --url http://127.0.0.1:39295
  omk.mjs list --file README.md
  ```

  (with `OPENMKVIEW_AGENT_CONFIG` and `OPENMKVIEW_URL` set as SKILL.md
  describes).
- When the outer CLI sandbox denied Bash ("Bash is blocked for this session"),
  the session read `references/api.md` and pivoted to the documented HTTP
  endpoints (`/api/auth/status`, `/api/projects`, ...), demonstrating the
  reference fallback.

## Verdict

- **Triggering: PASS.** From a natural request about review comments on
  `README.md`, the fresh session discovered and consulted the skill without
  being told its name, then chose the correct CLI commands and the correct
  init-first order.
- **End-to-end execution in that run: BLOCKED by the test harness.** The
  nested `claude -p` session's Bash tool was disabled by the outer environment
  ("auto-mode safety check unavailable"), so the command could not run. This is
  an artifact of nesting the test, not of the skill.
- Execution is covered by `results/iteration-1/`, which drives the same command
  sequences against real instances and passes 31/31 with-skill/smoke
  assertions.
