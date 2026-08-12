# Parâmetros reais da NF-e, extraídos das notas autorizadas da Vamaq

**Data:** 2026-08-12 · **Fonte:** três DANFEs da própria Vamaq, todas com protocolo de
autorização da SEFAZ-MG. Não é interpretação de legislação: é o que a Vamaq já emitiu e
a SEFAZ já aceitou.

| | NF 12 | NF 15 | NF 14 |
|---|---|---|---|
| Operação | Venda | Entrada por compra | Entrada por consignação |
| Protocolo | 131267805126821 | 131267809172193 | 131267808285782 |
| `tipo_documento` | 1 (saída) | **0 (entrada)** | **0 (entrada)** |
| Natureza da operação | `Venda Dentro do Estado` | `Compra Dentro do Estado` | `entrada de mercadoria recebida em consignacao mercantil ou industrial` |
| CFOP | **5102** | **1102** | **1917** |
| CST (origem+CST) | **020** | **041** | **041** |
| NCM | 87032100 | 87032100 | 87032100 |
| Frete por conta | **1 — destinatário** | 1 | 1 |
| Contraparte | comprador (CPF, sem IE) | vendedor pessoa física (CPF, sem IE) | consignante (CPF, sem IE) |
| ICMS | ver abaixo | 0,00 | 0,00 |
| PIS/COFINS | ver abaixo | 0,00 | 0,00 |
| Info complementar | texto obrigatório, abaixo | vazio | vazio |

## O cálculo da venda (NF 12) — e onde nosso código erra

Valor da venda 157.500,00; valor de aquisição 150.000,00 (NF 10).

| Campo | Na nota autorizada | Como se chega lá |
|---|---|---|
| Base de cálculo do ICMS | **7.500,15** | `157.500,00 × 4,762%` — redução de base de **95,238%** sobre o valor da operação |
| Alíquota | 5,00% | fixa |
| ICMS | **375,01** | `7.500,15 × 5%` |
| Base do PIS/COFINS | 7.125,14 | `base do ICMS − ICMS` |
| PIS | **46,31** | `7.125,14 × 0,65%` |
| COFINS | **213,75** | `7.125,14 × 3%` |

Os quatro valores batem ao centavo. **O valor de aquisição não entra em nenhuma conta** —
ele aparece só no texto das informações complementares.

**O que nosso código faz hoje** (`src/lib/fiscal/payload.js`): base = `venda − aquisição`,
sem redução, sem PIS, sem COFINS. Nesse caso daria 7.500,00 — os 15 centavos de diferença
são a prova de que o método é outro. No Porsche que a Mayra tentou emitir (venda 175.000,
aquisição 165.000) a diferença deixa de ser cosmética:

| | Base ICMS | ICMS | PIS | COFINS |
|---|---|---|---|---|
| Método da nota autorizada | 8.333,50 | 416,68 | 51,46 | 237,50 |
| Nosso código hoje | 10.000,00 | 500,00 | — | — |

Emitiríamos ICMS 20% maior que o devido e sem PIS/COFINS nenhum.

## Texto das informações complementares (NF 12, literal)

```
VEICULO USADO ADQ DE VAMAQ MOTORS, CNPJ 45.348.469/0001-54 CF NF 10
VLR DE AQUISICAO R$150.000,00.
```

Precisa do **número da nota de entrada** e do **valor de aquisição** — ou seja, a nota de
saída depende da nota de entrada já existir. Isso amarra a ordem: entrada primeiro.

## Campos que hoje não mandamos e a SEFAZ exige

Descobertos um a um, em três emissões que falharam em produção (11/08/2026):

1. `icms_situacao_tributaria` com três dígitos → recusado. CST tem dois; a origem vai
   separada. *(já corrigido)*
2. `modalidade_frete` ausente → recusado. As três notas usam **1**.
3. Ainda não enviados, e presentes nas notas: `icms_reducao_base_calculo` (95,238),
   `icms_modalidade_base_calculo`, PIS e COFINS, `informacoes_adicionais_contribuinte`.
