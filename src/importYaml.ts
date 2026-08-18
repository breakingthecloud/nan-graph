import { parse } from 'yaml';
import { NanGraph } from './graph.js';
import type { GraphEdge, GraphNode } from './types.js';

export interface GraphInput {
  /** Map of id -> node props (dependency-graph.yaml style) OR array of GraphNode. */
  nodes?: Record<string, Omit<GraphNode, 'id'> & { id?: string }> | GraphNode[];
  /** List of edges `{from,to,relType?}` or `{to,type,label?}` variants. */
  edges?: Array<Partial<GraphEdge>>;
}

function toNumber(x: unknown): number | undefined {
  return typeof x === 'number' ? x : typeof x === 'string' ? Number(x) : undefined;
}

/**
 * Build a NanGraph from a normalized JS object (already parsed from YAML/JSON).
 * Supports:
 *  - `{ nodes: {id: props}, edges: [{from,to,relType?}] }`  (dependency-graph.yaml style)
 *  - `{ components: [...], relationships: [{from,to,type}] }` (BYaML v0.3 style)
 *  - `{ nodes: [GraphNode], edges: [GraphEdge] }`
 */
export function fromObject(input: unknown): NanGraph {
  const graph = new NanGraph();

  if (input === null || typeof input !== 'object') {
    throw new Error('nan-graph: input must be an object');
  }
  const obj = input as Record<string, unknown>;

  // BYaML style: components + relationships
  const components = obj.components;
  if (Array.isArray(components)) {
    for (const c of components as Array<Record<string, unknown>>) {
      const id = (c.id ?? c.name) as string;
      const type = (c.type ?? c.componentType) as string | undefined;
      const attrs: Record<string, unknown> = {};
      const cost = (c.cost ?? {}) as Record<string, unknown>;
      const monthly = toNumber(c.monthly_cost ?? cost.monthly);
      if (monthly !== undefined) attrs.monthly_cost = monthly;
      if (c.owner) attrs.owner = c.owner as string;
      if (c.tags) attrs.tags = c.tags;
      graph.addNode({ id, type, label: c.name as string | undefined, attrs });
    }
    const rels = obj.relationships;
    if (Array.isArray(rels)) {
      for (const r of rels as Array<Record<string, unknown>>) {
        const from = (r.from ?? r.source) as string;
        const to = (r.to ?? r.target) as string;
        const relType = (r.type ?? r.rel_type ?? r.relType ?? 'depends') as string;
        if (from && to) graph.addEdge({ from, to, relType, label: r.label as string | undefined });
      }
    }
    return graph;
  }

  // dependency-graph.yaml style: nodes map + edges
  if (obj.nodes) {
    if (Array.isArray(obj.nodes)) {
      for (const n of obj.nodes as GraphNode[]) graph.addNode(n);
    } else if (typeof obj.nodes === 'object') {
      for (const [id, raw] of Object.entries(obj.nodes as Record<string, GraphNode>)) {
        const { id: _id, label, type, ...rest } = raw;
        graph.addNode({ id, label, type, attrs: { ...(rest as Record<string, unknown>) } });
      }
    }
  } else {
    return graph;
  }

  const edges = obj.edges;
  if (Array.isArray(edges)) {
    for (const e of edges as Array<Record<string, unknown>>) {
      const from = (e.from ?? e.source) as string | undefined;
      const to = (e.to ?? e.target ?? e.targetId) as string | undefined;
      const relType = (e.relType ?? e.type ?? e.rel_type ?? 'depends') as string;
      if (from && to) graph.addEdge({ from, to, relType, label: e.label as string | undefined });
    }
  }
  return graph;
}

/** Parse a YAML string (or JSON string) into a NanGraph. */
export function fromYaml(yamlString: string): NanGraph {
  const parsed = parse(yamlString);
  return fromObject(parsed);
}

/** Parse a JSON string into a NanGraph. */
export function fromJson(jsonString: string): NanGraph {
  return fromObject(JSON.parse(jsonString));
}
