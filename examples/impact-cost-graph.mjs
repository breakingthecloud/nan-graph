/**
 * nan-graph v0.2.0 example — Ñan-002 (impact) + Ñan-003 (cost) sobre el mismo grafo.
 *
 * Demuestra 3 funciones nuevas de v0.2.0:
 *   - impactScore(g, id, { relWeight, decay, maxDepth })  → peso de impacto por relType + distancia
 *   - criticalPath(g, from, to)                            → cadena de dependencia más corta (BFS)
 *   - exportCostGraph(g, { title })                        → JSON + Mermaid flowchart con monthly_cost
 *
 * Run:  node examples/impact-cost-graph.mjs        (tras `npm install` en examples/)
 */
import { NanGraph, impactScore, criticalPath, exportCostGraph } from '@carloscortezcloud/nan-graph';

// serverless webapp pipeline
const g = new NanGraph()
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

console.log('═══ Ñan-002: Impact score (peso por relType + decay por distancia) ═══\n');

for (const id of ['api', 'orders']) {
  const scores = impactScore(g, id, { relWeight: { routes_to: 2, reads_writes: 1 }, maxDepth: 3 });
  // ordenar por score desc
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  console.log(`● Si falla '${id}':`);
  for (const [node, score] of ranked) {
    console.log(`     ${node.padEnd(10)} impacto=${score}`);
  }
  console.log('');
}

console.log('═══ Ñan-002: Critical path (cadena de dependencia más corta) ═══\n');
for (const [from, to] of [
  ['cdn', 'orders-db'],
  ['api', 'files'],
  ['auth', 'orders-db'],
]) {
  const path = criticalPath(g, from, to);
  console.log(`   ${from} → ${to}: ${path.length ? path.join(' → ') : '(sin ruta)'}`);
}
console.log('');

console.log('═══ Ñan-003: Cost graph export (JSON + Mermaid) ═══\n');
const { json, mermaid } = exportCostGraph(g, { title: 'Webapp pipeline' });
console.log(`JSON: ${json.nodes.length} nodos, ${json.edges.length} aristas`);
console.log('Costo total del grafo: $' + json.nodes.reduce((s, n) => s + n.monthly_cost, 0) + '/mes');
console.log('\nMermaid:\n');
console.log(mermaid);
