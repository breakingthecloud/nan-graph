/**
 * nan-graph example — Mapa del ECOSISTEMA BYaML v2 (Sprint 8).
 *
 * Dogfooding: construye el grafo del ecosistema (nodos = componentes, edges = flujos)
 * con nan-graph y exporta un Mermaid flowchart con subgraphs por capa.
 * El mismo diagrama está documentado en cc-roadmap/oss-ecosystem/ECOSYSTEM.md.
 *
 * Run:  node examples/ecosystem-byaml-v2.mjs   (tras `npm install` en examples/)
 */
import { NanGraph, exportCostGraph } from '@carloscortezcloud/nan-graph';

// ── Grafo del ecosistema BYaML v2 ──────────────────────────────────────────
const g = new NanGraph()
  // Productor
  .addNode({ id: 'sofe-engine', label: 'SOFE engine (architecture.py)', type: 'sofe' })
  .addNode({ id: 'sofe-collectors', label: 'SOFE collectors (AWS/K8s)', type: 'sofe' })
  // Modelo
  .addNode({ id: 'byaml-spec', label: 'byaml-spec (schema v0.4, catalog 52)', type: 'spec' })
  .addNode({ id: 'byaml-py', label: 'byaml PyPI 0.4.0a1', type: 'pypi' })
  // Motor
  .addNode({ id: 'nan-graph', label: 'nan-graph (npm 0.3.0 + PyPI 0.1.0)', type: 'oss' })
  // Runtime live
  .addNode({ id: 's3-registry', label: 'S3 byaml-schema-registry', type: 'aws' })
  .addNode({ id: 'lambda-api', label: 'API Gateway REST eaittc3am3 + Lambda v2', type: 'aws' })
  .addNode({ id: 'schema-org', label: 'schema.byaml.org (/v1/graph/*)', type: 'dns' })
  // Interfaz AI
  .addNode({ id: 'byaml-mcp', label: 'byaml-mcp PyPI 0.1.0 (8 tools)', type: 'pypi' })
  .addNode({ id: 'agent', label: 'Agent MCP (Kiro/Cursor/Claude)', type: 'ai' })
  // Futuro
  .addNode({ id: 'byaml-web', label: 'byaml.org web v2 (ByaML-005)', type: 'web' })
  .addNode({ id: 'sofe-int', label: 'SOFE integración (ByaML-006)', type: 'sofe' })
  // Edges (flujos)
  .addEdge({ from: 'sofe-collectors', to: 'sofe-engine', relType: 'produce' })
  .addEdge({ from: 'sofe-engine', to: 'byaml-py', relType: 'generates' })
  .addEdge({ from: 'byaml-spec', to: 'byaml-py', relType: 'canon' })
  .addEdge({ from: 'byaml-py', to: 'nan-graph', relType: 'engine_consumes' })
  .addEdge({ from: 'byaml-spec', to: 's3-registry', relType: 'publish.sh' })
  .addEdge({ from: 's3-registry', to: 'lambda-api', relType: 'serves_assets' })
  .addEdge({ from: 'lambda-api', to: 'schema-org', relType: 'public_url' })
  .addEdge({ from: 'schema-org', to: 'byaml-mcp', relType: 'fetch_schema' })
  .addEdge({ from: 'nan-graph', to: 'byaml-mcp', relType: 'blast/cost/SPOF' })
  .addEdge({ from: 'byaml-py', to: 'byaml-mcp', relType: 'convert/validate' })
  .addEdge({ from: 'byaml-mcp', to: 'agent', relType: 'mcp_stdio' })
  .addEdge({ from: 'schema-org', to: 'byaml-web', relType: 'consumes' })
  .addEdge({ from: 'sofe-engine', to: 'sofe-int', relType: 'target' });

// ── 1) Mermaid plano (exportCostGraph) ─────────────────────────────────────
const { mermaid } = exportCostGraph(g, { title: 'BYaML v2 Ecosystem (Sprint 8)' });
console.log('═══ 1. Mermaid plano (exportCostGraph) ═══\n');
console.log(mermaid);
console.log('\n(Nodos:', g.nodeCount, '| Edges:', g.edgeCount, ')');