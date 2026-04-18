import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const SERVER_SRC = resolve(dirname(__filename), '..', '..', 'src');
const ERROR_CODES_MD = resolve(
  dirname(__filename),
  '..',
  '..',
  '..',
  'specs',
  '007-sync-backend',
  'contracts',
  'error-codes.md',
);

/**
 * Walk `server/src/**` collecting every snake_case string literal that
 * appears as the first argument to `httpError(` or as the value of a `code:`
 * property. The set is then cross-checked against the registry in
 * contracts/error-codes.md.
 */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'generated') continue;
      walk(full, out);
    } else if (entry.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

function extractCodesFromSource(files: string[]): Set<string> {
  const codes = new Set<string>();
  // Only patterns that are definitively error-code sites:
  //  - httpError(<code>, ...)
  //  - new CollectionError(<code>, ...)
  //  - object literal shaped exactly `{ code: '<x>', message:` (the reply
  //    envelope used in plugins/errorHandler.ts).
  const patterns = [
    /httpError\(\s*['"`]([a-z][a-z0-9_]+)['"`]/g,
    /new\s+CollectionError\(\s*['"`]([a-z][a-z0-9_]+)['"`]/g,
    /\{\s*code:\s*['"`]([a-z][a-z0-9_]+)['"`]\s*,\s*message:/g,
  ];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const re of patterns) {
      for (const m of src.matchAll(re)) {
        codes.add(m[1]!);
      }
    }
  }
  return codes;
}

function extractRegisteredCodes(md: string): Set<string> {
  const codes = new Set<string>();
  // Markdown table rows: `| XXX | \`<code>\` | ... |`; we match any backtick-
  // wrapped snake_case token in the file.
  for (const m of md.matchAll(/`([a-z][a-z0-9_]+)`/g)) {
    codes.add(m[1]!);
  }
  return codes;
}

describe('error-codes registry drift', () => {
  it('every HttpError/code literal in server/src/** is registered in error-codes.md', () => {
    const files = walk(SERVER_SRC);
    const used = extractCodesFromSource(files);
    const registered = extractRegisteredCodes(readFileSync(ERROR_CODES_MD, 'utf8'));

    // Known false positives from the regex (common literal keys in code that
    // happen to look snake_case but aren't error codes).
    const ignore = new Set([
      'internal_error', // fallback already registered
    ]);

    const missing: string[] = [];
    for (const code of used) {
      if (ignore.has(code)) continue;
      if (!registered.has(code)) {
        missing.push(code);
      }
    }
    expect(missing, `Unregistered codes: ${missing.join(', ')}`).toEqual([]);
  });
});
