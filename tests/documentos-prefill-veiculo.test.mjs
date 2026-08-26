import { test } from "node:test";
import assert from "node:assert/strict";
import { camposDoVeiculo } from "../src/lib/estoque/prefillVeiculo.js";

const VEICULO = {
  brand: "Toyota",
  model: "Corolla XEi",
  year: 2021,
  ano_modelo: 2022,
  color: "Prata",
  fuel: "Flex",
  quilometragem: 45320,
  placa: "ABC1D23",
  chassi: "9BRBLWHE8J0123456",
};

test("placa e chassi do cadastro entram no contrato (era o que faltava)", () => {
  const campos = camposDoVeiculo(VEICULO);
  assert.equal(campos.veiculo_placa, "ABC1D23");
  assert.equal(campos.veiculo_chassi, "9BRBLWHE8J0123456");
});

test("ficha completa do veículo, com km em pt-BR e ano fabricação/modelo", () => {
  assert.deepEqual(camposDoVeiculo(VEICULO), {
    veiculo_marca: "Toyota",
    veiculo_modelo: "Corolla XEi",
    veiculo_ano: "2021/2022",
    veiculo_cor: "Prata",
    veiculo_combustivel: "Flex",
    veiculo_km: "45.320",
    veiculo_placa: "ABC1D23",
    veiculo_chassi: "9BRBLWHE8J0123456",
  });
});

test("prefixo troca: o mesmo veículo preenche a ficha da troca", () => {
  const campos = camposDoVeiculo(VEICULO, "troca");
  assert.equal(campos.troca_placa, "ABC1D23");
  assert.equal(campos.troca_chassi, "9BRBLWHE8J0123456");
  assert.equal(campos.troca_marca, "Toyota");
  assert.equal(campos.veiculo_placa, undefined);
});

test("campo em branco no cadastro não entra — não apaga o que já foi digitado", () => {
  const campos = camposDoVeiculo({ brand: "Fiat", model: "Toro", placa: "", chassi: null });
  assert.deepEqual(campos, { veiculo_marca: "Fiat", veiculo_modelo: "Toro" });
});

test("km zero não vira '0' na ficha — km não cadastrado é campo vazio", () => {
  const campos = camposDoVeiculo({ brand: "Fiat", quilometragem: 0 });
  assert.equal(campos.veiculo_km, undefined);
});

test("placa e chassi saem em maiúsculas e sem espaço sobrando", () => {
  const campos = camposDoVeiculo({ placa: " abc1d23 ", chassi: " 9brblwhe8j0123456 " });
  assert.equal(campos.veiculo_placa, "ABC1D23");
  assert.equal(campos.veiculo_chassi, "9BRBLWHE8J0123456");
});

test("sem veículo: nada a preencher, e não quebra", () => {
  assert.deepEqual(camposDoVeiculo(null), {});
  assert.deepEqual(camposDoVeiculo(undefined), {});
  assert.deepEqual(camposDoVeiculo({}), {});
});
