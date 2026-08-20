import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NanGraph } from './graph';
import { toNgBytes, fromNgBytes, SqliteGraphStore } from './storage';
import { blastRadius, costChain } from './traverse';

function buildGraph(): NanGraph {
  return new NanGraph()
    .addNode({ id: 'api', type: 'aws.apigateway', attrs: { owner: 'ops', monthly_cost: 20 } })
    .addNode({ id: 'lambda', type: 'aws.lambda', attrs: { monthly_cost: 5 } })
    .addNode({ id: 'ddb', type: 'aws.dynamodb', attrs: { monthly_cost: 30 } })
    .addNode({ id: 's3', type: 'aws.s3', attrs: { monthly_cost: 15 } })
    .addEdge({ from: 'api', to: 'lambda', relType: 'routes_to' })
    .addEdge({ from: 'lambda', to: 'ddb', relType: 'reads_writes' })
    .addEdge({ from: 'lambda', to: 's3', relType: 'reads_writes' });
}

function tempDir(): string {
  return mkdtempSync(path.join(tmpdir(), 'nangraph-'));
}

describe('.ngb binary round-trip', () => {
  it('preserves nodes, edges and attrs', () => {
    const g = buildGraph();
    const restored = fromNgBytes(toNgBytes(g));
    expect(restored.nodeCount).toBe(4);
    expect(restored.edgeCount).toBe(3);
    expect(restored.getNode('api')?.attrs?.monthly_cost).toBe(20);
    expect(restored.getNode('lambda')?.type).toBe('aws.lambda');
  });

  it('round-trip preserves algorithms (blast radius + cost)', () => {
    const g = buildGraph();
    const restored = fromNgBytes(toNgBytes(g));
    expect(blastRadius(restored, 'api').sort()).toEqual(['ddb', 'lambda', 's3']);
    expect(costChain(restored, 'api')).toBe(70);
  });

  it('rejects bad magic', () => {
    const bad = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
    expect(() => fromNgBytes(bad)).toThrow('bad magic');
  });
});

describe('SqliteGraphStore (Node 22+ node:sqlite)', () => {
  it('save → load round-trip survives (simulates restart)', () => {
    const dir = tempDir();
    const dbPath = path.join(dir, 'graph.db');
    {
      const store = new SqliteGraphStore(dbPath);
      store.save(buildGraph());
      store.close();
    }
    {
      // fresh store = "process restart"
      const store = new SqliteGraphStore(dbPath);
      const g = store.load();
      expect(g.nodeCount).toBe(4);
      expect(g.edgeCount).toBe(3);
      expect(costChain(g, 'api')).toBe(70);
      store.close();
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it('append adds nodes/edges incrementally without losing existing', () => {
    const dir = tempDir();
    const dbPath = path.join(dir, 'append.db');
    const store = new SqliteGraphStore(dbPath);
    store.save(buildGraph());
    store.append(
      [{ id: 'cdn', type: 'aws.cloudfront', attrs: { monthly_cost: 8 } }],
      [{ from: 'cdn', to: 'api', relType: 'routes_to' }],
    );
    const g = store.load();
    expect(g.nodeCount).toBe(5);
    expect(g.edgeCount).toBe(4);
    expect(blastRadius(g, 'cdn').sort()).toEqual(['api', 'ddb', 'lambda', 's3']);
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
