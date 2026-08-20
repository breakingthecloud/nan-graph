/**
 * nan-graph storage — persistence layer (Ñan-004).
 *
 * Dos backends opcionales sobre el mismo core in-memory:
 *   N2 · `.ngb` binario nativo  — snapshot/restore round-trip portable (msgpack)
 *   N3 · SQLite embebido        — save/load/append incremental (node:sqlite, Node 22+)
 *
 * El core (NanGraph) queda intacto: el storage serializa/deserializa el mismo
 * modelo (GraphNode/GraphEdge). Sin storage, nan-graph funciona igual.
 */
import { encode, decode } from '@msgpack/msgpack';
import { NanGraph } from './graph.js';
import { writeFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { GraphNode, GraphEdge } from './types.js';

const require = createRequire(import.meta.url);

const NGB_MAGIC = 'NGPH';
const NGB_VERSION = 1;

export interface NgSnapshot {
  format: 'nan-graph';
  version: number;
  nodes: Array<Omit<GraphNode, 'id'> & { id: string }>;
  edges: GraphEdge[];
}

function serializeNode(n: GraphNode): Omit<GraphNode, 'id'> & { id: string } {
  return { id: n.id, label: n.label, type: n.type, attrs: n.attrs };
}

function toSnapshot(graph: NanGraph): NgSnapshot {
  return {
    format: 'nan-graph',
    version: NGB_VERSION,
    nodes: [...graph.nodes.values()].map(serializeNode),
    edges: graph.edges,
  };
}

function fromSnapshot(snap: NgSnapshot): NanGraph {
  const g = new NanGraph();
  for (const n of snap.nodes) g.addNode(n);
  for (const e of snap.edges) g.addEdge(e);
  return g;
}

// ── N2 · Formato binario .ngb (msgpack) ─────────────────────────────────────

/** Serializa el grafo a bytes `.ngb` (header mágico + msgpack del snapshot). */
export function toNgBytes(graph: NanGraph): Uint8Array {
  const payload = encode(toSnapshot(graph));
  const raw = payload.byteLength;
  const out = new Uint8Array(NGB_MAGIC.length + 4 + raw);
  const dv = new DataView(out.buffer);
  for (let i = 0; i < NGB_MAGIC.length; i++) out[i] = NGB_MAGIC.charCodeAt(i);
  dv.setUint32(NGB_MAGIC.length, raw, false);
  out.set(payload, NGB_MAGIC.length + 4);
  return out;
}

/** Deserializa bytes `.ngb` a un NanGraph (valida magic + version). */
export function fromNgBytes(bytes: Uint8Array): NanGraph {
  if (bytes.length < NGB_MAGIC.length + 4) {
    throw new Error('Invalid .ngb: too short');
  }
  for (let i = 0; i < NGB_MAGIC.length; i++) {
    if (bytes[i] !== NGB_MAGIC.charCodeAt(i)) throw new Error('Invalid .ngb: bad magic');
  }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const len = dv.getUint32(NGB_MAGIC.length, false);
  const payload = bytes.slice(NGB_MAGIC.length + 4, NGB_MAGIC.length + 4 + len);
  const snap = decode(payload) as NgSnapshot;
  if (snap.format !== 'nan-graph') throw new Error('Invalid .ngb: wrong format');
  if (snap.version !== NGB_VERSION) throw new Error(`Unsupported .ngb version: ${snap.version}`);
  return fromSnapshot(snap);
}

/** Escribe el grafo como `.ngb` a un archivo. */
export function saveNg(graph: NanGraph, path: string): void {
  writeFileSync(path, toNgBytes(graph));
}

/** Lee un `.ngb` desde archivo. */
export function loadNg(path: string): NanGraph {
  return fromNgBytes(readFileSync(path));
}

// ── N3 · Storage SQLite embebido (node:sqlite, Node 22+) ────────────────────

export interface SqliteStorageOptions {
  /** Modo WAL para batch writes atómicos (default true). */
  wal?: boolean;
}

/**
 * Storage SQLite embebido sobre un archivo `.db`. Utiliza `node:sqlite` (builtin
 * desde Node 22). Requiere Node >= 22; si no está disponible lanza un error claro.
 */
export class SqliteGraphStore {
  private db: any;

  constructor(path: string, opts: SqliteStorageOptions = {}) {
    const { DatabaseSync } = require('node:sqlite');
    this.db = new DatabaseSync(path);
    if (opts.wal !== false) this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        type TEXT,
        label TEXT,
        attrs_json TEXT
      );
      CREATE TABLE IF NOT EXISTS edges (
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        rel_type TEXT NOT NULL,
        label TEXT,
        weight REAL
      );
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_id);
      CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_id);
      CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
    `);
  }

  /** Inserta/actualiza el grafo completo (upsert). */
  save(graph: NanGraph): void {
    this.db.exec('BEGIN');
    try {
      this.db.exec('DELETE FROM edges');
      this.clearNodes();
      const insNode = this.db.prepare(
        'INSERT OR REPLACE INTO nodes(id, type, label, attrs_json) VALUES(?, ?, ?, ?)',
      );
      const insEdge = this.db.prepare(
        'INSERT INTO edges(from_id, to_id, rel_type, label, weight) VALUES(?, ?, ?, ?, ?)',
      );
      for (const n of graph.nodes.values()) {
        insNode.run(n.id, n.type ?? null, n.label ?? null, JSON.stringify(n.attrs ?? {}));
      }
      for (const e of graph.edges) {
        insEdge.run(e.from, e.to, e.relType, e.label ?? null, null);
      }
      this.db.prepare('INSERT OR REPLACE INTO meta(key, value) VALUES(?, ?)').run(
        'source',
        'nan-graph',
      );
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  /** Hidrata un NanGraph desde la base. */
  load(): NanGraph {
    const g = new NanGraph();
    const rowToNode = (row: any): GraphNode => ({
      id: row.id,
      type: row.type ?? undefined,
      label: row.label ?? undefined,
      attrs: row.attrs_json ? JSON.parse(row.attrs_json) : {},
    });
    for (const row of this.db.prepare('SELECT id, type, label, attrs_json FROM nodes').all()) {
      g.addNode(rowToNode(row));
    }
    for (const row of this.db.prepare('SELECT from_id, to_id, rel_type, label FROM edges').all()) {
      g.addEdge({ from: row.from_id, to: row.to_id, relType: row.rel_type, label: row.label ?? undefined });
    }
    return g;
  }

  /** Agrega nodos/aristas de forma incremental sin borrar lo existente. */
  append(nodes: GraphNode[], edges: GraphEdge[]): void {
    this.db.exec('BEGIN');
    try {
      const insNode = this.db.prepare(
        'INSERT OR REPLACE INTO nodes(id, type, label, attrs_json) VALUES(?, ?, ?, ?)',
      );
      const insEdge = this.db.prepare(
        'INSERT INTO edges(from_id, to_id, rel_type, label, weight) VALUES(?, ?, ?, ?, ?)',
      );
      for (const n of nodes) {
        insNode.run(n.id, n.type ?? null, n.label ?? null, JSON.stringify(n.attrs ?? {}));
      }
      for (const e of edges) {
        insEdge.run(e.from, e.to, e.relType, e.label ?? null, null);
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  private clearNodes(): void {
    this.db.exec('DELETE FROM nodes');
  }

  close(): void {
    this.db.close();
  }
}
