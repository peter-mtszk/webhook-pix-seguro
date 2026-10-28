# webhook-pix-seguro

Como recebo avisos de pagamento Pix com segurança, em Node.js puro e sem dependências.

Este código é uma versão enxuta da parte de pagamentos do meu projeto em produção, um funil de vendas com quiz ([tkxx-signos.vercel.app](https://tkxx-signos.vercel.app)). Tirei tudo o que é específico do negócio (produtos, chaves, armazenamento) e deixei as regras de segurança, com testes.

## O problema

Quando o cliente paga um Pix, o gateway avisa o meu servidor por um webhook. Esse aviso é o que libera o produto, então ele precisa ser confiável:

- qualquer pessoa pode tentar chamar a URL do webhook fingindo ser o gateway;
- o gateway pode mandar o mesmo aviso mais de uma vez;
- uma venda pode ser estornada depois de paga;
- o link de download do produto não pode ser compartilhado para sempre;
- a área do cliente pede e-mail + 4 dígitos, que dá para tentar adivinhar.

## O que o código garante

| Regra | Onde | Como |
|---|---|---|
| Só o gateway confirma pagamento | `src/webhook.js` | Chave secreta na URL, comparada com `crypto.timingSafeEqual` (tempo constante) |
| Aviso repetido não paga dois pedidos | `src/webhook.js` | A mesma transação só marca um pedido |
| Estorno bloqueia o acesso | `src/webhook.js` | O pedido pago passa para `reembolsado` |
| Valor em centavos ou reais | `src/webhook.js` | Normaliza antes de comparar com o pedido |
| Link de download expira e não pode ser alterado | `src/links.js` | Assinatura HMAC-SHA256 sobre pedido, arquivo e validade |
| Sem força bruta na área do cliente | `src/tentativas.js` | 8 tentativas erradas por e-mail bloqueiam por 1 hora; guarda só o hash do e-mail |

O redirecionamento do navegador depois do Pix **não** conta como prova de compra. Só o aviso do gateway libera o acesso.

## Como rodar

Precisa do Node.js 20 ou mais novo.

```bash
npm test
```

```
✔ recusa chave errada e método diferente de POST
✔ pagamento confirmado marca o pedido como pago
✔ aviso repetido da mesma transação não paga outro pedido
✔ estorno bloqueia o acesso do pedido pago
...
ℹ tests 12  pass 12  fail 0
```

Servidor de exemplo (porta 3000):

```bash
WEBHOOK_CHAVE=uma-chave-com-16-ou-mais-caracteres npm start
```

Ele imprime um `curl` pronto para simular o aviso de pagamento.

## Estrutura

```
src/
  webhook.js      recebe o aviso e atualiza o pedido
  links.js        links de download assinados que expiram
  tentativas.js   trava de tentativas por e-mail
  pedidos.js      armazenamento em memória (no projeto real: Vercel Blob)
exemplo/
  servidor.js     servidor HTTP mínimo usando o webhook
test/             testes com node:test
```

## O que aprendi

- Comparar segredos com `===` vaza informação pelo tempo de resposta; `timingSafeEqual` evita isso.
- Webhook precisa ser idempotente: responder 200 para avisos que não servem evita reenvios infinitos, e a transação é a chave para não pagar duas vezes.
- Testar com relógio falso (`agora`) deixa testar expiração e bloqueio sem esperar uma hora.

Usei IA (Claude Code) como apoio para escrever e revisar este código. As regras vieram dos problemas reais do meu projeto, e cada uma está coberta por teste.

## Licença

MIT
