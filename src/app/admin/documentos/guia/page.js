import Link from "next/link";
import styles from "../../admin.module.css";
import guia from "./guia.module.css";
import { DEFAULT_TEMPLATES } from "@/lib/contractTemplates";

export const metadata = {
  title: "Guia de Documentos — Vamaq Motors",
};

// Orientação de quando usar cada modelo, por id. Modelos novos sem entrada
// aqui ainda aparecem na lista, só sem o "quando usar".
const QUANDO_USAR = {
  "compra-venda": (
    <>
      A <strong>Vamaq COMPRA</strong> um ou mais carros de alguém — o carro{" "}
      <strong>entra</strong> no estoque. O cliente assina como{" "}
      <strong>VENDEDOR</strong>. Se a Vamaq der um carro do estoque como parte
      do pagamento, ele entra na seção de troca deste modelo.
    </>
  ),
  venda: (
    <>
      A <strong>Vamaq VENDE</strong> um carro do estoque — o carro{" "}
      <strong>sai</strong> da loja. O cliente assina como{" "}
      <strong>COMPRADOR</strong>. Se o cliente der carros dele como parte do
      pagamento, eles entram nas seções &quot;Troca — veículo recebido do
      comprador&quot;.
    </>
  ),
  consignacao: (
    <>
      O cliente <strong>deixa o carro na loja para a Vamaq vender</strong> por
      ele. O carro não é comprado nem vendido nesse momento — o cliente assina
      como <strong>CONSIGNANTE</strong>.
    </>
  ),
  "termo-vistoria": (
    <>
      Complemento da consignação: registra por escrito a{" "}
      <strong>quilometragem, o estado e as avarias</strong> do carro no dia em
      que ele é entregue na loja. Preencha junto com o Contrato de Consignação.
    </>
  ),
};

export default function GuiaDocumentosPage() {
  return (
    <div className={guia.wrap}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Guia: como gerar um documento</h1>
        <p className={styles.pageSubtitle}>
          Passo a passo para emitir contratos sem erro — do modelo certo à
          conferência final
        </p>
      </div>

      <Link href="/admin/documentos" className={styles.btnSecondary}>
        ← Voltar para Documentos
      </Link>

      <h2 className={guia.sectionTitle}>Antes de começar</h2>
      <p className={guia.lead}>
        Separe os documentos de onde os dados serão copiados. Placa, chassi,
        RENAVAM e números do CRV devem ser conferidos <strong>letra por
        letra</strong> — um caractere errado invalida a transferência.
      </p>
      <ul className={guia.checklist}>
        <li>
          <span className={guia.checkbox} />
          <span>
            <strong>CNH</strong> (ou CNPJ e contrato social, se empresa) de quem
            assina com a Vamaq;
          </span>
        </li>
        <li>
          <span className={guia.checkbox} />
          <span>
            <strong>CRLV</strong> de cada carro citado no contrato — inclusive
            os carros dados na troca;
          </span>
        </li>
        <li>
          <span className={guia.checkbox} />
          <span>
            <strong>CRV digital</strong> (documento de transferência) dos carros
            que mudam de dono, para o nº e o código de segurança;
          </span>
        </li>
        <li>
          <span className={guia.checkbox} />
          <span>
            Os <strong>valores combinados</strong> da negociação: preço de cada
            carro e quem paga diferença em dinheiro, se houver.
          </span>
        </li>
      </ul>

      <h2 className={guia.sectionTitle}>Passo a passo</h2>

      <div className={guia.step}>
        <div className={guia.stepNumber}>1</div>
        <div className={guia.stepBody}>
          <h3 className={guia.stepTitle}>
            Escolha o modelo certo — a decisão mais importante
          </h3>
          <p>
            Na tela &quot;Selecione um Modelo&quot;, pergunte:{" "}
            <strong>&quot;o carro principal do negócio sai ou entra no
            estoque da Vamaq?&quot;</strong> Os carros que o cliente dá na troca
            não mudam essa resposta — eles têm lugar próprio dentro do modelo.
          </p>
          <div className={guia.modelGrid}>
            {DEFAULT_TEMPLATES.map((t) => (
              <div key={t.id} className={guia.modelCard}>
                <div className={guia.modelName}>{t.name}</div>
                <div className={guia.modelDescription}>{t.description}</div>
                {QUANDO_USAR[t.id] && (
                  <div className={guia.modelWhen}>
                    <span className={guia.whenLabel}>Quando usar</span>
                    <br />
                    {QUANDO_USAR[t.id]}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className={guia.danger}>
            <span className={guia.boxLabel}>
              Cuidado: Compra × Venda têm nomes parecidos
            </span>
            <p>
              Escolher o modelo trocado <strong>inverte os papéis</strong>: o
              cliente sai como vendedor do carro que na verdade está comprando,
              e o contrato inteiro fica errado. Sinais de que você abriu o
              modelo trocado:
            </p>
            <p>
              • A primeira seção pede os dados <strong>da pessoa errada</strong>{" "}
              (ex.: você quer vender e a tela pede{" "}
              <span className={guia.uiField}>Vendedor — dados da CNH</span> com
              os dados do cliente);
              <br />• O carro do estoque não tem onde entrar, ou aparece espaço
              para vários carros onde deveria ser um só.
            </p>
            <p>
              Para trocar, clique em <strong>← Trocar Modelo</strong> no topo do
              formulário (ou <strong>Cancelar</strong> no fim). Nada é salvo
              antes de gerar o documento.
            </p>
          </div>
        </div>
      </div>

      <div className={guia.step}>
        <div className={guia.stepNumber}>2</div>
        <div className={guia.stepBody}>
          <h3 className={guia.stepTitle}>Use o atalho do estoque</h3>
          <p>
            No quadro{" "}
            <span className={guia.uiField}>
              Preencher dados do veículo automaticamente
            </span>
            , selecione o carro do estoque envolvido no negócio. O sistema
            preenche marca, modelo, ano, cor, combustível e quilometragem.
          </p>
          <div className={guia.warning}>
            <span className={guia.boxLabel}>O atalho não preenche tudo</span>
            <p>
              Placa, chassi, RENAVAM, nº do CRV e código de segurança{" "}
              <strong>não vêm do estoque</strong> — digite-os copiando do CRLV e
              do CRV do carro.
            </p>
          </div>
        </div>
      </div>

      <div className={guia.step}>
        <div className={guia.stepNumber}>3</div>
        <div className={guia.stepBody}>
          <h3 className={guia.stepTitle}>
            Preencha as seções na ordem da tela
          </h3>
          <p>Regras que valem para todos os modelos:</p>
          <ul>
            <li>
              Campos marcados como <strong>(opcional)</strong> podem ficar em
              branco — a parte correspondente simplesmente não entra no
              contrato;
            </li>
            <li>
              Valores em dinheiro no formato <strong>155.000,00</strong>. O
              valor por extenso é escrito sozinho pelo sistema se você deixar o
              campo de extenso vazio;
            </li>
            <li>
              Carro registrado <strong>em nome de outra pessoa ou empresa</strong>{" "}
              (terceiro)? Preencha os campos de{" "}
              <span className={guia.uiField}>Anuente</span> ou{" "}
              <span className={guia.uiField}>Proprietário registral</span> com o
              dono que consta no CRLV — é isso que protege a Vamaq na
              transferência;
            </li>
            <li>
              Leia a <strong>letra cinza abaixo de cada campo</strong>: ela
              explica quando preencher e quando deixar em branco;
            </li>
            <li>
              Na parte de <strong>situação documental e itens</strong> (multas,
              IPVA, chave reserva, estepe…), marque o que foi de fato conferido
              e entregue. Sem conferir, deixe &quot;A verificar&quot;.
            </li>
          </ul>
        </div>
      </div>

      <div className={guia.step}>
        <div className={guia.stepNumber}>4</div>
        <div className={guia.stepBody}>
          <h3 className={guia.stepTitle}>
            Troca com diferença em dinheiro? Feche a conta antes
          </h3>
          <p>
            Quando uma das partes completa a troca com dinheiro (a
            &quot;volta&quot; ou o &quot;saldo&quot;), os valores do contrato
            precisam fechar:
          </p>
          <div className={guia.math}>
            <div>
              <span>Soma dos carros dados na troca</span>
              <span>R$ 260.000</span>
            </div>
            <div>
              <span>Preço do carro principal</span>
              <span>− R$ 200.000</span>
            </div>
            <div className={guia.mathTotal}>
              <span>Diferença em dinheiro</span>
              <span>R$ 60.000</span>
            </div>
          </div>
          <ul>
            <li>
              Resultado <strong>positivo</strong>: quem entregou os carros da
              troca recebe a diferença — selecione quem paga de acordo;
            </li>
            <li>
              Resultado <strong>negativo</strong>: a outra parte paga o saldo;
            </li>
            <li>
              A diferença pode ser paga a um <strong>favorecido</strong> indicado
              (ex.: a empresa do cliente) — preencha nome, CPF/CNPJ e PIX ou
              dados bancários nos campos de favorecido.
            </li>
          </ul>
          <p>
            Os números acima são só um exemplo — use os valores reais da
            negociação e confira a soma na calculadora.
          </p>
        </div>
      </div>

      <div className={guia.step}>
        <div className={guia.stepNumber}>5</div>
        <div className={guia.stepBody}>
          <h3 className={guia.stepTitle}>Gere, confira e baixe o PDF</h3>
          <p>
            Clique em <span className={guia.uiButton}>Gerar Documento</span> e
            leia a prévia com calma antes de baixar ou imprimir. Confira na
            primeira página:
          </p>
          <ul className={guia.checklist}>
            <li>
              <span className={guia.checkbox} />
              <span>
                O <strong>título do contrato</strong> é o do negócio certo
                (Venda, Compra, Consignação ou Vistoria);
              </span>
            </li>
            <li>
              <span className={guia.checkbox} />
              <span>
                <strong>Cada parte está no papel certo</strong> — quem vende
                aparece como vendedor, quem compra como comprador;
              </span>
            </li>
            <li>
              <span className={guia.checkbox} />
              <span>
                O carro principal está no quadro{" "}
                <strong>&quot;Dados do Veículo&quot;</strong> com placa, chassi
                e RENAVAM corretos — e os carros da troca nos quadros de troca,
                cada um com seu valor;
              </span>
            </li>
            <li>
              <span className={guia.checkbox} />
              <span>
                A <strong>conta fecha</strong>: preço, valores da troca e
                diferença em dinheiro batem com o combinado;
              </span>
            </li>
            <li>
              <span className={guia.checkbox} />
              <span>
                <strong>Data e cidade</strong> no fim do contrato estão certas.
              </span>
            </li>
          </ul>
          <div className={guia.tip}>
            <span className={guia.boxLabel}>Errou? Sem problema</span>
            <p>
              Volte ao formulário, corrija só o campo errado e gere de novo —
              quantas vezes precisar. Só vale o PDF que for impresso e
              assinado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
