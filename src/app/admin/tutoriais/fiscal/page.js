import Link from "next/link";
import styles from "../../admin.module.css";
import t from "../tutorial.module.css";

export const metadata = {
  title: "Tutorial: Notas Fiscais — Vamaq Motors",
};

export default function TutorialFiscalPage() {
  return (
    <div className={t.wrap}>
      <Link href="/admin/tutoriais" className={t.backLink}>
        ← Todos os tutoriais
      </Link>

      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          Notas Fiscais: emitir a NF-e da venda
        </h1>
        <p className={styles.pageSubtitle}>
          A nota fiscal (modelo 55) do veículo vendido, emitida direto do
          painel — acesso de administrador, financeiro e secretaria
        </p>
      </div>

      <h2 className={t.sectionTitle}>Passo a passo</h2>

      <div className={t.step}>
        <div className={t.stepNumber}>1</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>De onde a nota nasce</h3>
          <p>
            Não existe um botão &quot;nova nota&quot; em branco. A nota nasce
            do <strong>veículo vendido</strong>, e há dois caminhos reais
            para marcar essa venda — use o que combina com a origem dela:
          </p>
          <ul>
            <li>
              <strong>Veio de um lead, pelo CRM</strong>: avance a
              oportunidade até <span className={t.uiField}>Ganho</span> e use{" "}
              <span className={t.uiButton}>Registrar a venda</span>.
            </li>
            <li>
              <strong>Venda de balcão, sem lead no CRM</strong>: no{" "}
              <span className={t.uiField}>Estoque</span>, use{" "}
              <span className={t.uiButton}>Marcar vendido</span> no carro
              (veja o{" "}
              <Link href="/admin/tutoriais/estoque">tutorial de Estoque</Link>).
            </li>
          </ul>
          <p>
            Nos dois casos o carro vira <strong>vendido</strong> e aparece na
            lista <span className={t.uiField}>Veículo vendido</span>, aqui em{" "}
            <span className={t.uiField}>Notas Fiscais</span>. Escolha o carro
            e use <span className={t.uiButton}>Emitir nota</span> — isso abre
            a tela de conferência daquele veículo específico.
          </p>
          <p>
            O veículo precisa ter <strong>chassi</strong> cadastrado. Sem
            ele, a tela de emissão avisa e o botão de emitir fica bloqueado —
            complete o cadastro do veículo no Estoque antes de tentar de
            novo.
          </p>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>2</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Conferir os valores</h3>
          <p>
            A tela mostra <span className={t.uiField}>Valor da venda</span> e{" "}
            <span className={t.uiField}>Valor de aquisição</span>. Os impostos
            são calculados sozinhos e aparecem logo abaixo: a base do{" "}
            <strong>ICMS do seminovo</strong> é a <strong>margem</strong> (venda −
            aquisição), e <strong>PIS e COFINS</strong> incidem sobre essa base
            menos o ICMS. Tudo com as alíquotas que o contador configurou.
          </p>
          <div className={t.warning}>
            <span className={t.boxLabel}>O valor de aquisição é a base do imposto</span>
            <p>
              Errar esse valor <strong>erra o imposto da nota</strong>: quanto
              maior a aquisição, menor a margem e menor o ICMS. Ele também vai
              impresso nas <strong>informações complementares</strong>, o texto
              que diz de onde o carro veio — a tela mostra esse texto pronto,
              antes de emitir.
            </p>
            <p>
              Quando o financeiro <strong>já tem a compra deste carro
              lançada</strong>, o campo aparece cinza e travado: o valor usado é
              sempre o do financeiro, <strong>o que estiver digitado ali é
              ignorado</strong>. Só quando não há compra lançada é que o campo
              fica editável — e aí é obrigatório, senão a nota sai sem essa
              informação.
            </p>
          </div>
          <div className={t.warning}>
            <span className={t.boxLabel}>Nº da nota de entrada</span>
            <p>
              Campo opcional. Se este carro já tem uma <strong>nota de
              entrada</strong> emitida, coloque o número dela: o texto das
              informações complementares passa a citar a nota, que é como as
              notas da Vamaq já saíam. Sem o número, o texto sai só com o valor
              de aquisição.
            </p>
          </div>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>3</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>O destinatário</h3>
          <p>
            Em <span className={t.uiField}>Cliente cadastrado</span>,
            escolher um nome preenche sozinhos os oito campos do
            destinatário (nome, CPF/CNPJ, CEP, logradouro, número, bairro,
            município, UF), vindos do{" "}
            <Link href="/admin/clientes">cadastro de clientes</Link>. Se o
            comprador não estiver cadastrado, preencha os campos à mão.
          </p>
          <div className={t.tip}>
            <span className={t.boxLabel}>Confira antes de emitir</span>
            <p>
              O que vai para a SEFAZ é o que estiver <strong>na
              tela</strong> no momento de emitir, não o que está no cadastro
              do cliente. Revise os oito campos mesmo depois de preenchidos
              sozinhos.
            </p>
          </div>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>4</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Emitir e acompanhar o status</h3>
          <p>
            Confirme em <span className={t.uiButton}>Emitir nota
            fiscal</span>. Ela entra como <strong>processando</strong>; use{" "}
            <span className={t.uiField}>Atualizar</span>, na lista de{" "}
            <Link href="/admin/fiscal">Notas Fiscais</Link>, para consultar
            o retorno da SEFAZ. Quando fica <strong>autorizada</strong>, os
            links de <span className={t.uiField}>DANFE</span> e{" "}
            <span className={t.uiField}>XML</span> aparecem na mesma linha.
          </p>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>5</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Cancelar</h3>
          <p>
            Na nota autorizada, <span className={t.uiField}>Cancelar</span>{" "}
            pede uma justificativa com pelo menos 15 caracteres.
          </p>
          <div className={t.danger}>
            <span className={t.boxLabel}>Só nas primeiras 24 horas</span>
            <p>
              O cancelamento só é aceito pela SEFAZ dentro de{" "}
              <strong>24 horas</strong> depois da nota autorizada. Passado
              esse prazo, a nota é <strong>definitiva</strong> — qualquer
              acerto (troca, devolução, erro de valor) é feito com o{" "}
              <strong>contador</strong>, fora do painel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
