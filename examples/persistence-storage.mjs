/**
 * nan-graph v0.3.0 example — Ñan-004: Persistence & Storage Layer.
 *
 * Demuestra el nuevo módulo storage de v0.3.0:
 *   - saveNg / loadNg      → snapshot binario `.ngb` (msgpack, portable TS↔Py)
 *   - SqliteGraphStore     → embedded graph store (save/load/append)
 *   Reutiliza algoritmos del core (blastRadius, costChain) sobre el grafo persistido.
 *
 * Requiere Node >= 22 (usa node:sqlite).
 * Run:  node examples/persistence-storage.mjs     (tras `npm install` en examples/)
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  NanGraph,
  saveNg,
  loadNg,
  SqliteGraphStore,
  blastRadius,
  costChain,
} from '@carloscortezcloud/nan-graph';

// serverless webapp pipeline
function buildGraph() {
  return new NanGraph()
    .addNode({ id: 'cdn', type: 'aws.cloudfront', attrs: { owner: 'web', monthly_cost: 25 } })
    .addNode({ id: 'api', type: 'aws.apigateway', attrs: { owner: 'web', monthly_cost: 20 } })
    .addNode({ id: 'auth', type: 'aws.lambda', attrs: { owner: 'platform', monthly_cost: 12 } })
    .addNode({ id: 'orders', type: 'aws.lambda', attrs: { owner: 'web', monthly_cost: 30 } })
    .addNode({ id: 'orders-db', type: 'aws.dynamodb', attrs: { owner: 'web', monthly_cost: 45 } })
    .addNode({ id: 'users-db', type: 'aws.dynamodb', attrs: { owner: 'platform', monthly_cost: 18 } })
    .addNode({ id: 'files', type: 'aws.s3', attrs: { owner: 'web', monthly_cost: 9 } })
    .addEdge({ from: 'cdn', to: 'api', relType: 'routes_to' })
    .addEdge({ from: 'api', to: 'auth', relType: 'routes_to' })
    .addEdge({ from: 'api', to: 'orders', relType: 'routes_to' })
    .addEdge({ from: 'orders', to: 'orders-db', relType: 'reads_writes' })
    .addEdge({ from: 'auth', to: 'users-db', relType: 'reads_writes' })
    .addEdge({ from: 'orders', to: 'files', relType: 'reads_writes' });
}

const g = buildGraph();
const dir = mkdtempSync(path.join(tmpdir(), 'nangraph-example-'));

console.log('═══ Ñan-004: .ngb binario (msgpack, portable TS↔Py) ═══\n');

const ngbPath = path.join(dir, 'graph.ngb');
saveNg(g, ngbPath);
const fromNg = loadNg(ngbPath);
console.log(`● saveNg → loadNg round-trip: ${fromNg.nodeCount} nodos, ${fromNg.edgeCount} aristas`);
console.log(`   blast radius de 'cdn':`, blastRadius(fromNg, 'cdn').join(', '));
console.log(`   cost chain de 'cdn':   $${costChain(fromNg, 'cdn')}/mes (incluye downstream)`);

console.log('\n═══ Ñan-004: SQLite embebido (node:sqlite) ═══\n');

const dbPath = path.join(dir, 'graph.db');

// 1) save + close = "apagamos el proceso"
{
  const store = new SqliteGraphStore(dbPath);
  store.save(buildGraph());
  store.close();
}

// 2) nueva instancia sobre el mismo archivo = "simula un restart"
const store = new SqliteGraphStore(dbPath);
const loaded = store.load();
console.log(`● save → close → reopen (restart): ${loaded.nodeCount} nodos, ${loaded.edgeCount} aristas`);
console.log(`   blast radius de 'api':`, blastRadius(loaded, 'api').join(', '));

// 3) append incremental (agregar un nodo sin re-serializar todo)
store.append(
  [{ id: 'admin-ui', type: 'web.spa', attrs: { owner: 'web', monthly_cost: 5 } }],
  [{ from: 'admin-ui', to: 'api', relType: 'routes_to' }],
);
const after = store.load();
console.log(`● append 'admin-ui' → ${after.nodeCount} nodos, ${after.edgeCount} aristas`);
console.log(`   blast radius de 'admin-ui':`, blastRadius(after, 'admin-ui').join(', '));
store.close();

// limpia archivos temp
rmSync(dir, { recursive: true, force: true });
console.log('\n(Datos temporales limpiados)');
