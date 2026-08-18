# API Reference

Referencia completa de nan-graph. **Misma API en TS y Python** — columna a columna.

## Clases

### `NanGraph`

Grafo dirigido multi-arista en memoria.

| Método (TS) | Método (Python) | Descripción |
|-------------|-----------------|-------------|
| `new NanGraph()` | `NanGraph()` | Constructor |
| `g.addNode(node)` | `g.add_node(dict)` | Añade un nodo (reemplaza si existe) |
| `g.addEdge(edge)` | `g.add_edge(from_, to, rel_type)` | Añade arista dirigida tipada (auto-crea nodos) |
| `g.getNode(id)` | `g.get_node(id)` | Devuelve el nodo (o `undefined`/`None`) |
| `g.hasNode(id)` | `g.has_node(id)` | ¿Existe el nodo? |
| `g.getRelated(id, relType?, direction?)` | `g.get_related(id, rel_type?, direction?)` | Vecinos outgoing/incoming/both con filtro |
| `g.nodeCount` | `g.node_count` | Nº de nodos |
| `g.edgeCount` | `g.edge_count` | Nº de aristas |
| `g.edges` | `g.edges` | Lista de aristas |
| `g.nodes` | `g.nodes` | Mapa de nodos |

**`addNode` / `add_node` (TS):**
```ts
g.addNode({ id: 'api', type: 'aws.apigateway', label: 'API GW', attrs: { monthly_cost: 20 } });
```
**`add_node` (Python):**
```python
g.add_node({"id": "api", "type": "aws.apigateway", "label": "API GW", "attrs": {"monthly_cost": 20}})
```

**`addEdge` (TS):**
```ts
g.addEdge({ from: 'api', to: 'lambda', relType: 'routes_to' });
```
**`add_edge` (Python):**
```python
g.add_edge("api", "lambda", "routes_to")
```

## Funciones de análisis

### Traversal

| TS | Python | Descripción |
|----|--------|-------------|
| `traverseBFS(g, start, opts?)` | `traverse_bfs(g, start, rel_types?, max_depth?, direction?)` | Nodos alcanzables (BFS), excl. start |
| `traverseDFS(g, start, opts?)` | `traverse_dfs(g, start, rel_types?, max_depth?, direction?)` | Nodos alcanzables (DFS), excl. start |

**Opciones (TS):**
```ts
interface TraversalOptions {
  relTypes?: string[];      // solo estas relaciones
  maxDepth?: number;        // límite de profundidad
  direction?: 'outgoing' | 'incoming' | 'both';
}
```
**Opciones (Python):** argumentos posicionales: `rel_types`, `max_depth`, `direction`.

### Análisis

| TS | Python | Fórmula |
|----|--------|---------|
| `blastRadius(g, start, opts?)` | `blast_radius(g, start, rel_types?, max_depth?)` | nodos downstream afectados |
| `costChain(g, start, opts?)` | `cost_chain(g, start, rel_types?, max_depth?)` | Σ monthly_cost (start + downstream) |
| `teamCost(g, owner)` | `team_cost(g, owner)` | Σ monthly_cost por `attrs.owner` |
| `fanIn(g, id)` | `fan_in(g, id)` | nº de aristas entrantes |
| `singlePointsOfFailure(g, threshold?)` | `single_points_of_failure(g, threshold?)` | nodos con fan-in >= threshold |

## Importadores

Construyen un `NanGraph` desde datos.

| TS | Python | Input |
|----|--------|-------|
| `fromObject(obj)` | `from_object(dict)` | objeto JS / dict (BYaML o dependency-graph) |
| `fromYaml(str)` | `from_yaml(str)` | string YAML |
| `fromJson(str)` | `from_json(str)` | string JSON |

**Formatos soportados:**
- **BYaML v0.3:** `{ components: [...], relationships: [{from,to,type}] }`
- **dependency-graph.yaml:** `{ nodes: {id: props}, edges: [{from,to,relType}] }`

En el estilo dependency-graph, las props extra del nodo (`repo`, `domain`, etc.) van a `attrs`.

## Tipos (TS)

```ts
interface GraphNode {
  id: string;
  label?: string;
  type?: string;
  attrs?: Record<string, unknown>;
}
interface GraphEdge {
  from: string;
  to: string;
  relType: string;
  label?: string;
}
interface TraversalOptions {
  relTypes?: string[];
  maxDepth?: number;
  direction?: 'outgoing' | 'incoming' | 'both';
}
```

## Tipos (Python)

```python
@dataclass
class GraphNode:
    id: str
    label: str | None = None
    type: str | None = None
    attrs: dict[str, Any] = field(default_factory=dict)

@dataclass
class GraphEdge:
    from_: str
    to: str
    rel_type: str = "depends"
    label: str | None = None
```

## Semántica de `direction`

| Valor | Comportamiento |
|-------|----------------|
| `outgoing` | this → others |
| `incoming` | others → this |
| `both` | ambos |

## Notas

- **Sin dependencias** en el core TS (el import YAML usa `yaml`, ligero). Python usa `PyYAML`.
- Funciona en **Node.js, Cloudflare Workers, Lambda** (TS) y **Python 3.10+** (Py).
- Todos los métodos de construcción retornan el propio grafo → **encadenable**.
