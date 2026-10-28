const { test } = require('node:test');
const assert = require('node:assert/strict');
const { criarLinks } = require('../src/links.js');

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';

test('link assinado vale até expirar', () => {
  let t = 1_000_000;
  const links = criarLinks(SEGREDO, { agora: () => t });
  const l = links.gerar('p1', 'ebook', 2 * 3600e3);
  assert.equal(links.conferir(l), true);
  t += 2 * 3600e3 + 1;
  assert.equal(links.conferir(l), false);
});

test('trocar pedido, arquivo ou validade invalida a assinatura', () => {
  const links = criarLinks(SEGREDO);
  const l = links.gerar('p1', 'ebook', 3600e3);
  assert.equal(links.conferir({ ...l, p: 'p2' }), false);
  assert.equal(links.conferir({ ...l, a: 'outro' }), false);
  assert.equal(links.conferir({ ...l, x: l.x + 3600e3 }), false);
  assert.equal(links.conferir({ ...l, s: 'x' }), false);
});

test('segredo curto é recusado', () => {
  assert.throws(() => criarLinks('curto'));
});
