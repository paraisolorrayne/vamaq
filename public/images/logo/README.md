# Logo da Vamaq em PNG e JPG

Exportados dos SVG de `public/images/` em 16/08/2026. O SVG continua sendo o
original — é ele que o site usa e é dele que estes arquivos saem. Se a marca
mudar, mude o SVG e exporte de novo.

| Arquivo | Para quê |
|---|---|
| `vamaq-logo.png` | Logo sobre **fundo claro**. Fundo transparente. |
| `vamaq-logo-fundo-escuro.png` | Logo sobre **fundo escuro** (o “MOTORS” é branco). Fundo transparente. |
| `vamaq-logo.jpg` | Mesmo logo com **fundo branco**, para onde não aceita transparência. |
| `vamaq-logo-fundo-escuro.jpg` | Logo com o **fundo escuro da marca** (`#14131c`). |
| `vamaq-simbolo.png` | Só o símbolo, transparente — marca d’água, ícone, carimbo. |
| `vamaq-perfil.jpg` | Quadrado 1000×1000 para **foto de perfil** (WhatsApp, Instagram, Google). |

## Qual escolher

- **PNG** quando o fundo precisa aparecer atrás do logo (documento, arte, site).
- **JPG** quando o lugar não aceita transparência — e aceitar um JPG de fundo
  branco sobre uma arte escura deixa um retângulo branco em volta. Nesse caso
  use o PNG.
- Em fundo escuro, use a versão `fundo-escuro`: no logo normal o “MOTORS” é
  preto e some.

## Como foram gerados

Rasterizados com `sharp` a 600 dpi, recortados na borda da arte (`trim`) e com
margem uniforme de volta, para todos ficarem alinhados quando usados juntos.

O `vamaq-simbolo.png` sai do recorte do logo em fundo escuro, nos limites reais
da arte do símbolo (viewBox `1215 404 340 266`). Um recorte mais largo puxa um
fragmento da letra “A” do VAMAQ para dentro da imagem — aconteceu na primeira
exportação e só apareceu olhando o arquivo.
