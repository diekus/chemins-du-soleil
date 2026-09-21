#!/usr/bin/env node
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── ANSI colours ─────────────────────────────────────────────────────────────
const G = '\x1b[32m'; // green
const R = '\x1b[31m'; // red
const B = '\x1b[1m';  // bold
const D = '\x1b[2m';  // dim
const X = '\x1b[0m';  // reset

const LOCALES = ['en', 'fr', 'es', 'it'];
const BASE_LOCALE = 'en';
const verbose = process.argv.includes('--verbose');

let totalErrors = 0;

function pass(msg) {
  if (verbose) process.stdout.write(`  ${G}✓${X} ${D}${msg}${X}\n`);
}

function fail(msg) {
  totalErrors++;
  process.stderr.write(`  ${R}✗${X} ${msg}\n`);
}

function section(title) {
  process.stdout.write(`\n${B}${title}${X}\n`);
}

// ── Load dictionaries ────────────────────────────────────────────────────────
const dictionaries = {};

for (const locale of LOCALES) {
  const path = resolve(__dirname, '..', 'locale', `${locale}.json`);
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (e) {
    process.stderr.write(`${R}✗ Cannot read ${path}: ${e.message}${X}\n`);
    process.exit(1);
  }
  try {
    dictionaries[locale] = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`${R}✗ Invalid JSON in ${path}: ${e.message}${X}\n`);
    process.exit(1);
  }
}

const baseDict = dictionaries[BASE_LOCALE];
const baseKeys = new Set(Object.keys(baseDict));

// ── Check 1: Key-set parity — every locale has exactly the base locale's keys ─
section(`1  Key-set parity against "${BASE_LOCALE}"`);

for (const locale of LOCALES) {
  if (locale === BASE_LOCALE) continue;
  const dict = dictionaries[locale];
  const keys = new Set(Object.keys(dict));

  const missing = [...baseKeys].filter(k => !keys.has(k));
  const orphaned = [...keys].filter(k => !baseKeys.has(k));

  for (const key of missing)  fail(`"${locale}.json": missing key "${key}" (present in ${BASE_LOCALE}.json)`);
  for (const key of orphaned) fail(`"${locale}.json": orphaned key "${key}" (not present in ${BASE_LOCALE}.json)`);

  if (missing.length === 0 && orphaned.length === 0) {
    process.stdout.write(`  ${G}✓${X} "${locale}.json" has exactly the same ${keys.size} keys as "${BASE_LOCALE}.json"\n`);
  }
  pass(`"${locale}.json": ${keys.size} keys checked`);
}

// ── Check 2: Placeholder parity — every {token} in the base string also
// appears in every other locale's string for that key ───────────────────────
section('2  Placeholder parity');

function placeholders(str) {
  return new Set([...String(str).matchAll(/\{(\w+)\}/g)].map(m => m[1]));
}

let placeholderErrors = 0;

for (const key of baseKeys) {
  const basePlaceholders = placeholders(baseDict[key]);
  if (basePlaceholders.size === 0) continue;

  for (const locale of LOCALES) {
    if (locale === BASE_LOCALE) continue;
    const value = dictionaries[locale][key];
    if (value === undefined) continue; // already reported as missing above

    const localePlaceholders = placeholders(value);
    const missing = [...basePlaceholders].filter(p => !localePlaceholders.has(p));

    if (missing.length > 0) {
      fail(`"${locale}.json" key "${key}": missing placeholder(s) {${missing.join('}, {')}} present in ${BASE_LOCALE}.json`);
      placeholderErrors++;
    } else {
      pass(`"${locale}.json" key "${key}": placeholders match`);
    }
  }
}

if (placeholderErrors === 0) {
  process.stdout.write(`  ${G}✓${X} All placeholders match across locales\n`);
}

// ── Check 3: No empty strings ─────────────────────────────────────────────────
section('3  No empty translations');
let emptyErrors = 0;

for (const locale of LOCALES) {
  for (const [key, value] of Object.entries(dictionaries[locale])) {
    if (typeof value !== 'string' || value.trim() === '') {
      fail(`"${locale}.json" key "${key}": empty or non-string value`);
      emptyErrors++;
    } else {
      pass(`"${locale}.json" key "${key}": non-empty`);
    }
  }
}

if (emptyErrors === 0) {
  process.stdout.write(`  ${G}✓${X} No empty translations found\n`);
}

// ── Summary ───────────────────────────────────────────────────────────────────
process.stdout.write(`\n${'─'.repeat(52)}\n`);

if (totalErrors === 0) {
  process.stdout.write(`${G}${B}✓ All checks passed. 0 errors.${X}\n`);
  process.exit(0);
} else {
  process.stderr.write(`${R}${B}✗ ${totalErrors} error(s) found.${X}\n`);
  process.exit(1);
}
