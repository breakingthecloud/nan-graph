/**
 * Core types for NanGraph — in-memory Architecture Graph.
 * Modelo unificado: SOFE `architecture.py` (Relationship/blast_radius/cost_chain/fan_in/spof)
 * + cc-mng `data.ts` (GraphNode/GraphEdge). Fusión Ñan × BYaML (SOFE Architecture Graph).
 */

/** A node in the graph — a deployable unit, resource, service or document. */
export interface GraphNode {
  id: string;
  /** Free-form label for display. */
  label?: string;
  /** Resource/service type, e.g. `aws.lambda`, `python-library`, `cf-worker`. */
  type?: string;
  /** Arbitrary attributes (tags, owner, cost, region, healthUrl, repo...). */
  attrs?: Record<string, unknown>;
}

/** A directed edge between two nodes, typed by relationship. */
export interface GraphEdge {
  from: string;
  to: string;
  /** Relationship type, e.g. `routes_to`, `reads_writes`, `triggers`, `depends`, `calls`. */
  relType: string;
  /** Optional display label / action for the edge. */
  label?: string;
}

export type TraversalDirection = 'outgoing' | 'incoming' | 'both';

export interface TraversalOptions {
  /** Restrict traversal to edges of these relationship types. */
  relTypes?: string[];
  /** Maximum depth (0 = only start node). */
  maxDepth?: number;
  /** Traversal direction. */
  direction?: TraversalDirection;
}
