// Pedidos guardados em memória. No projeto real eles ficam num armazenamento privado (Vercel Blob);
// a interface é a mesma, então os testes rodam sem nenhum serviço externo.
function criarPedidos() {
  const porId = new Map();
  return {
    async salvar(p) { porId.set(p.id, structuredClone(p)); return p; },
    async ler(id) { const p = porId.get(id); return p ? structuredClone(p) : null; },
    async doEmail(email) { return [...porId.values()].filter(p => p.email === email).map(p => structuredClone(p)); }
  };
}

module.exports = { criarPedidos };
