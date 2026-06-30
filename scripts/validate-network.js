#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// ── ANSI colours ─────────────────────────────────────────────────────────────
const G = '\x1b[32m'; // green
const R = '\x1b[31m'; // red
const B = '\x1b[1m';  // bold
const D = '\x1b[2m';  // dim
const X = '\x1b[0m';  // reset

// ── Allowed values ────────────────────────────────────────────────────────────
const DIFFICULTIES   = new Set(['green', 'blue', 'red', 'black']);
const LIFT_TYPES     = new Set(['chairlift', 'gondola', 'telecabin', 'surface', 'button', null]);
const COUNTRIES      = new Set(['FR', 'CH']);
const CONN_TYPES     = new Set(['lift', 'slope']);

// ── State ─────────────────────────────────────────────────────────────────────
let totalErrors = 0;

function pass(msg) {
  // Only printed in verbose mode; suppress for cleaner default output.
  if (process.argv.includes('--verbose')) {
    process.stdout.write(`  ${G}✓${X} ${D}${msg}${X}\n`);
  }
}

function fail(msg) {
  totalErrors++;
  process.stderr.write(`  ${R}✗${X} ${msg}\n`);
}

function section(title) {
  process.stdout.write(`\n${B}${title}${X}\n`);
}

// ── Load file ─────────────────────────────────────────────────────────────────
const networkPath = path.resolve(__dirname, '..', 'data', 'network.json');

let raw;
try {
  raw = fs.readFileSync(networkPath, 'utf8');
} catch (e) {
  process.stderr.write(`${R}✗ Cannot read ${networkPath}: ${e.message}${X}\n`);
  process.exit(1);
}

let network;
try {
  network = JSON.parse(raw);
} catch (e) {
  process.stderr.write(`${R}✗ Invalid JSON: ${e.message}${X}\n`);
  process.exit(1);
}

if (!network || !Array.isArray(network.nodes)) {
  process.stderr.write(`${R}✗ network.nodes must be a top-level array${X}\n`);
  process.exit(1);
}

const nodes = network.nodes;

// ── Check 1: Duplicate IDs ────────────────────────────────────────────────────
section('1  Duplicate node IDs');
const nodeIds = new Set();
const nodeMap = new Map();

for (const node of nodes) {
  if (nodeIds.has(node.id)) {
    fail(`Duplicate ID "${node.id}"`);
  } else {
    nodeIds.add(node.id);
    nodeMap.set(node.id, node);
    pass(`"${node.id}" is unique`);
  }
}
if (totalErrors === 0) process.stdout.write(`  ${G}✓${X} ${nodes.length} node IDs are unique\n`);

// ── Check 2: Node field enums ─────────────────────────────────────────────────
section('2  Node field enums');
let nodeEnumErrors = 0;

for (const node of nodes) {
  if (!COUNTRIES.has(node.country)) {
    fail(`Node "${node.id}": invalid country "${node.country}" — must be FR or CH`);
    nodeEnumErrors++;
  }
  if (!LIFT_TYPES.has(node.lift_type === undefined ? '__missing__' : node.lift_type)) {
    fail(`Node "${node.id}": invalid lift_type "${node.lift_type}" — must be chairlift, gondola, telecabin, surface, button, or null`);
    nodeEnumErrors++;
  } else {
    pass(`Node "${node.id}": lift_type "${node.lift_type}" valid`);
  }
}

if (nodeEnumErrors === 0) process.stdout.write(`  ${G}✓${X} All node country and lift_type values are valid\n`);

// ── Check 3: Connection referential integrity and enums ───────────────────────
section('3  Connection referential integrity and enums');
let connErrors = 0;

for (const node of nodes) {
  for (let i = 0; i < (node.connections || []).length; i++) {
    const conn = node.connections[i];
    const label = `Node "${node.id}" → connection[${i}] ("${conn.name || '?'}")`;

    if (conn.to === node.id) {
      fail(`${label}: self-referencing edge`);
      connErrors++;
      continue;
    }

    if (!nodeIds.has(conn.to)) {
      fail(`${label}: "to" references unknown node "${conn.to}"`);
      connErrors++;
    } else {
      pass(`${label}: "to" "${conn.to}" exists`);
    }

    if (!DIFFICULTIES.has(conn.difficulty)) {
      fail(`${label}: invalid difficulty "${conn.difficulty}" — must be green, blue, red, or black`);
      connErrors++;
    } else {
      pass(`${label}: difficulty "${conn.difficulty}" valid`);
    }

    if (!CONN_TYPES.has(conn.type)) {
      fail(`${label}: invalid type "${conn.type}" — must be "lift" or "slope"`);
      connErrors++;
    } else {
      pass(`${label}: type "${conn.type}" valid`);
    }
  }
}

if (connErrors === 0) {
  const totalConns = nodes.reduce((n, node) => n + (node.connections || []).length, 0);
  process.stdout.write(`  ${G}✓${X} All ${totalConns} connection references and enums are valid\n`);
}

// ── Check 4: Bidirectional reverse edges ──────────────────────────────────────
section('4  Bidirectional reverse edges');
let bidiErrors = 0;

for (const node of nodes) {
  for (const conn of (node.connections || [])) {
    if (!conn.bidirectional) continue;

    const dest = nodeMap.get(conn.to);
    if (!dest) continue; // already caught above

    const reverseExists = (dest.connections || []).some(
      c => c.to === node.id && c.bidirectional === true
    );

    if (reverseExists) {
      pass(`"${node.id}" ↔ "${conn.to}" (${conn.name}): reverse exists`);
    } else {
      fail(`"${node.id}" → "${conn.to}" ("${conn.name}"): bidirectional: true but no matching reverse edge from "${conn.to}" → "${node.id}" with bidirectional: true`);
      bidiErrors++;
    }
  }
}

if (bidiErrors === 0) {
  const bidiCount = nodes.reduce(
    (n, node) => n + (node.connections || []).filter(c => c.bidirectional).length,
    0
  );
  if (bidiCount === 0) {
    process.stdout.write(`  ${D}(no bidirectional edges found)${X}\n`);
  } else {
    process.stdout.write(`  ${G}✓${X} All ${bidiCount} bidirectional edges have matching reverse edges\n`);
  }
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
