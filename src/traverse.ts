import type { NanGraph } from './graph.js';
import type { TraversalOptions } from './types.js';

function matches(relType: string, relTypes?: string[]): boolean {
  return relTypes === undefined || relTypes.length === 0 || relTypes.includes(relType);
}

function nextOf(
  graph: NanGraph,
  id: string,
  direction: 'outgoing' | 'incoming' | 'both',
  relTypes?: string[],
): string[] {
  const result: string[] = [];
  if (direction === 'outgoing' || direction === 'both') {
    for (const edge of graph['edges']) {
      if (edge.from === id && matches(edge.relType, relTypes)) result.push(edge.to);
    }
  }
  if (direction === 'incoming' || direction === 'both') {
    for (const edge of graph['edges']) {
      if (edge.to === id && matches(edge.relType, relTypes)) result.push(edge.from);
    }
  }
  return [...new Set(result)];
}

/**
 * BFS traversal. Returns reachable node ids (excluding `start`).
 * Mirrors SOFE `blast_radius()` generalized with direction + relationship filter + depth.
 */
export function traverseBFS(graph: NanGraph, start: string, opts: TraversalOptions = {}): string[] {
  const { relTypes, maxDepth = Infinity, direction = 'outgoing' } = opts;
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [{ id: start, depth: 0 }];
  visited.add(start);
  while (queue.length) {
    const { id, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;
    for (const next of nextOf(graph, id, direction, relTypes)) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push({ id: next, depth: depth + 1 });
      }
    }
  }
  visited.delete(start);
  return [...visited];
}

/**
 * DFS traversal (iterative, pre-order). Returns reachable node ids (excluding `start`).
 */
export function traverseDFS(graph: NanGraph, start: string, opts: TraversalOptions = {}): string[] {
  const { relTypes, maxDepth = Infinity, direction = 'outgoing' } = opts;
  const visited = new Set<string>();
  const stack: Array<{ id: string; depth: number }> = [{ id: start, depth: 0 }];
  while (stack.length) {
    const { id, depth } = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    if (depth >= maxDepth) continue;
    const nexts = nextOf(graph, id, direction, relTypes);
    // push in reverse so traversal preserves edge order
    for (let i = nexts.length - 1; i >= 0; i--) {
      const n = nexts[i];
      if (!visited.has(n)) stack.push({ id: n, depth: depth + 1 });
    }
  }
  visited.delete(start);
  return [...visited];
}

/**
 * Blast radius — all nodes affected downstream if `start` fails (BFS outgoing).
 * Mirrors SOFE `blast_radius()`.
 */
export function blastRadius(graph: NanGraph, start: string, opts: Omit<TraversalOptions, 'direction'> = {}): string[] {
  return traverseBFS(graph, start, { ...opts, direction: 'outgoing' });
}

/**
 * Cost chain — sum of `attrs.monthly_cost` for `start` + all downstream affected.
 * Mirrors SOFE `cost_chain()`.
 */
export function costChain(graph: NanGraph, start: string, opts: Omit<TraversalOptions, 'direction'> = {}): number {
  const affected = blastRadius(graph, start, opts);
  let total = 0;
  for (const id of affected) {
    const n = graph.getNode(id);
    total += typeof n?.attrs?.monthly_cost === 'number' ? n.attrs.monthly_cost : 0;
  }
  const self = graph.getNode(start);
  total += typeof self?.attrs?.monthly_cost === 'number' ? self.attrs.monthly_cost : 0;
  return Math.round(total * 100) / 100;
}

/** Team cost — sum of monthly_cost for all nodes where attrs.owner === `owner`. */
export function teamCost(graph: NanGraph, owner: string): number {
  let total = 0;
  for (const n of graph.nodes.values()) {
    const o = n.attrs?.owner ?? n.attrs?.Owner;
    if (o === owner) total += (n.attrs?.monthly_cost as number) ?? 0;
  }
  return Math.round(total * 100) / 100;
}

/** Fan-in — how many nodes point into `id` (incoming edges). */
export function fanIn(graph: NanGraph, id: string): number {
  return nextOf(graph, id, 'incoming').length;
}

/**
 * Single points of failure — nodes with fan-in >= threshold (many depend on them).
 * Mirrors SOFE `single_points_of_failure()`.
 */
export function singlePointsOfFailure(graph: NanGraph, threshold = 3): string[] {
  return [...graph.nodes.keys()].filter((id) => fanIn(graph, id) >= threshold);
}

/**
 * Impact scoring — affected downstream nodes weighted by relationship type + distance.
 * Each edge walked contributes `baseWeight * (relWeight[relType] ?? 1) * decay^depth`.
 * Returns node -> impact score (higher = more severe if `start` fails).
 */
export function impactScore(
  graph: NanGraph,
  start: string,
  opts: {
    maxDepth?: number;
    relTypes?: string[];
    relWeight?: Record<string, number>;
    decay?: number;
  } = {},
): Record<string, number> {
  const { maxDepth = Infinity, relTypes, relWeight = {}, decay = 0.5 } = opts;
  const scores: Record<string, number> = {};
  const visited = new Set<string>([start]);
  const queue: Array<{ id: string; depth: number }> = [{ id: start, depth: 0 }];
  while (queue.length) {
    const { id, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;
    for (const edge of graph['edges']) {
      if (edge.from !== id || !matches(edge.relType, relTypes)) continue;
      const target = edge.to;
      if (visited.has(target)) continue;
      visited.add(target);
      const relW = relWeight[edge.relType] ?? 1;
      scores[target] = Math.round(relW * Math.pow(decay, depth) * 100) / 100;
      queue.push({ id: target, depth: depth + 1 });
    }
  }
  return scores;
}

/**
 * Critical path — shortest dependency chain from `from` to `to` (BFS, outgoing).
 * Returns array of node ids [from, ..., to], or empty array if unreachable.
 */
export function criticalPath(graph: NanGraph, from: string, to: string, relTypes?: string[]): string[] {
  if (from === to) return [from];
  const prev = new Map<string, string>();
  const queue = [from];
  const visited = new Set<string>([from]);
  while (queue.length) {
    const current = queue.shift()!;
    if (current === to) break;
    for (const edge of graph['edges']) {
      if (edge.from !== current || !matches(edge.relType, relTypes)) continue;
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      prev.set(edge.to, current);
      queue.push(edge.to);
    }
  }
  if (!visited.has(to)) return [];
  const path: string[] = [];
  let cursor: string | undefined = to;
  while (cursor !== undefined) {
    path.unshift(cursor);
    cursor = prev.get(cursor);
  }
  return path;
}

/**
 * Cost-annotated graph export — serializes nodes/edges with `monthly_cost` attached.
 * Returns both a JSON object and a Mermaid `flowchart LR` string for visualization.
 */
export function exportCostGraph(graph: NanGraph, opts: { title?: string } = {}): {
  json: { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> };
  mermaid: string;
} {
  const nodes = [...graph.nodes.values()].map((n) => ({ ...n, monthly_cost: n.attrs?.monthly_cost ?? 0 }));
  const edges = graph.edges.map((e) => ({ ...e }));
  const json = { nodes, edges };

  const lines: string[] = [];
  if (opts.title) lines.push(`---\ntitle: ${opts.title}\n---`);
  lines.push('flowchart LR');
  for (const n of nodes) {
    const cost = n.monthly_cost as number;
    const label = n.label ?? n.id;
    lines.push(`  ${n.id}["${label} ($${cost})"]`);
  }
  for (const e of edges) {
    lines.push(`  ${e.from} -->|${e.relType}| ${e.to}`);
  }
  return { json, mermaid: lines.join('\n') };
}
