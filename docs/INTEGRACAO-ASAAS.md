# Integração Asaas — cobrança (boleto/PIX)

**Status:** preparada, aguardando ativação. Código pronto; falta só a Vamaq
criar a conta Asaas e colar as credenciais. Nenhuma cobrança é criada
automaticamente — quem dispara é uma ação do operador.

## O que já existe no código
- `src/lib/fin/asaas/client.js` — cliente da API Asaas (criar cliente, criar
  cobrança boleto/PIX, consultar/listar pagamentos). Sandbox por padrão.
- `src/app/api/webhooks/asaas/route.js` — recebe os eventos do Asaas (pagamento
  recebido, vencido…) e espelha em `fin.asaas_payments`. Exige token.
- `db/fin-asaas.sql` — tabela `fin.asaas_payments` (espelho das cobranças, com
  vínculo opcional a contato/lançamento/veículo).

## Para ativar (depende de você)
1. Criar conta no **Asaas** (a Vamaq). Começar em **sandbox** para testar.
2. No painel Asaas, gerar a **API Key**.
3. Definir um **token de webhook** (uma senha qualquer, sua) e cadastrar no
   Asaas o endpoint **`https://vamaqmotors.com.br/api/webhooks/asaas`** com esse
   token no header `asaas-access-token`.
4. Adicionar ao `/var/www/vamaq/.env.local` na VPS:
   ```
   ASAAS_API_KEY=<chave do Asaas>
   ASAAS_ENV=sandbox           # troque para production quando validar
   ASAAS_WEBHOOK_TOKEN=<o token que você definiu>
   ```
5. Aplicar a tabela: `psql "$DATABASE_URL_FIN" -f db/fin-asaas.sql` e
   reiniciar: `pm2 restart vamaq`.

## O que falta construir depois de ativar (decisão sua)
- Tela para **emitir cobrança** a partir de um contato/venda (usa `createPayment`).
- Lançar a **receita automaticamente** quando o webhook recebe pagamento
  (hoje o webhook só espelha — o auto-lançamento fica como próximo passo, para
  evitar contar em dobro com lançamentos manuais).
- Tela de **cobranças a vencer/vencidas** (a régua de cobrança), lendo
  `fin.asaas_payments`.

## Segurança
- A API Key fica só no `.env.local` da VPS (nunca no git).
- O webhook recusa qualquer chamada sem o token correto.
- Emitir cobrança é uma ação do operador logado — o sistema não movimenta
  dinheiro sozinho.
