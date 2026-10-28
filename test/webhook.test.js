const { test } = require('node:test');
const assert = require('node:assert/strict');
const { criarWebhook, reais } = require('../src/webhook.js');
const { criarPedidos } = require('../src/pedidos.js');

const CHAVE = 'chave-de-teste-com-32-caracteres';

async function cenario() {
  const pedidos = criarPedidos();
  await pedidos.salvar({ id: 'p1', email: 'cliente@exemplo.com', valor: 14.9, status: 'aguardando_pagamento', criado: '2026-10-01T10:00:00Z', historico: [] });
  return { pedidos, receber: criarWebhook({ chave: CHAVE, pedidos }) };
}
const aviso = (status, extra = {}) => ({
  metodo: 'POST', query: { k: CHAVE },
  corpo: { transaction: { reference_id: 'tx-123', status, amount: 14.9 }, customer: { email: 'Cliente@Exemplo.com' }, ...extra }
});

test('recusa chave errada e método diferente de POST', async () => {
  const { receber } = await cenario();
  assert.equal((await receber({ ...aviso('paid'), query: { k: 'errada' } })).status, 401);
  assert.equal((await receber({ ...aviso('paid'), query: {} })).status, 401);
  assert.equal((await receber({ ...aviso('paid'), metodo: 'GET' })).status, 405);
});

test('pagamento confirmado marca o pedido como pago', async () => {
  const { receber, pedidos } = await cenario();
  const r = await receber(aviso('paid'));
  assert.deepEqual(r, { status: 200, json: { ok: true, pedido: 'p1' } });
  const p = await pedidos.ler('p1');
  assert.equal(p.status, 'pago');
  assert.equal(p.pagamento.transacao, 'tx-123');
});

test('aviso repetido da mesma transação não paga outro pedido', async () => {
  const { receber, pedidos } = await cenario();
  await pedidos.salvar({ id: 'p2', email: 'cliente@exemplo.com', valor: 14.9, status: 'aguardando_pagamento', criado: '2026-10-02T10:00:00Z', historico: [] });
  await receber(aviso('paid'));
  const r = await receber(aviso('paid'));
  assert.equal(r.json.repetido, true);
  const pagos = (await pedidos.doEmail('cliente@exemplo.com')).filter(p => p.status === 'pago');
  assert.equal(pagos.length, 1);
});

test('estorno bloqueia o acesso do pedido pago', async () => {
  const { receber, pedidos } = await cenario();
  await receber(aviso('paid'));
  const r = await receber(aviso('refunded'));
  assert.equal(r.json.estorno, true);
  assert.equal((await pedidos.ler('p1')).status, 'reembolsado');
});

test('aviso pendente ou sem e-mail é ignorado', async () => {
  const { receber, pedidos } = await cenario();
  assert.equal((await receber(aviso('pending'))).json.ignorado, true);
  assert.equal((await receber(aviso('paid', { customer: { email: 'invalido' } }))).json.ignorado, true);
  assert.equal((await pedidos.ler('p1')).status, 'aguardando_pagamento');
});

test('valor em centavos vira reais', () => {
  assert.equal(reais(1490), 14.9);
  assert.equal(reais('14.90'), 14.9);
  assert.equal(reais(null), null);
  assert.equal(reais('abc'), null);
});

test('não aceita chave curta na configuração', () => {
  assert.throws(() => criarWebhook({ chave: 'curta', pedidos: criarPedidos() }));
});
