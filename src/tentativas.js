// Trava por e-mail: depois de 8 tentativas erradas, bloqueia por 1 hora.
// Na área do cliente o acesso pede e-mail + 4 últimos dígitos; a trava impede adivinhar os dígitos por força bruta.
const crypto = require('node:crypto');

function criarTrava({ maximo = 8, janelaMs = 3600e3, agora = Date.now } = {}) {
  const mapa = new Map();   // guarda só o hash do e-mail, nunca o e-mail
  const h = e => crypto.createHash('sha256').update(String(e).toLowerCase().trim()).digest('hex');
  const atual = e => {
    const t = mapa.get(h(e));
    return !t || agora() - t.desde > janelaMs ? { n: 0, desde: agora() } : t;
  };

  return {
    bloqueado: e => atual(e).n >= maximo,
    errou(e) { const t = atual(e); t.n++; mapa.set(h(e), t); return t.n; }
  };
}

module.exports = { criarTrava };
