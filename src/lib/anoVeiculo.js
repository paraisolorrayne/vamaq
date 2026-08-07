/**
 * Como o ano do veículo aparece na tela: "2021" ou "2021/2022".
 *
 * Puro de propósito (sem I/O e sem imports): é usado no painel, no site
 * público e no teste, que roda em `node --test`, onde o alias "@/" não resolve.
 *
 * `year` é o ano de FABRICAÇÃO e continua sendo o único usado em filtro,
 * ordenação e slug. `ano_modelo` é opcional — sem ele, a saída é idêntica ao
 * que o sistema exibia antes desta coluna existir.
 */

export function anoVeiculo(veiculo) {
  const fabricacao = Number(veiculo?.year) || 0;
  if (!fabricacao) return "";
  const modelo = Number(veiculo?.ano_modelo) || 0;
  // Igual não repete: "2022/2022" é ruído, quem cadastrou os dois iguais
  // quis dizer "é o mesmo ano".
  if (!modelo || modelo === fabricacao) return String(fabricacao);
  return `${fabricacao}/${modelo}`;
}
