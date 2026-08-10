/**
 * Regra de quando um veículo pode ser marcado como vendido pelo Estoque
 * (venda de balcão — ver docs/superpowers/specs/2026-08-10-marcar-vendido-design.md).
 *
 * Pura, sem imports: usada tanto no botão da lista/tela do Estoque quanto no
 * teste, que roda em `node --test`, onde o alias "@/" não resolve. Mesmo
 * padrão de src/lib/anoVeiculo.js e src/lib/crm/etapas.js.
 *
 * Verdadeiro só quando o veículo existe e não está `vendido` (já foi
 * vendido — vendê-lo de novo duplicaria a nota/o vínculo) nem `inativo`
 * (fora do ciclo de vida ativo; reative no Estoque antes de vender).
 * `disponivel` e `reservado` passam.
 */
export function podeMarcarVendido(veiculo) {
  if (!veiculo) return false;
  if (veiculo.status === "vendido") return false;
  if (veiculo.status === "inativo") return false;
  return true;
}
