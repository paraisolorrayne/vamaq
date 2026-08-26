/**
 * Do veículo cadastrado no estoque para os campos do contrato.
 *
 * Contraparte de clientes/prefill.js: lá o cliente preenche a ficha do
 * vendedor/comprador, aqui o carro preenche a ficha do veículo. Placa e
 * chassi entram — são justamente os dois campos que o cadastro guarda e que
 * ninguém quer redigitar (nem errar) na hora do contrato.
 *
 * Puro de propósito (sem I/O): usado direto no teste, que roda em
 * `node --test`, onde o alias "@/" não resolve — por isso o import abaixo é
 * relativo e com extensão.
 */
import { anoVeiculo } from "../anoVeiculo.js";

function texto(valor) {
  return String(valor ?? "").trim();
}

/**
 * Campos a preencher no formulário do contrato. Campo vazio no cadastro NÃO
 * entra: quem já digitou à mão não pode ver o dado sumir ao escolher o carro.
 *
 * `prefixo` escolhe a ficha: "veiculo" (o carro da negociação) ou "troca"
 * (o carro do estoque dado como pagamento, no contrato de compra).
 */
export function camposDoVeiculo(veiculo, prefixo = "veiculo") {
  const v = veiculo || {};
  const km = Number(v.quilometragem) || 0;

  const candidatos = {
    [`${prefixo}_marca`]: texto(v.brand),
    [`${prefixo}_modelo`]: texto(v.model),
    [`${prefixo}_ano`]: anoVeiculo(v),
    [`${prefixo}_cor`]: texto(v.color),
    [`${prefixo}_combustivel`]: texto(v.fuel),
    [`${prefixo}_km`]: km ? km.toLocaleString("pt-BR") : "",
    // Maiúsculas para bater com o cadastro (vehicleStore normaliza assim) e
    // com o CRLV, que é onde o executor do contrato confere letra por letra.
    [`${prefixo}_placa`]: texto(v.placa).toUpperCase(),
    [`${prefixo}_chassi`]: texto(v.chassi).toUpperCase(),
  };

  const campos = {};
  for (const [chave, valor] of Object.entries(candidatos)) {
    if (valor) campos[chave] = valor;
  }
  return campos;
}
