// Servidor de exemplo: recebe o aviso em POST /webhook?k=<chave>.
// Uso: WEBHOOK_CHAVE=<chave com 16+ caracteres> node exemplo/servidor.js
const http = require('node:http');
const crypto = require('node:crypto');
const { criarWebhook } = require('../src/webhook.js');
const { criarPedidos } = require('../src/pedidos.js');

const chave = process.env.WEBHOOK_CHAVE || crypto.randomBytes(18).toString('base64url');
const pedidos = criarPedidos();
const receber = criarWebhook({ chave, pedidos });

// um pedido de exemplo esperando o Pix
pedidos.salvar({ id: 'demo-1', email: 'cliente@exemplo.com', valor: 14.9, status: 'aguardando_pagamento', criado: new Date().toISOString(), historico: [] });

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/webhook') { res.writeHead(404).end(); return; }
  let texto = '';
  for await (const parte of req) { texto += parte; if (texto.length > 100_000) { res.writeHead(413).end(); return; } }
  let corpo = {};
  try { corpo = JSON.parse(texto || '{}'); } catch (e) {}
  const r = await receber({ metodo: req.method, query: Object.fromEntries(url.searchParams), corpo });
  res.writeHead(r.status, { 'Content-Type': 'application/json' }).end(JSON.stringify(r.json));
}).listen(3000, () => {
  console.log('Ouvindo em http://localhost:3000/webhook');
  console.log(`Teste: curl -X POST "http://localhost:3000/webhook?k=${chave}" -H "Content-Type: application/json" -d "{\\"transaction\\":{\\"reference_id\\":\\"tx-1\\",\\"status\\":\\"paid\\",\\"amount\\":14.9},\\"customer\\":{\\"email\\":\\"cliente@exemplo.com\\"}}"`);
});
