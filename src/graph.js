export const DIFFICULTY_WEIGHT = Object.freeze({
  green: 1,
  blue:  2,
  red:   3,
  black: 4,
});

/**
 * Builds a directed adjacency list from a parsed network.json object.
 * Returns Map<nodeId, Edge[]> where each Edge is:
 *   { to, name, type, difficulty, weight }
 *
 * Bidirectional safety net: any edge flagged bidirectional:true whose
 * reverse is absent in the source data is inserted automatically.
 */
export function loadGraph(network) {
  const graph = new Map();

  // Initialise every node with an empty edge list.
  for (const node of network.nodes) {
    graph.set(node.id, []);
  }

  // First pass — add all edges as declared in the data.
  for (const node of network.nodes) {
    for (const conn of (node.connections ?? [])) {
      graph.get(node.id).push(makeEdge(conn));
    }
  }

  // Second pass — insert any missing reverse edges for bidirectional pairs.
  for (const node of network.nodes) {
    for (const conn of (node.connections ?? [])) {
      if (!conn.bidirectional) continue;
      const destEdges = graph.get(conn.to);
      if (!destEdges) continue;
      const reverseExists = destEdges.some(
        e => e.to === node.id && e.name === conn.name,
      );
      if (!reverseExists) {
        destEdges.push(makeEdge({ ...conn, to: node.id }));
      }
    }
  }

  return graph;
}

function makeEdge(conn) {
  return {
    to:         conn.to,
    name:       conn.name,
    type:       conn.type,
    difficulty: conn.difficulty,
    weight:     DIFFICULTY_WEIGHT[conn.difficulty] ?? 99,
  };
}
