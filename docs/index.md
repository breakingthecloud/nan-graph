# nan-graph — Developer Docs

> **nan-graph** es el motor de grafo en memoria del **SOFE Architecture Graph** (fusión Ñan × BYaML v2).
> Paquetes: `@carloscortezcloud/nan-graph` (npm/TS) y `nan-graph` (PyPI/Python). Apache-2.0, `breakingthecloud`.

## Cómo moverte por estos docs

| Documento | Para qué |
|-----------|----------|
| [**Getting Started**](getting-started.md) | Instalar y correr tu primer grafo (TS y Python) en 5 min |
| [**Concepts**](concepts.md) | El modelo mental: nodos, aristas, relaciones, blast radius, cost chain, SPOF |
| [**API Reference**](api.md) | Referencia completa de la API, lado a lado TS ↔ Python |
| [**Contribution**](contribution.md) | Build, test, release y el sync TS → PyPI (patrón styrr-py) |

## Repos

| Repo | Contenido |
|------|-----------|
| `breakingthecloud/nan-graph` | Core **TypeScript** (fuente de verdad del modelo) + docs + examples |
| `breakingthecloud/nan-graph-py` | Port **Python** de la misma API, publicado en PyPI como `nan-graph` |

## Quick look

```ts
// TS
import { NanGraph, blastRadius } from '@carloscortezcloud/nan-graph';
```

```python
# Python
from nangraph import NanGraph, blast_radius
```

Misma API en ambos runtimes. Mantienen **paridad funcional**: 15 tests cada uno.

## Integración con el ecosistema

- **tinkuy-agent** (`@carloscortezcloud/tinkuy-agent`): nan-graph se expone como tools de agente
  (`get_blast_radius`, `get_cost_chain`, `get_spof`) — ver [`examples/tinkuy-nan-graph-agent.mjs`](../examples/tinkuy-nan-graph-agent.mjs).
- **BYaML v2 / SOFE Architecture Graph**: el modelo v0.4 se define SOBRE este grafo (ByaML-002).
  Los nodos = recursos/servicios, las aristas = relaciones tipadas.

---

Licencia: Apache-2.0. Ver [LICENSE](../LICENSE).
