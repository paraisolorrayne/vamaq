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

## O cálculo da venda (NF 12)

Valor da venda 157.500,00; valor de aquisição 150.000,00 (NF 10).

| Campo | Na nota autorizada | Como se chega lá |
|---|---|---|
| Margem | 7.500,00 | `venda − aquisição` |
| Redução da base (pRedBC) | **95,238%** | `(1 − margem/venda) × 100`, arredondado a 3 casas |
| Base de cálculo do ICMS | **7.500,15** | `157.500,00 × 4,762%` — deriva do pRedBC arredondado |
| Alíquota | 5,00% | fixa |
| ICMS | **375,01** | `7.500,15 × 5%` |
| Base do PIS/COFINS | 7.125,14 | `base do ICMS − ICMS` |
| PIS | **46,31** | `7.125,14 × 0,65%` |
| COFINS | **213,75** | `7.125,14 × 3%` |

Os quatro valores batem ao centavo. A base do ICMS é a **margem**; ela chega ao XML como
percentual de redução porque o layout não aceita base menor que o valor do item sem
justificar.

### A leitura errada que eu cheguei a implementar (12/08/2026)

Li os 15 centavos de diferença entre a margem (7.500,00) e a base (7.500,15) como prova de
que a base ignorava a margem e vinha de uma redução fixa de 95,238% sobre a venda. Subiu
para produção assim, e estava errado.

O que eu não vi: **naquele carro a margem calhou de ser 1/21 da venda** — ele foi vendido
por exatamente `aquisição × 1,05`, e 1/21 é 4,7619%, o complemento de 95,238%. As duas
leituras reproduzem a NF 12. Os 15 centavos são só o arredondamento do pRedBC a 3 casas.

O que desempata: **95,238% não é número de lei.** Redução legal é redonda (95%, 90%, 80%);
95,238% é número calculado. E bate com o que o contador já tinha dito em julho.

**Uma nota só não distingue as hipóteses.** Confirmar com uma segunda nota autorizada de
margem diferente — até lá, `fiscal_config.icms_base_metodo` alterna entre `margem` (padrão)
e `reducao_fixa` sem tocar em código.

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
