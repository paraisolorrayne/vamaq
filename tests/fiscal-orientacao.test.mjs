/**
 * Todo erro de nota tem próximo passo na tela.
 *
 * POR QUE (24/08/2026, pedido da Lorrayne): a cada erro a Mayra parava e
 * perguntava, e a resposta subia a cadeia inteira. O sistema precisa dizer
 * sozinho o que fazer — senão quem o construiu vira plantão vitalício.
 *
 * A regra mais importante deste módulo é a do PADRÃO: mensagem que ninguém
 * previu não pode deixar a operadora sem saída. Ela manda levar o texto à
 * contabilidade, que é quem lê a linguagem da SEFAZ.
 *
 * E nada aqui pode citar o nome do contador: contador muda, e o sistema não
 * pode precisar de deploy por causa disso.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { orientacaoDoErro, DONO } from "../src/lib/fiscal/orientacao.js";

test("erro desconhecido ainda assim diz o que fazer", () => {
  const o = orientacaoDoErro("Rejeicao 774: algo que nunca vimos antes");
  assert.equal(o.reconhecido, false);
  assert.match(o.oQueFazer, /contabilidade/i);
  assert.ok(o.resumo.length > 0);
  assert.ok(o.rotuloDono, "sempre tem um rótulo de a quem levar");
});

test("mensagem vazia ou nula não quebra e ainda orienta", () => {
  for (const m of ["", "   ", null, undefined]) {
    const o = orientacaoDoErro(m);
    assert.ok(o.oQueFazer.length > 0, `sem orientação para ${JSON.stringify(m)}`);
    assert.equal(o.reconhecido, false);
  }
});

test("duplicidade é apontada como problema do sistema, não da operadora", () => {
  // Foi o erro do Cayenne. A Mayra passou dias achando que era preenchimento.
  const o = orientacaoDoErro(
    "Rejeicao: Duplicidade de NF-e, com diferenca na Chave de Acesso[chNFe: 31260745...]"
  );
  assert.equal(o.dono, DONO.SUPORTE);
  assert.match(o.oQueFazer, /não é erro de preenchimento/i);
});

test("prazo de cancelamento vencido aponta a carta de correção", () => {
  // O caso da NF 17, num sábado, com o escritório fechado.
  const o = orientacaoDoErro("Rejeicao: Prazo de cancelamento expirado");
  assert.equal(o.dono, DONO.CONTABILIDADE);
  assert.match(o.oQueFazer, /carta de corre[cç][aã]o/i);
});

test("parâmetro fiscal vai para a contabilidade, não para a operadora", () => {
  for (const m of [
    'Situacao tributaria (ICMS) invalida: "020"',
    "CFOP invalido para a operacao",
    "Aliquota de ICMS incompativel",
  ]) {
    const o = orientacaoDoErro(m);
    assert.equal(o.dono, DONO.CONTABILIDADE, m);
  }
});

test("campo faltando e campo longo demais são da operadora", () => {
  assert.equal(
    orientacaoDoErro("modalidade_frete: Modalidade frete não pode ser vazio").dono,
    DONO.OPERACAO
  );
  assert.equal(
    orientacaoDoErro("natOp: [facet 'maxLength'] The value has a length of '69'").dono,
    DONO.OPERACAO
  );
});

test("SEFAZ fora do ar é só esperar — e a tela diz que nada se perdeu", () => {
  const o = orientacaoDoErro("Servico Paralisado Temporariamente");
  assert.equal(o.dono, DONO.ESPERAR);
  assert.match(o.oQueFazer, /não é erro seu|nada foi perdido/i);
});

test("defeito nosso é chamado de defeito nosso", () => {
  // "Endpoint não encontrado" foi o cancelamento quebrado. A Mayra não tinha
  // como saber que a culpa não era dela.
  const o = orientacaoDoErro(
    "Endpoint não encontrado, verifique a documentação desta API em https://doc.focusnfe.com.br/"
  );
  assert.equal(o.dono, DONO.SUPORTE);
  assert.match(o.oQueFazer, /defeito do sistema/i);
  assert.match(o.oQueFazer, /nada foi emitido/i);
});

test("o texto original sempre volta — é dele que a contabilidade precisa", () => {
  const cru = "Rejeicao 999: mensagem tecnica qualquer";
  assert.equal(orientacaoDoErro(cru).mensagemOriginal, cru);
});

test("nenhuma orientação cita o nome de um contador", () => {
  // Agnóstico por decisão: contador muda, e trocar de contador não pode exigir
  // deploy. O teste varre todas as saídas possíveis.
  const amostras = [
    "Duplicidade de NF-e", "Prazo de cancelamento expirado",
    'Situacao tributaria (ICMS) invalida: "020"', "maxLength on natOp",
    "campo obrigatorio ausente", "certificado vencido",
    "inscricao estadual invalida", "Servico Paralisado",
    "Endpoint não encontrado", "401 unauthorized", "coisa nunca vista",
  ];
  for (const m of amostras) {
    const o = orientacaoDoErro(m);
    const tudo = `${o.resumo} ${o.oQueFazer} ${o.rotuloDono}`;
    assert.doesNotMatch(tudo, /rodrigo|mateus|lorrayne|mayra/i, `citou nome em: ${m}`);
  }
});

test("toda orientação tem resumo, ação e dono preenchidos", () => {
  const amostras = ["Duplicidade", "prazo de cancelamento", "cst invalida", "", "xyz"];
  for (const m of amostras) {
    const o = orientacaoDoErro(m);
    assert.ok(o.resumo?.length > 10, `resumo fraco em "${m}"`);
    assert.ok(o.oQueFazer?.length > 20, `ação fraca em "${m}"`);
    assert.ok(Object.values(DONO).includes(o.dono), `dono inválido em "${m}"`);
  }
});
