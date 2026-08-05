# Vincular um login existente pela ficha do funcionário

**Data:** 2026-08-05 · **Status:** aprovado, pronto para plano de implementação

## Problema

O módulo de funcionários entrou no ar em 04/08/2026 com os logins do Mateus, da
Louanny e do Victor **já criados** — eles existem desde antes da feature. A ficha
do funcionário, porém, só sabe **criar** um acesso novo: o bloco "Acesso ao
sistema" oferece um único caminho, o formulário que gera login e senha
temporária.

Para ligar um login que já existe, hoje é preciso sair da ficha, ir em
`/admin/usuarios` e usar o seletor da coluna Funcionário. Funciona, mas obriga a
conhecer um caminho que não está onde a pessoa está olhando — e é exatamente o
caso de todo mundo que já trabalhava na loja quando a feature subiu.

## Decisões tomadas

| Questão | Decisão |
|---|---|
| Onde | No bloco "Acesso ao sistema" da ficha, ao lado do formulário de criar. |
| Quais logins aparecem | Só os que ainda não estão ligados a nenhuma ficha. |
| Desvincular pela ficha | **Não.** Desfazer continua em `/admin/usuarios`, onde já funciona. |
| Banco | Nada novo — `setUserFuncionario` e o índice `users_funcionario_idx` já existem. |

Descartado: permitir vincular e desvincular pela ficha. Simetria seria cômoda,
mas põe uma ação destrutiva ao lado dos dados pessoais, e é justamente o vínculo
que garante o corte de acesso no desligamento.

## Comportamento

No bloco "Acesso ao sistema" da ficha:

- **Sem login vinculado, havendo logins livres:** aparece um seletor com esses
  logins (e-mail e papel) e um botão **Vincular**; abaixo, separado, o formulário
  de **criar acesso novo** que já existe.
- **Sem login vinculado e sem logins livres:** só o formulário de criar, como
  hoje.
- **Com login vinculado:** o bloco não muda — mostra e-mail, papel, o aviso de
  readmissão quando cabe, e o link para Usuários.

O botão Vincular fica desabilitado enquanto nada estiver selecionado. Como a
regra `:disabled` entrou no CSS compartilhado em 05/08, "desabilitado" agora
aparece como desabilitado.

## Implementação

- `src/app/admin/funcionarios/[id]/page.js` passa a carregar também os logins
  sem ficha: `listUsers()` filtrado por `funcionario_id === null`, entregue ao
  client como `usuariosLivres`.
- `src/app/admin/funcionarios/actions.js` ganha
  `vincularUsuarioAction(funcionarioId, userId)`: `await requireRole("admin")`,
  chama `setUserFuncionario`, e trata a violação de `users_funcionario_idx` com
  a mesma mensagem que `/admin/usuarios` já usa — "Essa ficha já está ligada a
  outro login." Revalida `/admin/funcionarios/<id>` e `/admin/usuarios`.
- `src/app/admin/funcionarios/[id]/FichaClient.js` renderiza o seletor e o botão
  no bloco existente, sem tocar no resto da tela.

## Erros

- Ficha ligada a outro login entre o carregamento e o clique (duas abas): a
  constraint do banco estoura, a action devolve a mensagem amigável e a tela a
  exibe no bloco de erro que já existe.
- Nenhum login selecionado: botão desabilitado, sem chamada ao servidor.

## Testes

O contrato crítico — um login por ficha — já está coberto pelo teste de banco em
`tests/rh-schema.test.mjs`, que prova que o índice único rejeita o segundo
vínculo. Não há harness de teste de componente React no projeto e criar um está
fora de escopo. Verificação: `npm test` (49 verdes), `npm run build`, e
conferência no navegador com banco local — que é onde os defeitos de tela
aparecem.
