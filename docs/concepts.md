# Concepts — modelo del grafo

El modelo de **SOFE Architecture Graph** que implementa nan-graph: un **grafo dirigido en memoria
con relaciones tipadas**. Sin base de datos — puro in-memory, pensado para análisis rápido
(blast radius, impacto, costos) en agentes, CLI y CI.

## Nodo (`node`)

Una **unidad desplegable / recurso / servicio / documento**.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `string` | Identificador único |
| `label` | `string?` | Etiqueta de display |
| `type` | `string?` | Tipo, p.ej. `aws.lambda`, `python-library`, `cf-worker` |
| `attrs` | `Record<string, any>` | Atributos libres: `owner`, `monthly_cost`, `region`, `repo`, `healthUrl`… |

Los atributos que las **funciones de análisis** consumen:
- `attrs.monthly_cost` → usado por `costChain` / `cost_chain` / `teamCost` / `team_cost`.
- `attrs.owner` → usado por `teamCost` / `team_cost`.

## Arista (`edge`)

Una **relación dirigida y tipada** entre dos nodos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `from` | `string` | Nodo origen |
| `to` | `string` | Nodo destino |
| `relType` | `string` | Tipo de relación, p.ej. `routes_to`, `reads_writes`, `triggers`, `depends`, `calls`, `bundles` |
| `label` | `string?` | Etiqueta / acción de la arista |

> Al añadir una arista, los nodos origen/destino se **auto-crean** si no existen.

## Relaciones (relType)

Convención de tipos (abierta — puedes usar los que necesites):
`routes_to`, `reads`, `writes`, `reads_writes`, `triggers`, `calls`, `depends`, `bundles`, `proxies`, `uses`, `monitors`.

El **filtrado por relType** es clave: puedes recorrer solo las aristas que importan
(p.ej. solo `reads_writes` para impacto de datos, solo `routes_to` para tráfico).

## Traversal

- **BFS** (`traverseBFS`): nivel por nivel (cola).
- **DFS** (`traverseDFS`): profundidad primero (pila, pre-order).

Ambos soportan opciones:
- `relTypes?: string[]` — recorre **solo** aristas de estos tipos.
- `maxDepth?: number` — límite de profundidad.
- `direction?: 'outgoing' | 'incoming' | 'both'` — dirección de recorrido.

Devuelven las ids alcanzables **sin incluir el nodo inicial**.

## Blast Radius

> **Qué se cae si este servicio falla.**

Todos los nodos alcanzables **downstream** (BFS outgoing) desde un nodo inicial.
Si `api` falla, `blastRadius(g, 'api')` devuelve todo lo que depende de `api` hacia abajo.

## Cost Chain

> **Cuánto cuesta (USD/mes) si esto se va abajo.**

Suma de `attrs.monthly_cost` de:
- el nodo inicial (+)
- todos los nodos de su blast radius.

## Team Cost

Suma de `attrs.monthly_cost` de todos los nodos donde `attrs.owner === X`.

## Fan-in / SPOF

- **Fan-in** de un nodo = cuántas aristas entrantes tiene (cuántos dependen de él).
- **Single Point of Failure (SPOF)** = nodos con fan-in `>= threshold`.
  Mucha gente depende de él → es un punto crítico si falla.

```ts
singlePointsOfFailure(g, 3) // nodos con fan-in >= 3
```

## Direcciones

| Dirección | Semántica |
|-----------|-----------|
| `outgoing` | este nodo → otros (dependientes/impactados hacia abajo) |
| `incoming` | otros → este nodo (de qué depende este / quién lo apunta) |
| `both` | ambos |

## Fuentes del modelo

nan-graph extrae el análisis de:
- SOFE `engine/architecture.py` → `blast_radius()`, `cost_chain()`, `fan_in`, `single_points_of_failure()`.
- cc-mng `graph/data.ts` → tipos `GraphNode` / `GraphEdge`.
- `dependency-graph.yaml` → formato de input YAML.

## Licencia / apache-2.0
