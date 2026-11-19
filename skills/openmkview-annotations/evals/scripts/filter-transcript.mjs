#!/usr/bin/env node
/**
 * Turn a `claude -p --output-format stream-json` transcript into a compact,
 * committed transcript: user prompts, assistant text, tool calls, and
 * truncated tool results. Also writes the final answer as Markdown.
 *
 * Usage: filter-transcript.mjs RAW_JSONL OUT_JSONL OUT_FINAL_MD
 * Sanitizes the home directory to <home> so committed evidence stays portable.
 */

import fs from 'node:fs';
import os from 'node:os';
import process from 'node:process';

const [rawPath, outPath, finalPath] = process.argv.slice(2);
if (!rawPath || !outPath || !finalPath) {
  process.stderr.write('usage: filter-transcript.mjs RAW_JSONL OUT_JSONL OUT_FINAL_MD\n');
  process.exit(2);
}

const home = os.homedir();
const sanitize = (value) => String(value ?? '').split(home).join('<home>');
const truncate = (value, limit = 900) => {
  const text = sanitize(value);
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
};

const events = [];
let finalAnswer = '';
const toolNames = new Map();

for (const line of fs.readFileSync(rawPath, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    continue;
  }

  if (entry.type === 'assistant' && entry.message?.content) {
    for (const block of entry.message.content) {
      if (block.type === 'text' && block.text?.trim()) {
        events.push({ type: 'assistant_text', text: sanitize(block.text) });
        finalAnswer = block.text;
      }
      if (block.type === 'tool_use') {
        toolNames.set(block.id, block.name);
        events.push({
          type: 'tool_use',
          name: block.name,
          input:
            block.name === 'Bash'
              ? { command: sanitize(block.input?.command ?? '') }
              : block.input,
        });
      }
    }
  }

  if (entry.type === 'user' && entry.message?.content) {
    for (const block of entry.message.content) {
      if (block.type === 'tool_result') {
        const content =
          typeof block.content === 'string'
            ? block.content
            : Array.isArray(block.content)
              ? block.content.map((part) => part.text ?? '').join('\n')
              : '';
        events.push({
          type: 'tool_result',
          name: toolNames.get(block.tool_use_id) ?? 'unknown',
          is_error: Boolean(block.is_error),
          content: truncate(content),
        });
      }
    }
  }

  if (entry.type === 'result' && typeof entry.result === 'string' && entry.result.trim()) {
    finalAnswer = entry.result;
  }
}

fs.writeFileSync(outPath, events.map((event) => JSON.stringify(event)).join('\n') + '\n');
fs.writeFileSync(
  finalPath,
  `# Final answer\n\n${finalAnswer ? finalAnswer.trim() : '(no final answer captured)'}\n`
);
process.stdout.write(`wrote ${outPath} (${events.length} events) and ${finalPath}\n`);
