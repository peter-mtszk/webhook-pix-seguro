// Recebe o aviso de pagamento Pix do gateway e atualiza o pedido.
// Só este aviso libera o acesso: o redirecionamento do navegador depois do Pix não prova a compra.
const crypto = require('node:crypto');

const PAGO = /^(paid|approved|aprovad[oa]|pago|completed|confirmed)$/i;
const ESTORNO = /^(refunded|refund|chargeback|med|estornad[oa]|reembolsad[oa])$/i;

// primeiro valor preenchido entre vários caminhos possíveis ("customer.email", "client.email"...)
const pick = (o, ...caminhos) => {
  for (const c of caminhos) { const v = c.split('.').reduce((a, k) => (a == null ? a : a[k]), o); if (v != null && v !== '') return v; }
  return null;
};
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

// compara em tempo constante: a resposta não revela quantos caracteres da chave estavam certos
function chaveOk(recebida, esperada) {
  const a = Buffer.from(String(recebida || '')), b = Buffer.from(String(esperada || ''));
  return b.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

// alguns gateways mandam o valor em centavos; os produtos custam menos de R$ 1.000, então acima disso são centavos
function reais(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n > 1000 ? n / 100 : n;
}

function criarWebhook({ chave, pedidos, agora = () => new Date() }) {
  if (!chave || chave.length < 16) throw new Error('chave do webhook ausente ou curta (mínimo 16 caracteres)');

  return async function receber({ metodo, query = {}, corpo = {} }) {
    if (metodo !== 'POST') return { status: 405, json: { ok: false } };
    if (!chaveOk(query.k, chave)) return { status: 401, json: { ok: false } };

    const d = corpo.data || corpo;
    const status = String(pick(d, 'transaction.status', 'status') || '');
    const email = String(pick(d, 'customer.email', 'client.email', 'email') || '').toLowerCase().trim();
    const transacao = String(pick(d, 'transaction.reference_id', 'transaction.id', 'id') || '');
    const valor = reais(pick(d, 'transaction.amount', 'amount'));
    // aviso sem e-mail ou sem transação não serve; responde 200 para o gateway não ficar reenviando
    if (!emailOk(email) || !transacao) return { status: 200, json: { ok: true, ignorado: true } };

    const doEmail = await pedidos.doEmail(email);
    const jaPago = doEmail.find(p => p.pagamento && p.pagamento.transacao === transacao);
    const em = agora().toISOString();

    // estorno: bloqueia o acesso do pedido daquela venda
    if (ESTORNO.test(status)) {
      if (jaPago && jaPago.status !== 'reembolsado') {
        jaPago.status = 'reembolsado';
        jaPago.historico.push({ em, evento: `estorno informado pelo gateway (${status})` });
        await pedidos.salvar(jaPago);
      }
      return { status: 200, json: { ok: true, estorno: !!jaPago } };
    }
    if (!PAGO.test(status)) return { status: 200, json: { ok: true, ignorado: true } };
    // o gateway pode mandar o mesmo aviso mais de uma vez: a mesma transação nunca paga dois pedidos
    if (jaPago) return { status: 200, json: { ok: true, repetido: true } };

    // pedido mais recente desse e-mail que ainda espera um pagamento desse valor
    const p = doEmail
      .filter(x => x.status === 'aguardando_pagamento' && (valor == null || Math.abs(x.valor - valor) < 0.01))
      .sort((a, b) => b.criado.localeCompare(a.criado))[0];
    if (!p) return { status: 200, json: { ok: true, semPedido: true } };

    p.status = 'pago';
    p.pagamento = { transacao, valor, pagoEm: em };
    p.historico.push({ em, evento: 'pagamento confirmado pelo gateway' });
    await pedidos.salvar(p);
    return { status: 200, json: { ok: true, pedido: p.id } };
  };
}

module.exports = { criarWebhook, chaveOk, reais };
