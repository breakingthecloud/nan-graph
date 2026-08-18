# Contribution

Guía para desarrolladores que trabajan en **nan-graph** (core TS + port Python).

## Stack / layout

| Área | Detalle |
|------|---------|
| **TS core** | `breakingthecloud/nan-graph` · TypeScript + vitest · pnpm |
| **Py port** | `breakingthecloud/nan-graph-py` · Python + pytest · uv |
| **Docs** | `breakingthecloud/nan-graph/docs/` |
| **Package TS** | `@carloscortezcloud/nan-graph` (npm) |
| **Package Py** | `nan-graph` (PyPI) |

## Prerrequisitos

- **Node.js 22+** (pnpm 11 lo exige).
- **pnpm** (workspace del repo).
- **uv** para el port Python.
- Python 3.10+ (se recomienda 3.13 via Homebrew).

> En esta máquina, pnpm vive en Node 22. Usa `fnm exec --using 22 pnpm …`.

## TS — build y test

```bash
cd ~/dev/breakingthecloud/nan-graph
fnm exec --using 22 pnpm install      # 1ra vez / cuando cambien deps
fnm exec --using 22 pnpm run build    # tsc → dist/
fnm exec --using 22 pnpm run test     # vitest (15 tests)
```

- Los implicit relativos DEBEN llevar extensión `.js` (módulo ESM + `moduleResolution: NodeNext`).
  Ej: `import { NanGraph } from './graph.js'`. **No** `./graph`.
- Los tests viven junto al source (`src/*.test.ts`).

## Python — build y test

```bash
cd ~/dev/breakingthecloud/nan-graph-py
uv run --with pytest --python 3.13 pytest -q   # tests
uv build                                        # sdist + wheel
```

## Sync TS → PyPI (patrón styrr-py)

El port Python debe mantener **paridad** con el core TS. Cuando cambies el TS:

1. Identifica el cambio en `src/` (graph, traverse, importers, types).
2. Reflejalo 1:1 en `nan-graph-py/src/nangraph/`.
3. Mantén la tabla de paridad en el README (`api.md#API Reference`) actualizada.
4. Corre los tests de ambos lados (deben dar el mismo resultado).

Nombres que van juntos:

| TS | Python |
|----|--------|
| `addNode` / `addEdge` | `add_node` / `add_edge` |
| `traverseBFS` / `traverseDFS` | `traverse_bfs` / `traverse_dfs` |
| `blastRadius` / `costChain` | `blast_radius` / `cost_chain` |
| `fromYaml` / `fromObject` / `fromJson` | `from_yaml` / `from_object` / `from_json` |

## Release / publish

### npm (TS)

El **publish a npm es manual del mantainer** (requiere OTP/2FA):

```bash
cd ~/dev/breakingthecloud/nan-graph
fnm exec --using 22 pnpm run build
# bump version en package.json
git tag -a vX.Y.Z -m "..." && git push origin vX.Y.Z
pnpm publish --access public   # manual, con OTP
```

### PyPI (Python)

```bash
cd ~/dev/breakingthecloud/nan-graph-py
uv build
# token en Keychain de macOS:
UV_PUBLISH_TOKEN="$(security find-generic-password -s pypi-token -a pypi -w)" uv publish
git tag -a vX.Y.Z -m "..." && git push origin vX.Y.Z
```

## Convenciones

- **Licencia:** Apache-2.0.
- **Sin comentarios innecesarios** en código; los header-doc de módulo y funciones públicas OK.
- Los commits describen el cambio + por qué (p.ej. `fix: ESM runtime — NodeNext + .js`).
- Versionado semántico; los cambios de API rompen → MAJOR bump.

## Puntos de extensión (roadmap Ñan)

- **nan-002 Blast Radius:** ya está en el core (`blastRadius`); los SoW refinan el impacto downstream.
- **nan-003 Cost Propagation:** ya está `costChain`; la propagación de costos multi-cadena se profundiza.
- **MCP byaml-mcp v2 (ByaML-004):** consumirá `nan-graph` para traversal + findings + remediation.
