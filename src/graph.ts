import type { GraphNode, GraphEdge, TraversalOptions } from './types.js';

/**
 * NanGraph — in-memory directed multi-graph with typed relationships.
 * Extraído de SOFE `engine/architecture.py` + modelado sobre cc-mng `data.ts`.
 * Sin dependencias externas; funciona en Node.js, CF Workers, Lambda.
 */
export class NanGraph {
  nodes = new Map<string, GraphNode>();
  edges: GraphEdge[] = [];
  /** id -> [{targetId, relType, label}] */
  private adjacency = new Map<string, Array<{ targetId: string; relType: string; label?: string }>>();
  /** id -> [{sourceId, relType, label}] */
  private reverse = new Map<string, Array<{ sourceId: string; relType: string; label?: string }>>();

  /** Add (or replace) a node. Returns the graph for chaining. */
  addNode(node: GraphNode): this {
    this.nodes.set(node.id, { ...node, attrs: node.attrs ?? {} });
    return this;
  }

  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  /** Add a directed, typed edge between two nodes. Nodes are auto-created if missing. */
  addEdge(edge: GraphEdge): this {
    if (!this.nodes.has(edge.from)) this.addNode({ id: edge.from });
    if (!this.nodes.has(edge.to)) this.addNode({ id: edge.to });
    this.edges.push(edge);

    if (!this.adjacency.has(edge.from)) this.adjacency.set(edge.from, []);
    this.adjacency.get(edge.from)!.push({ targetId: edge.to, relType: edge.relType, label: edge.label });

    if (!this.reverse.has(edge.to)) this.reverse.set(edge.to, []);
    this.reverse.get(edge.to)!.push({ sourceId: edge.from, relType: edge.relType, label: edge.label });
    return this;
  }

  /**
   * Nodes related to `id`. Mirrors SOFE `get_related()`.
   * @param direction 'outgoing' (this -> others) | 'incoming' (others -> this) | 'both'
   */
  getRelated(id: string, relType?: string, direction: 'outgoing' | 'incoming' | 'both' = 'outgoing'): GraphNode[] {
    const result: GraphNode[] = [];
    const push = (targetId: string, rtype: string) => {
      if (relType === undefined || rtype === relType) {
        const n = this.nodes.get(targetId);
        if (n) result.push(n);
      }
    };
    if (direction === 'outgoing' || direction === 'both') {
      for (const { targetId, relType: rtype } of this.adjacency.get(id) ?? []) push(targetId, rtype);
    }
    if (direction === 'incoming' || direction === 'both') {
      for (const { sourceId, relType: rtype } of this.reverse.get(id) ?? []) push(sourceId, rtype);
    }
    return result;
  }

  /** Number of nodes. */
  get nodeCount(): number {
    return this.nodes.size;
  }

  /** Number of edges. */
  get edgeCount(): number {
    return this.edges.length;
  }
}
