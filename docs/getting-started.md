# Getting Started

Instala el paquete (elige tu runtime) y corre tu primer grafo en menos de 5 minutos.

## TypeScript / npm

```bash
pnpm add @carloscortezcloud/nan-graph
# o: npm install @carloscortezcloud/nan-graph
```

```ts
import { NanGraph, blastRadius, costChain } from '@carloscortezcloud/nan-graph';

const g = new NanGraph()
  .addNode({ id: 'api', type: 'aws.apigateway', attrs: { monthly_cost: 20 } })
  .addNode({ id: 'lambda', type: 'aws.lambda', attrs: { monthly_cost: 5 } })
  .addNode({ id: 'ddb', type: 'aws.dynamodb', attrs: { monthly_cost: 30 } })
  .addEdge({ from: 'api', to: 'lambda', relType: 'routes_to' })
  .addEdge({ from: 'lambda', to: 'ddb', relType: 'reads_writes' });

console.log(blastRadius(g, 'api')); // ['lambda', 'ddb'] — qué se cae si api falla
console.log(costChain(g, 'api'));   // 55 — costo downstream total ($/mes)
```

## Python / PyPI

```bash
pip install nan-graph
# o con uv: uv add nan-graph
```

```python
from nangraph import NanGraph, blast_radius, cost_chain

g = (
    NanGraph()
    .add_node({"id": "api", "type": "aws.apigateway", "attrs": {"monthly_cost": 20}})
    .add_node({"id": "lambda", "type": "aws.lambda", "attrs": {"monthly_cost": 5}})
    .add_node({"id": "ddb", "type": "aws.dynamodb", "attrs": {"monthly_cost": 30}})
    .add_edge("api", "lambda", "routes_to")
    .add_edge("lambda", "ddb", "reads_writes")
)

print(blast_radius(g, "api"))  # ['lambda', 'ddb']
print(cost_chain(g, "api"))    # 55.0
```

## Importar desde YAML / JSON

El grafo se puede construir desde YAML en dos formatos:

**1) Estilo `dependency-graph.yaml`** (nodos clave→props + aristas):
```ts
import { fromYaml } from '@carloscortezcloud/nan-graph';
const g = fromYaml(`
nodes:
  sofe-engine: { type: python-library }
  sofe-server: { type: python-api }
edges:
  - { from: sofe-engine, to: sofe-server, relType: bundles }
`);
```

**2) Estilo BYaML v0.3** (`components` + `relationships`):
```python
from nangraph import from_object
g = from_object({
    "components": [{"id": "api", "type": "aws.apigateway", "monthly_cost": 20}],
    "relationships": [{"from": "api", "to": "lambda", "type": "routes_to"}],
})
```

## Siguiente

- Entiende el modelo en [**Concepts**](concepts.md).
- Mira la API completa en [**API Reference**](api.md).
- Ejemplos ejecutables en [`../examples/`](../examples/).
