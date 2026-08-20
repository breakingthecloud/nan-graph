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

// ── Render Mermaid en un HTML autónomo (browser) ───────────────────────────
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const outFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'impact-cost-graph.html');
const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>nan-graph v0.2.0 — Impact & Cost (Mermaid)</title>
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: true, theme: 'default' });
  const diagram = ${JSON.stringify(mermaid)};
  document.getElementById('diagram').textContent = diagram;
  mermaid.render('diagram', diagram).then(({ svg }) => {
    document.getElementById('output').innerHTML = svg;
  });
</script>
<style>
  body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin: 32px; color: #1f2937; }
  h1 { font-size: 18px; }
  .mermaid { margin: 20px 0; }
  pre { background: #f3f4f6; padding: 12px; border-radius: 8px; font-size: 12px; overflow-x: auto; }
</style>
</head>
<body>
  <h1>nan-graph v0.2.0 — Cost graph (Mermaid)</h1>
  <p>Costo total del grafo: <strong>$${json.nodes.reduce((s, n) => s + n.monthly_cost, 0)}/mes</strong> — ${json.nodes.length} nodos, ${json.edges.length} aristas</p>
  <div id="diagram" class="mermaid"></div>
  <div id="output"></div>
  <h2>Fuente Mermaid</h2>
  <pre id="source"></pre>
  <script>
    document.getElementById('source').textContent = ${JSON.stringify(JSON.stringify(mermaid))};
  </script>
</body>
</html>`;
writeFileSync(outFile, html, 'utf8');
console.log(`\n▶ Abre en el navegador: ${outFile}`);
