# nan-graph

> **In-memory Architecture Graph engine** — la implementación del grafo de **SOFE Architecture Graph**
> (fusión **Ñan** × **BYaML v2**). OSS, Apache-2.0, bajo `breakingthecloud`.

Un grafo dirigido en memoria con relaciones tipadas, para análisis de arquitectura:
traversal BFS/DFS, **blast radius**, **cost chain**, **fan-in / SPOF**, y filtrado por tipo de relación.

Cero infraestructura: funciona en Node.js, Cloudflare Workers, Lambda. **Zero deps** en el core
(la importación YAML usa el paquete ligero `yaml`).

## 📚 Developer Docs

> Documentación completa para desarrolladores en [`docs/`](docs/index.md):
> [Getting Started](docs/getting-started.md) · [Concepts](docs/concepts.md) ·
> [API Reference](docs/api.md) · [Contribution](docs/contribution.md)

## Install

```bash
pnpm add @carloscortezcloud/nan-graph
```

## Uso

```ts
import { NanGraph, blastRadius, costChain, fromYaml } from '@carloscortezcloud/nan-graph';

const g = new NanGraph()
  .addNode({ id: 'api', type: 'aws.apigateway', attrs: { monthly_cost: 20 } })
  .addNode({ id: 'lambda', type: 'aws.lambda', attrs: { monthly_cost: 5 } })
  .addNode({ id: 'ddb', type: 'aws.dynamodb', attrs: { monthly_cost: 30 } })
  .addEdge({ from: 'api', to: 'lambda', relType: 'routes_to' })
  .addEdge({ from: 'lambda', to: 'ddb', relType: 'reads_writes' });

blastRadius(g, 'api');   // ['lambda', 'ddb']  — qué se cae si api falla
costChain(g, 'api');     // 55 — costo downstream total
```

### Importar desde YAML / JSON

```ts
import { fromYaml } from '@carloscortezcloud/nan-graph';

// estilo dependency-graph.yaml
const g = fromYaml(`
nodes:
  sofe-engine: { type: python-library }
  sofe-server: { type: python-api }
edges:
  - { from: sofe-engine, to: sofe-server, relType: bundles }
`);

// estilo BYaML v0.3 (components + relationships)
const g2 = fromObject({
  components: [{ id: 'api', type: 'aws.apigateway', monthly_cost: 20 }],
  relationships: [{ from: 'api', to: 'lambda', type: 'routes_to' }],
});
```

## API

| Función | Descripción |
|---------|-------------|
| `new NanGraph()` | Grafo dirigido multi-borde en memoria |
| `g.addNode(node)` / `g.addEdge(edge)` | Añadir nodo/arista (auto-crea nodos) |
| `g.getRelated(id, relType?, direction?)` | Vecinos outgoing/incoming/both, con filtro |
| `traverseBFS(g, start, opts)` | Nodos alcanzables (BFS), con `relTypes`/`maxDepth`/`direction` |
| `traverseDFS(g, start, opts)` | Nodos alcanzables (DFS) |
| `blastRadius(g, start)` | Nodos afectados downstream si `start` falla |
| `costChain(g, start)` | Suma `attrs.monthly_cost` de `start` + downstream |
| `teamCost(g, owner)` | Suma de costo por `attrs.owner` |
| `fanIn(g, id)` / `singlePointsOfFailure(g, threshold)` | SPOF por alta dependencia entrante |
| `fromObject(obj)` / `fromYaml(str)` / `fromJson(str)` | Construir grafo desde input |

## Modelo (fusión con SOFE Architecture Graph)

- **Nodo** = unidad desplegable / recurso / servicio / documento (`id`, `type`, `label`, `attrs`).
- **Arista** = relación dirigida tipada (`from`, `to`, `relType`).
- Derivado de SOFE `engine/architecture.py` (blast_radius, cost_chain, fan_in, spof)
  + cc-mng `graph/data.ts` (GraphNode/GraphEdge) + `dependency-graph.yaml` como formato de input.

## Sync a PyPI

El port en Python (`nan-graph` en PyPI) se sincroniza desde este core TS — mismo patrón
que `styrr` → `styrr-py`. Ver SoW `nan-001`.

## Licencia

Apache-2.0. Ver [`LICENSE`](LICENSE).
