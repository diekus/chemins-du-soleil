import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { loadGraph } from '../src/graph.js';
import { findRoutes } from '../src/pathfinder.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const networkPath = resolve(__dirname, '..', 'data', 'network.json');

const network = JSON.parse(await readFile(networkPath, 'utf8'));
const graph   = loadGraph(network);

const START = 'morzine-village';
const END   = 'champery';
const MAX   = 'blue';
const K     = 3;

const routes = findRoutes(graph, START, END, MAX, K);

if (routes.length === 0) {
  console.error(`✗  No routes found from "${START}" to "${END}" at max difficulty "${MAX}".`);
  process.exit(1);
}

console.log(`Found ${routes.length} route(s)  ${START} → ${END}  (max: ${MAX})\n`);

for (const [i, route] of routes.entries()) {
  console.log(`Route ${i + 1}  (cost ${route.cost}):`);
  for (const step of route.steps) {
    const icon = step.type === 'lift' ? '🚡' : '⛷️ ';
    console.log(`  ${icon} [${step.difficulty}]  ${step.name}  (${step.from} → ${step.to})`);
  }
  console.log();
}

// Sanity assertions
const first = routes[0];
if (first.path.at(0) !== START || first.path.at(-1) !== END) {
  console.error('✗  First route does not run from start to end.');
  process.exit(1);
}
console.log('✓  Smoke test passed.');
