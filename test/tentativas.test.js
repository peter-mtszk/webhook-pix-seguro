const { test } = require('node:test');
const assert = require('node:assert/strict');
const { criarTrava } = require('../src/tentativas.js');

test('bloqueia depois de 8 erros e libera depois de 1 hora', () => {
  let t = 0;
  const trava = criarTrava({ agora: () => t });
  for (let i = 0; i < 7; i++) trava.errou('cliente@exemplo.com');
  assert.equal(trava.bloqueado('cliente@exemplo.com'), false);
  trava.errou('Cliente@Exemplo.com');   // maiúsculas contam como o mesmo e-mail
  assert.equal(trava.bloqueado('cliente@exemplo.com'), true);
  t += 3600e3 + 1;
  assert.equal(trava.bloqueado('cliente@exemplo.com'), false);
});

test('cada e-mail tem a sua própria contagem', () => {
  const trava = criarTrava({ maximo: 2 });
  trava.errou('a@exemplo.com'); trava.errou('a@exemplo.com');
  assert.equal(trava.bloqueado('a@exemplo.com'), true);
  assert.equal(trava.bloqueado('b@exemplo.com'), false);
});
