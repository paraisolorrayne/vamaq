/**
 * Regra de quando um veículo vendido pode voltar ao estoque — o carro que a
 * Vamaq vendeu e recebeu de volta como parte do pagamento de outro.
 *
 * Pura, sem imports: usada no botão da lista do Estoque e no teste, que roda em
 * `node --test`, onde o alias "@/" não resolve. Mesmo padrão de
 * src/lib/vendaVeiculo.js, a contraparte desta regra.
 *
 * Só `vendido` volta. `disponivel` e `reservado` nunca saíram do pátio, e
 * `inativo` tem caminho próprio ("Reativar"), que NÃO abre ciclo novo:
 * desativar não é vender, e um carro desativado por engano não deve ganhar uma
 * segunda compra no histórico só por ser reativado.
 */
export function podeRetornarAoEstoque(veiculo) {
  if (!veiculo) return false;
  return veiculo.status === "vendido";
}
