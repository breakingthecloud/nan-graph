/**
 * nan-graph × tinkuy-agent — un agente de arquitectura que usa nan-graph como tools.
 *
 * El agente expone 3 tools construidas sobre NanGraph:
 *   - get_blast_radius(serviceId)  → qué servicios se caen si falla (BFS downstream)
 *   - get_cost_chain(serviceId)    → costo mensual total downstream
 *   - get_spof(threshold)          → puntos únicos de falla (fan-in alto)
 *
 * Usa un mock router (sin API key) que emula al LLM emitiendo tool_calls,
 * igual que el example 02-tool-loop de tinkuy. Swap por StyrRouter para LLM real.
 *
 * Run: node examples/tinkuy-nan-graph-agent.mjs
 */
import { Agent, defineTool } from '@carloscortezcloud/tinkuy-agent';
import { NanGraph, blastRadius, costChain, singlePointsOfFailure } from '@carloscortezcloud/nan-graph';

// ── Grafo webapp (serverless) ──────────────────────────────────────────────
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

// ── Tools de nan-graph expuestas al agente ─────────────────────────────────
const blastRadiusTool = defineTool({
  name: 'get_blast_radius',
  description: 'Servicios afectados si un servicio dado falla (blast radius).',
  parameters: {
    type: 'object',
    properties: { serviceId: { type: 'string', description: 'ID del servicio (ej. api, cdn, orders)' } },
    required: ['serviceId'],
  },
  execute: async ({ serviceId }) => {
    const radius = blastRadius(g, serviceId);
    return { serviceId, affected: radius, count: radius.length };
  },
});

const costChainTool = defineTool({
  name: 'get_cost_chain',
  description: 'Costo mensual total (USD) del servicio + todo lo downstream si falla.',
  parameters: {
    type: 'object',
    properties: { serviceId: { type: 'string', description: 'ID del servicio' } },
    required: ['serviceId'],
  },
  execute: async ({ serviceId }) => ({ serviceId, monthlyCostUsd: costChain(g, serviceId) }),
});

const spofTool = defineTool({
  name: 'get_spof',
  description: 'Puntos únicos de falla: servicios con fan-in >= threshold.',
  parameters: {
    type: 'object',
    properties: { threshold: { type: 'integer', description: 'Fan-in mínimo (default 2)' } },
  },
  execute: async ({ threshold = 2 }) => ({ spofs: singlePointsOfFailure(g, threshold) }),
});

// ── Mock router: emula al LLM con 2 turnos de tool loop ────────────────────
const phases = [
  // turno 1: pide blast radius de 'cdn'
  {
    text: 'Voy a consultar el blast radius de cdn.',
    toolCalls: [{ id: 'call_1', name: 'get_blast_radius', arguments: { serviceId: 'cdn' } }],
  },
  // turno 2: respuesta final (el resultado del tool ya llegó al modelo)
  { text: 'Si cdn falla, se ven afectados api, auth, orders, orders-db, users-db y files (6 servicios).' },
];
let phaseIdx = 0;

const mockRouter = {
  async call() {
    const phase = phases[phaseIdx] || { text: 'Done.' };
    phaseIdx++;
    return {
      text: phase.text ?? '',
      toolCalls: phase.toolCalls,
      modelUsed: 'mock-1',
      latencyMs: 50,
      usage: { promptTokens: 1, completionTokens: 1 },
    };
  },
  async *stream() {
    // Not used by run(); parity del interface Router.
  },
};

const agent = new Agent({
  router: mockRouter,
  tools: [blastRadiusTool, costChainTool, spofTool],
  systemPrompt: 'Eres un analista de arquitectura. Usa las tools de nan-graph para responder.',
  onToolCall: (event) => {
    console.log(`  [tool] ${event.tool}${event.error ? ` → error: ${event.error}` : ` → ${event.durationMs}ms`}`);
  },
});

const result = await agent.run('¿Cuál es el blast radius de cdn?');

console.log('\nFinal:', result.text);
console.log('iterations:', result.iterations);
console.log('toolsUsed:', result.toolsUsed);
console.log('toolResults:', result.toolResults.map((r) => `${r.name}=${JSON.stringify(r.result ?? r.error)}`));
