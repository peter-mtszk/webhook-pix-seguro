// Links de download assinados com HMAC-SHA256 que expiram.
// O link carrega pedido, arquivo e validade; a assinatura impede trocar qualquer um deles.
const crypto = require('node:crypto');

function criarLinks(segredo, { agora = Date.now } = {}) {
  if (!segredo || segredo.length < 32) throw new Error('segredo ausente ou curto (mínimo 32 caracteres)');
  const assinar = partes => crypto.createHmac('sha256', segredo).update(partes.join('|')).digest('base64url');

  return {
    gerar(pedido, arquivo, validadeMs) {
      const x = agora() + validadeMs;
      return { p: pedido, a: arquivo, x, s: assinar([pedido, arquivo, x]) };
    },
    conferir({ p, a, x, s }) {
      if (!(Number(x) > agora())) return false;   // expirado (ou validade inválida)
      const esperado = Buffer.from(assinar([p, a, Number(x)])), recebido = Buffer.from(String(s || ''));
      return esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido);
    }
  };
}

module.exports = { criarLinks };
