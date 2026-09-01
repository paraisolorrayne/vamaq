/**
 * Gerador de .zip mínimo, sem dependência nova.
 *
 * POR QUE ESCREVER UM: o pacote de XMLs que a loja manda para a contabilidade
 * precisa sair como um arquivo só. Trazer `archiver`/`jszip` para o projeto
 * por causa de ~90 linhas de formato estável desde 1989 não se paga — e o
 * `zlib` do Node já entrega as duas partes difíceis (deflate e CRC-32).
 *
 * O que este módulo NÃO faz, de propósito: pastas como entradas próprias
 * (o caminho no nome do arquivo já cria a pasta em qualquer descompactador),
 * zip64 (nosso pacote é de XMLs de texto, longe dos 4 GB), e senha.
 *
 * Referência do formato: APPNOTE.TXT, seções 4.3.7 (local header),
 * 4.3.12 (central directory) e 4.3.16 (end of central directory).
 */
import zlib from "node:zlib";

const ASSINATURA_LOCAL = 0x04034b50;
const ASSINATURA_CENTRAL = 0x02014b50;
const ASSINATURA_FIM = 0x06054b50;

// Bit 11 do campo de flags: diz que nome e comentário estão em UTF-8. Sem ele,
// o descompactador lê o nome em CP437 e "não" vira "nÃ£o".
const FLAG_UTF8 = 0x800;
const METODO_DEFLATE = 8;
const VERSAO = 20; // 2.0 — o mínimo que suporta deflate

/**
 * Data/hora no formato MS-DOS, que é o que o zip guarda (resolução de 2s).
 * Sem isso todo arquivo nasce com data 1980, e o contador ordena por data.
 */
function dataDos(d) {
  const hora =
    (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const data =
    ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { hora, data };
}

/**
 * Monta um .zip em memória.
 *
 * @param {{nome: string, conteudo: string|Buffer}[]} arquivos
 * @param {Date} [agora] data gravada nas entradas (injetável para teste)
 * @returns {Buffer}
 */
export function criarZip(arquivos, agora = new Date()) {
  const { hora, data } = dataDos(agora);
  const locais = [];
  const centrais = [];
  let offset = 0;

  for (const arquivo of arquivos) {
    const nome = Buffer.from(arquivo.nome, "utf8");
    const conteudo = Buffer.isBuffer(arquivo.conteudo)
      ? arquivo.conteudo
      : Buffer.from(String(arquivo.conteudo), "utf8");
    const comprimido = zlib.deflateRawSync(conteudo);
    const crc = zlib.crc32(conteudo);

    const cabecalhoLocal = Buffer.alloc(30);
    cabecalhoLocal.writeUInt32LE(ASSINATURA_LOCAL, 0);
    cabecalhoLocal.writeUInt16LE(VERSAO, 4);
    cabecalhoLocal.writeUInt16LE(FLAG_UTF8, 6);
    cabecalhoLocal.writeUInt16LE(METODO_DEFLATE, 8);
    cabecalhoLocal.writeUInt16LE(hora, 10);
    cabecalhoLocal.writeUInt16LE(data, 12);
    cabecalhoLocal.writeUInt32LE(crc, 14);
    cabecalhoLocal.writeUInt32LE(comprimido.length, 18);
    cabecalhoLocal.writeUInt32LE(conteudo.length, 22);
    cabecalhoLocal.writeUInt16LE(nome.length, 26);
    cabecalhoLocal.writeUInt16LE(0, 28); // sem campo extra

    locais.push(cabecalhoLocal, nome, comprimido);

    const cabecalhoCentral = Buffer.alloc(46);
    cabecalhoCentral.writeUInt32LE(ASSINATURA_CENTRAL, 0);
    cabecalhoCentral.writeUInt16LE(VERSAO, 4); // versão que criou
    cabecalhoCentral.writeUInt16LE(VERSAO, 6); // versão necessária
    cabecalhoCentral.writeUInt16LE(FLAG_UTF8, 8);
    cabecalhoCentral.writeUInt16LE(METODO_DEFLATE, 10);
    cabecalhoCentral.writeUInt16LE(hora, 12);
    cabecalhoCentral.writeUInt16LE(data, 14);
    cabecalhoCentral.writeUInt32LE(crc, 16);
    cabecalhoCentral.writeUInt32LE(comprimido.length, 20);
    cabecalhoCentral.writeUInt32LE(conteudo.length, 24);
    cabecalhoCentral.writeUInt16LE(nome.length, 28);
    cabecalhoCentral.writeUInt16LE(0, 30); // extra
    cabecalhoCentral.writeUInt16LE(0, 32); // comentário
    cabecalhoCentral.writeUInt16LE(0, 34); // disco
    cabecalhoCentral.writeUInt16LE(0, 36); // atributos internos
    cabecalhoCentral.writeUInt32LE(0, 38); // atributos externos
    cabecalhoCentral.writeUInt32LE(offset, 42);

    centrais.push(cabecalhoCentral, nome);
    offset += cabecalhoLocal.length + nome.length + comprimido.length;
  }

  const corpo = Buffer.concat(locais);
  const central = Buffer.concat(centrais);

  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(ASSINATURA_FIM, 0);
  fim.writeUInt16LE(0, 4); // número do disco
  fim.writeUInt16LE(0, 6); // disco do início do diretório central
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(central.length, 12);
  fim.writeUInt32LE(corpo.length, 16);
  fim.writeUInt16LE(0, 20); // sem comentário

  return Buffer.concat([corpo, central, fim]);
}
