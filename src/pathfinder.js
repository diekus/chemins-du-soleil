import { DIFFICULTY_WEIGHT } from './graph.js';

/**
 * Returns up to k lowest-cost simple routes from startId to endId,
 * sorted ascending by cost, respecting maxDifficulty as a hard ceiling.
 *
 * Uses Yen's K-Shortest Simple Paths algorithm.
 * Returns [] if no route exists under the given constraints.
 * Returns [{ path, cost:0, steps:[] }] when startId === endId.
 *
 * Each route: { path: string[], cost: number, steps: Step[] }
 * Each step:  { from, to, name, type, difficulty }
 */
export function findRoutes(graph, startId, endId, maxDifficulty, k = 3) {
  if (startId === endId) {
    return [{ path: [startId], cost: 0, steps: [] }];
  }

  const maxWeight = DIFFICULTY_WEIGHT[maxDifficulty] ?? Infinity;
  const NONE = new Set();

  const first = dijkstra(graph, startId, endId, maxWeight, NONE, NONE);
  if (!first) return [];

  // A: confirmed shortest paths in ascending cost order.
  // seen: all path strings ever committed to A or B (deduplication).
  const A    = [first];
  const B    = [];
  const seen = new Set([pathKey(first)]);

  for (let ki = 1; ki < k; ki++) {
    const prevPath = A[ki - 1];

    for (let i = 0; i < prevPath.path.length - 1; i++) {
      const spurNode  = prevPath.path[i];
      const rootPath  = prevPath.path.slice(0, i + 1);
      const rootSteps = prevPath.steps.slice(0, i);

      const removedEdgeKeys = new Set();
      // Remove nodes that appear before the spur in the root to enforce simple paths.
      const removedNodes = new Set(rootPath.slice(0, -1));

      // For every confirmed path that shares this root prefix, remove the
      // outgoing edge at position i so the spur is forced to diverge.
      for (const found of A) {
        if (
          found.path.length > i &&
          rootPath.every((id, j) => found.path[j] === id)
        ) {
          const stepAtSpur = found.steps[i];
          if (stepAtSpur) {
            removedEdgeKeys.add(edgeKey(spurNode, found.path[i + 1], stepAtSpur.name));
          }
        }
      }

      const spurResult = dijkstra(
        graph, spurNode, endId, maxWeight, removedEdgeKeys, removedNodes,
      );
      if (!spurResult) continue;

      const rootCost = rootSteps.reduce(
        (sum, s) => sum + (DIFFICULTY_WEIGHT[s.difficulty] ?? 99), 0,
      );

      const candidate = {
        path:  [...rootPath, ...spurResult.path.slice(1)],
        cost:  rootCost + spurResult.cost,
        steps: [...rootSteps, ...spurResult.steps],
      };

      const key = pathKey(candidate);
      if (!seen.has(key)) {
        seen.add(key);
        B.push(candidate);
      }
    }

    if (B.length === 0) break;

    B.sort((a, b) => a.cost - b.cost);
    A.push(B.shift());
  }

  return A;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function dijkstra(graph, startId, endId, maxWeight, removedEdgeKeys, removedNodes) {
  if (removedNodes.has(startId) || removedNodes.has(endId)) return null;
  if (!graph.has(startId) || !graph.has(endId)) return null;

  const dist     = new Map();
  const prevNode = new Map();
  const prevEdge = new Map();
  const visited  = new Set();

  for (const id of graph.keys()) {
    if (!removedNodes.has(id)) dist.set(id, Infinity);
  }
  dist.set(startId, 0);

  // Simple binary-heap substitute: sorted array.
  // Fine for ~500-node resort graphs; replace with a heap if needed.
  const queue = [{ id: startId, cost: 0 }];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const { id: u, cost } = queue.shift();

    if (visited.has(u)) continue;
    visited.add(u);
    if (u === endId) break;

    for (const edge of (graph.get(u) ?? [])) {
      if (removedNodes.has(edge.to))                              continue;
      if (edge.weight > maxWeight)                                continue;
      if (removedEdgeKeys.has(edgeKey(u, edge.to, edge.name)))   continue;

      const newCost = cost + edge.weight;
      if (newCost < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, newCost);
        prevNode.set(edge.to, u);
        prevEdge.set(edge.to, edge);
        queue.push({ id: edge.to, cost: newCost });
      }
    }
  }

  const endCost = dist.get(endId);
  if (endCost === undefined || endCost === Infinity) return null;

  // Reconstruct path backwards from endId.
  const path  = [];
  const steps = [];
  let cur = endId;

  while (cur !== startId) {
    const from = prevNode.get(cur);
    const edge = prevEdge.get(cur);
    if (from === undefined || edge === undefined) return null;
    path.unshift(cur);
    steps.unshift({ from, to: cur, name: edge.name, type: edge.type, difficulty: edge.difficulty });
    cur = from;
  }
  path.unshift(startId);

  return { path, cost: endCost, steps };
}

function edgeKey(from, to, name) {
  return `${from}\x00${to}\x00${name}`;
}

function pathKey(route) {
  return route.path.join('\x00');
}
