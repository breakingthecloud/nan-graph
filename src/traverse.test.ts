import { describe, it, expect } from 'vitest';
import { NanGraph } from './graph';
import {
  traverseBFS,
  traverseDFS,
  blastRadius,
  costChain,
  teamCost,
  fanIn,
  singlePointsOfFailure,
} from './traverse';

/** Simple pipeline graph:
 *  api ─routes_to→ lambda ─reads_writes→ ddb
 *                    └────reads_writes→ s3
 *  cdn ─routes_to→ api
 */
function buildGraph(): NanGraph {
  return new NanGraph()
    .addNode({ id: 'api', type: 'aws.apigateway', attrs: { owner: 'ops', monthly_cost: 20 } })
    .addNode({ id: 'lambda', type: 'aws.lambda', attrs: { monthly_cost: 5 } })
    .addNode({ id: 'ddb', type: 'aws.dynamodb', attrs: { monthly_cost: 30 } })
    .addNode({ id: 's3', type: 'aws.s3', attrs: { monthly_cost: 15 } })
    .addNode({ id: 'cdn', type: 'aws.cloudfront', attrs: { owner: 'ops', monthly_cost: 8 } })
    .addEdge({ from: 'api', to: 'lambda', relType: 'routes_to' })
    .addEdge({ from: 'lambda', to: 'ddb', relType: 'reads_writes' })
    .addEdge({ from: 'lambda', to: 's3', relType: 'reads_writes' })
    .addEdge({ from: 'cdn', to: 'api', relType: 'routes_to' });
}

describe('traversal', () => {
  it('BFS outgoing', () => {
    const reach = traverseBFS(buildGraph(), 'api');
    expect(reach.sort()).toEqual(['ddb', 'lambda', 's3']);
  });

  it('BFS with relType filter only traverses matching edges', () => {
    const reach = traverseBFS(buildGraph(), 'api', { relTypes: ['reads_writes'] });
    expect(reach).toEqual([]); // api has no reads_writes outgoing
    const fromLambda = traverseBFS(buildGraph(), 'lambda', { relTypes: ['reads_writes'] });
    expect(fromLambda.sort()).toEqual(['ddb', 's3']);
  });

  it('BFS with maxDepth limits reach', () => {
    const reach = traverseBFS(buildGraph(), 'cdn', { maxDepth: 1 });
    expect(reach).toEqual(['api']);
  });

  it('DFS visits all reachable', () => {
    const dfs = traverseDFS(buildGraph(), 'api').sort();
    expect(dfs).toEqual(['ddb', 'lambda', 's3']);
  });
});

describe('blast radius & cost chain', () => {
  it('blastRadius = downstream affected', () => {
    expect(blastRadius(buildGraph(), 'api').sort()).toEqual(['ddb', 'lambda', 's3']);
    expect(blastRadius(buildGraph(), 'cdn').sort()).toEqual(['api', 'ddb', 'lambda', 's3']);
  });

  it('costChain sums self + downstream monthly_cost', () => {
    // api(20) + lambda(5) + ddb(30) + s3(15) = 70
    expect(costChain(buildGraph(), 'api')).toBe(70);
    // cdn(8) + api(20) + lambda(5) + ddb(30) + s3(15) = 78
    expect(costChain(buildGraph(), 'cdn')).toBe(78);
    // ddb alone = 30
    expect(costChain(buildGraph(), 'ddb')).toBe(30);
  });
});

describe('owner / SPOF', () => {
  it('teamCost sums monthly_cost by owner', () => {
    expect(teamCost(buildGraph(), 'ops')).toBe(28); // api(20) + cdn(8)
    expect(teamCost(buildGraph(), 'nobody')).toBe(0);
  });

  it('fanIn counts incoming edges', () => {
    expect(fanIn(buildGraph(), 'api')).toBe(1); // from cdn
    expect(fanIn(buildGraph(), 'lambda')).toBe(1); // from api
  });

  it('singlePointsOfFailure with threshold', () => {
    // threshold 1: every node with fan-in >= 1 (api<-cdn, lambda<-api, ddb<-lambda, s3<-lambda)
    const spof = singlePointsOfFailure(buildGraph(), 1);
    expect(spof.sort()).toEqual(['api', 'ddb', 'lambda', 's3']);
    // threshold 3: no node has fan-in >= 3 in this graph
    expect(singlePointsOfFailure(buildGraph(), 3)).toEqual([]);
  });

  it('detects a real SPOF (high fan-in)', () => {
    const g = new NanGraph()
      .addEdge({ from: 'a', to: 'db', relType: 'reads' })
      .addEdge({ from: 'b', to: 'db', relType: 'reads' })
      .addEdge({ from: 'c', to: 'db', relType: 'reads' })
      .addEdge({ from: 'db', to: 'sink', relType: 'writes' });
    expect(fanIn(g, 'db')).toBe(3);
    expect(singlePointsOfFailure(g, 3)).toEqual(['db']);
  });
});
