import type { NanGraph } from './graph';
import type { TraversalOptions } from './types';

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
