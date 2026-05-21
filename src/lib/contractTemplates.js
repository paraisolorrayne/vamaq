export const DEFAULT_TEMPLATES = [
  {
    id: "compra-venda",
    name: "Contrato de Compra e Venda de Veículo",
    description: "Modelo padrão para compra e venda de veículos automotores",
    fields: [
      { key: "vendedor_nome", label: "Nome do Vendedor", type: "text" },
      { key: "vendedor_cpf", label: "CPF do Vendedor", type: "text" },
      { key: "vendedor_endereco", label: "Endereço do Vendedor", type: "text" },
      { key: "comprador_nome", label: "Nome do Comprador", type: "text" },
      { key: "comprador_cpf", label: "CPF do Comprador", type: "text" },
      { key: "comprador_endereco", label: "Endereço do Comprador", type: "text" },
      { key: "veiculo_marca", label: "Marca do Veículo", type: "text" },
      { key: "veiculo_modelo", label: "Modelo do Veículo", type: "text" },
      { key: "veiculo_ano", label: "Ano do Veículo", type: "text" },
      { key: "veiculo_cor", label: "Cor do Veículo", type: "text" },
      { key: "veiculo_placa", label: "Placa do Veículo", type: "text" },
      { key: "veiculo_chassi", label: "Chassi (VIN)", type: "text" },
      { key: "veiculo_renavam", label: "RENAVAM", type: "text" },
      { key: "veiculo_km", label: "Quilometragem", type: "text" },
      { key: "valor_total", label: "Valor Total (R$)", type: "text" },
      { key: "valor_extenso", label: "Valor por Extenso", type: "text" },
      { key: "forma_pagamento", label: "Forma de Pagamento", type: "text" },
      { key: "data_contrato", label: "Data do Contrato", type: "date" },
      { key: "cidade", label: "Cidade", type: "text" },
    ],
    body: `CONTRATO PARTICULAR DE COMPRA E VENDA DE VEÍCULO AUTOMOTOR

Pelo presente instrumento particular, as partes abaixo qualificadas:

VENDEDOR(A):
Nome: {{vendedor_nome}}
CPF: {{vendedor_cpf}}
Endereço: {{vendedor_endereco}}

COMPRADOR(A):
Nome: {{comprador_nome}}
CPF: {{comprador_cpf}}
Endereço: {{comprador_endereco}}

Têm entre si justo e contratado o seguinte:

CLÁUSULA PRIMEIRA – DO OBJETO
O(a) VENDEDOR(A) é legítimo(a) proprietário(a) do veículo abaixo descrito, livre e desembaraçado de quaisquer ônus:

Marca: {{veiculo_marca}}
Modelo: {{veiculo_modelo}}
Ano: {{veiculo_ano}}
Cor: {{veiculo_cor}}
Placa: {{veiculo_placa}}
Chassi: {{veiculo_chassi}}
RENAVAM: {{veiculo_renavam}}
Quilometragem: {{veiculo_km}} km

CLÁUSULA SEGUNDA – DO PREÇO E FORMA DE PAGAMENTO
O preço total da venda é de R$ {{valor_total}} ({{valor_extenso}}), a ser pago da seguinte forma: {{forma_pagamento}}.

CLÁUSULA TERCEIRA – DA TRANSFERÊNCIA
O(a) VENDEDOR(A) se compromete a entregar toda a documentação necessária para a transferência do veículo junto ao DETRAN, no prazo de até 30 (trinta) dias a contar da assinatura deste contrato.

CLÁUSULA QUARTA – DAS CONDIÇÕES DO VEÍCULO
O(a) COMPRADOR(A) declara ter examinado o veículo, estando ciente de seu estado de conservação, aceitando-o no estado em que se encontra.

CLÁUSULA QUINTA – DAS RESPONSABILIDADES
a) Todas as multas, impostos e encargos incidentes sobre o veículo até a data deste contrato são de responsabilidade do(a) VENDEDOR(A).
b) A partir da assinatura deste contrato, todas as responsabilidades passam ao(à) COMPRADOR(A).

CLÁUSULA SEXTA – DO FORO
Para dirimir quaisquer controvérsias oriundas deste contrato, as partes elegem o foro da comarca de {{cidade}}.

E por estarem assim justos e contratados, firmam o presente instrumento em 2 (duas) vias de igual teor e forma.

{{cidade}}, {{data_contrato}}.


___________________________________________
{{vendedor_nome}}
VENDEDOR(A)


___________________________________________
{{comprador_nome}}
COMPRADOR(A)`,
  },
  {
    id: "consignacao",
    name: "Contrato de Consignação de Veículo",
    description: "Modelo para consignação de veículos na loja",
    fields: [
      { key: "proprietario_nome", label: "Nome do Proprietário", type: "text" },
      { key: "proprietario_cpf", label: "CPF do Proprietário", type: "text" },
      { key: "proprietario_endereco", label: "Endereço do Proprietário", type: "text" },
      { key: "proprietario_telefone", label: "Telefone do Proprietário", type: "text" },
      { key: "veiculo_marca", label: "Marca do Veículo", type: "text" },
      { key: "veiculo_modelo", label: "Modelo do Veículo", type: "text" },
      { key: "veiculo_ano", label: "Ano do Veículo", type: "text" },
      { key: "veiculo_cor", label: "Cor do Veículo", type: "text" },
      { key: "veiculo_placa", label: "Placa do Veículo", type: "text" },
      { key: "veiculo_chassi", label: "Chassi (VIN)", type: "text" },
      { key: "veiculo_renavam", label: "RENAVAM", type: "text" },
      { key: "veiculo_km", label: "Quilometragem", type: "text" },
      { key: "valor_minimo", label: "Valor Mínimo de Venda (R$)", type: "text" },
      { key: "comissao_percentual", label: "Comissão (%)", type: "text" },
      { key: "prazo_dias", label: "Prazo de Consignação (dias)", type: "text" },
      { key: "data_contrato", label: "Data do Contrato", type: "date" },
      { key: "cidade", label: "Cidade", type: "text" },
    ],
    body: `CONTRATO DE CONSIGNAÇÃO DE VEÍCULO

Pelo presente instrumento particular de consignação, as partes:

CONSIGNANTE (Proprietário):
Nome: {{proprietario_nome}}
CPF: {{proprietario_cpf}}
Endereço: {{proprietario_endereco}}
Telefone: {{proprietario_telefone}}

CONSIGNATÁRIA:
VAMAQ MOTORS LTDA.
Endereço: [Endereço da loja]

Celebram o presente contrato de consignação, mediante as seguintes cláusulas:

CLÁUSULA PRIMEIRA – DO OBJETO
O(a) CONSIGNANTE entrega à CONSIGNATÁRIA, em regime de consignação, o seguinte veículo:

Marca: {{veiculo_marca}}
Modelo: {{veiculo_modelo}}
Ano: {{veiculo_ano}}
Cor: {{veiculo_cor}}
Placa: {{veiculo_placa}}
Chassi: {{veiculo_chassi}}
RENAVAM: {{veiculo_renavam}}
Quilometragem: {{veiculo_km}} km

CLÁUSULA SEGUNDA – DO VALOR
O valor mínimo de venda acordado é de R$ {{valor_minimo}}, sendo que a CONSIGNATÁRIA terá direito a uma comissão de {{comissao_percentual}}% sobre o valor final de venda.

CLÁUSULA TERCEIRA – DO PRAZO
O presente contrato tem prazo de {{prazo_dias}} dias corridos, podendo ser renovado por acordo mútuo entre as partes.

CLÁUSULA QUARTA – DAS OBRIGAÇÕES DA CONSIGNATÁRIA
a) Manter o veículo em local seguro e adequado;
b) Não utilizar o veículo para fins diversos da exposição e test-drive;
c) Comunicar imediatamente qualquer avaria ou sinistro;
d) Efetuar o pagamento ao CONSIGNANTE em até 5 (cinco) dias úteis após a venda.

CLÁUSULA QUINTA – DAS OBRIGAÇÕES DO CONSIGNANTE
a) Entregar o veículo em perfeito estado de conservação e funcionamento;
b) Manter a documentação do veículo regularizada;
c) Não vender, doar ou alienar o veículo durante a vigência deste contrato.

CLÁUSULA SEXTA – DA RESCISÃO
O CONSIGNANTE poderá retirar o veículo a qualquer momento, mediante aviso prévio de 48 (quarenta e oito) horas.

CLÁUSULA SÉTIMA – DO FORO
Fica eleito o foro da comarca de {{cidade}} para dirimir quaisquer dúvidas.

{{cidade}}, {{data_contrato}}.


___________________________________________
{{proprietario_nome}}
CONSIGNANTE


___________________________________________
VAMAQ MOTORS LTDA.
CONSIGNATÁRIA`,
  },
];
