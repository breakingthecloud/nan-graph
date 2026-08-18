import { describe, it, expect } from 'vitest';
import { NanGraph } from './graph';
import { fromYaml, fromObject } from './importYaml';

describe('NanGraph core', () => {
  it('adds nodes and edges, auto-creates missing nodes', () => {
    const g = new NanGraph();
    g.addNode({ id: 'api', type: 'aws.apigateway' });
    g.addEdge({ from: 'api', to: 'lambda', relType: 'routes_to' });
    expect(g.hasNode('api')).toBe(true);
    expect(g.hasNode('lambda')).toBe(true); // auto-created
    expect(g.nodeCount).toBe(2);
    expect(g.edgeCount).toBe(1);
  });

  it('getRelated outgoing/incoming/both with rel filtering', () => {
    const g = new NanGraph();
    g.addEdge({ from: 'api', to: 'lambda', relType: 'routes_to' });
    g.addEdge({ from: 'lambda', to: 'ddb', relType: 'reads_writes' });
    g.addEdge({ from: 'user', to: 'api', relType: 'calls' });

    expect(g.getRelated('api', undefined, 'outgoing').map((n) => n.id)).toEqual(['lambda']);
    expect(g.getRelated('api', undefined, 'both').map((n) => n.id).sort()).toEqual(['lambda', 'user']);
    // filtering
    expect(g.getRelated('api', 'reads_writes', 'outgoing')).toEqual([]);
    expect(g.getRelated('api', 'routes_to', 'outgoing').map((n) => n.id)).toEqual(['lambda']);
  });

  it('addNode replaces and preserves attrs', () => {
    const g = new NanGraph();
    g.addNode({ id: 'a', attrs: { owner: 'team-x' } });
    g.addNode({ id: 'a', type: 'aws.lambda', attrs: { owner: 'team-y', monthly_cost: 10 } });
    expect(g.getNode('a')?.type).toBe('aws.lambda');
    expect(g.getNode('a')?.attrs?.owner).toBe('team-y');
    expect(g.getNode('a')?.attrs?.monthly_cost).toBe(10);
  });
});

describe('NanGraph import', () => {
  it('fromObject — BYaML components+relationships style', () => {
    const g = fromObject({
      components: [
        { id: 'api', type: 'aws.apigateway', owner: 'ops', monthly_cost: 20 },
        { id: 'lambda', type: 'aws.lambda', monthly_cost: 5 },
      ],
      relationships: [{ from: 'api', to: 'lambda', type: 'routes_to' }],
    });
    expect(g.nodeCount).toBe(2);
    expect(g.getNode('api')?.attrs?.monthly_cost).toBe(20);
    expect(g.getNode('api')?.attrs?.owner).toBe('ops');
    expect(g.edgeCount).toBe(1);
    expect(g.edges[0].relType).toBe('routes_to');
  });

  it('fromYaml — dependency-graph.yaml style', () => {
    const g = fromYaml(`
nodes:
  sofe-engine:
    type: python-library
    repo: breakingthecloud/sofe
  sofe-server-deploy:
    type: deploy-infra
edges:
  - from: sofe-engine
    to: sofe-server-deploy
    relType: bundles
`);
    expect(g.nodeCount).toBe(2);
    expect(g.getNode('sofe-engine')?.type).toBe('python-library');
    expect(g.getNode('sofe-engine')?.attrs?.repo).toBe('breakingthecloud/sofe');
    expect(g.edges[0].relType).toBe('bundles');
  });
});
