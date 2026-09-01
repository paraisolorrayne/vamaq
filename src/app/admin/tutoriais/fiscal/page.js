import Link from "next/link";
import styles from "../../admin.module.css";
import t from "../tutorial.module.css";
import Demonstracao from "../Demonstracao";

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
          <p>
            Desde agosto de 2026 a nota também sai com <strong>IBS e CBS</strong>,
            os tributos da reforma. Eles aparecem no mesmo quadro e são bem
            maiores que os outros na tela — é normal: diferente do ICMS, eles
            incidem sobre o <strong>valor total da nota</strong>, não sobre a
            margem. Não há nada a preencher; é só conferir.
          </p>
          <Demonstracao
            slug="emitir-nota"
            titulo="da lista até os impostos conferidos"
            legenda="Escolher o veículo vendido, preencher venda, aquisição e o nº da nota de entrada, e conferir os impostos que o sistema calcula — inclusive a caixa de venda presencial."
          />
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
          <div className={t.danger}>
            <span className={t.boxLabel}>Nº da nota de entrada é obrigatório</span>
            <p>
              É o número da nota que comprova de onde o carro veio. O contador
              confirmou que o texto das informações complementares é obrigatório e
              precisa estar preenchido — e não existe carro para vender que não
              tenha entrado antes. Sem esse número a emissão não segue.
            </p>
          </div>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>3</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>O destinatário</h3>
          <div className={t.warning}>
            <span className={t.boxLabel}>O comprador veio à loja?</span>
            <p>
              A caixa <span className={t.uiField}>O comprador veio à loja (venda
              presencial)</span> vem marcada, que é o caso normal.{" "}
              <strong>Só desmarque se a venda foi fechada a distância.</strong>
            </p>
            <p>
              Ela não é detalhe: quem decide se a nota é interna ou interestadual
              não é o estado do comprador, e sim onde a venda aconteceu. Alguém de
              São Paulo que vem buscar o carro em Uberlândia fez uma operação
              <strong> dentro do estado</strong>. Desmarcar sem motivo faz a nota
              sair com o CFOP errado.
            </p>
          </div>
          <p>
            Em <span className={t.uiField}>Cliente cadastrado</span>,
            escolher um nome preenche sozinhos os oito campos do
            destinatário (nome, CPF/CNPJ, CEP, logradouro, número, bairro,
            município, UF), vindos do{" "}
            <Link href="/admin/clientes">cadastro de clientes</Link>. Se o
            comprador não estiver cadastrado, preencha os campos à mão.
          </p>
          <p>
            O campo <span className={t.uiField}>Inscrição Estadual</span> fica em
            branco para pessoa física. Preencha só quando o comprador é{" "}
            <strong>empresa com IE</strong> — nesse caso o contador confirmou que
            informar é obrigatório.
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

      <div className={t.step}>
        <div className={t.stepNumber}>6</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Mandar os XMLs do mês para a contabilidade</h3>
          <p>
            No começo do mês, o contador pede os XMLs de tudo que entrou e saiu
            no mês anterior. Em{" "}
            <Link href="/admin/fiscal">Notas Fiscais</Link>, no cartão{" "}
            <span className={t.uiField}>XMLs do mês para a contabilidade</span>,
            escolha o mês e clique em{" "}
            <span className={t.uiButton}>Baixar XMLs do mês</span>. Vem um
            arquivo <strong>.zip</strong> só, com as notas separadas em pastas{" "}
            <span className={t.uiField}>entrada</span> (compras) e{" "}
            <span className={t.uiField}>saida</span> (vendas) — é esse arquivo
            que você anexa no e-mail ou no WhatsApp dele. Não precisa baixar
            uma por uma.
          </p>
          <p>
            Para uma nota só, o botão <span className={t.uiField}>XML</span> na
            linha dela <strong>salva o arquivo</strong> no computador.
          </p>
          <div className={t.warning}>
            <span className={t.boxLabel}>O que entra no pacote</span>
            <p>
              Entram as notas <strong>emitidas por aqui</strong> — as da{" "}
              <strong>série 2</strong> —, inclusive as{" "}
              <strong>canceladas</strong> (é a cancelada que explica o pulo na
              numeração). Nota que o <strong>escritório</strong> emitiu na série
              1 não passa pelo sistema: essa ele já tem. Se alguma nota não
              conseguir ser baixada do emissor, o pacote vem assim mesmo, com um
              arquivo <span className={t.uiField}>_faltando.txt</span> dentro
              dizendo qual faltou e por quê.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
