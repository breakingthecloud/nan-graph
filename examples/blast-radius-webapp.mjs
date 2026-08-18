/**
 * nan-graph example — webapp pipeline: blast radius + cost chain.
 *
 * Prereq: `pnpm install` (o `npm install`) en examples/ para instalar @carloscortezcloud/nan-graph
 * Run:    `node examples/blast-radius-webapp.mjs`
 */
import { NanGraph, blastRadius, costChain, fanIn, singlePointsOfFailure } from '@carloscortezcloud/nan-graph';

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

console.log('Nodes:', g.nodeCount, '| Edges:', g.edgeCount, '\n');

for (const id of ['cdn', 'api', 'orders']) {
  const radius = blastRadius(g, id);
  console.log(`● ${id} — blast radius (${radius.length}):`, radius.join(', '));
  console.log(`   cost chain ($/mes hacia abajo): $${costChain(g, id)}`);
}

console.log(`\nFan-in de 'orders-db':`, fanIn(g, 'orders-db'));
console.log('SPOF (fan-in >= 2):', singlePointsOfFailure(g, 2).join(', ') || '(ninguno)');
