import Link from "next/link";
import styles from "../../admin.module.css";
import t from "../tutorial.module.css";

export const metadata = {
  title: "Tutorial: Financeiro — Vamaq Motors",
};

export default function TutorialFinanceiroPage() {
  return (
    <div className={t.wrap}>
      <Link href="/admin/tutoriais" className={t.backLink}>
        ← Todos os tutoriais
      </Link>

      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Financeiro: do lançamento à margem por carro</h1>
        <p className={styles.pageSubtitle}>
          Controle de receitas e despesas ligado ao estoque — para saber o lucro
          real de cada veículo, já com o ICMS
        </p>
      </div>

      <p className={t.lead}>
        O Financeiro fica no menu para quem é <strong>admin</strong> ou tem papel{" "}
        <strong>financeiro</strong>. A tela inicial mostra o resultado do mês e a
        margem dos carros; os atalhos no topo levam a cada parte.
      </p>

      <h2 className={t.sectionTitle}>1. Lançar receitas e despesas</h2>

      <div className={t.step}>
        <div className={t.stepNumber}>1</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Registre o dinheiro que entra e sai</h3>
          <p>
            Em <span className={t.uiField}>Lançamentos</span>, clique em{" "}
            <span className={t.uiButton}>+ Novo lançamento</span>. Escolha{" "}
            <strong>Receita</strong> (entrada) ou <strong>Despesa/Custo</strong>{" "}
            (saída), a data, o valor (formato <strong>150.000,00</strong>) e a
            descrição.
          </p>
          <ul>
            <li>
              <strong>Conta</strong>: escolha no plano de contas — é o que
              organiza o DRE (receita, custo, despesa);
            </li>
            <li>
              <strong>Centro de custo, banco e contato</strong> são opcionais;
            </li>
            <li>
              <strong>Situação</strong>: <em>Confirmado</em> entra nos números;{" "}
              <em>Pendente</em> fica de fora até você confirmar.
            </li>
          </ul>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>2</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Ligue o lançamento ao veículo</h3>
          <p>
            No campo <span className={t.uiField}>Veículo (para margem)</span>,
            escolha o carro do estoque. É esse vínculo que faz o sistema calcular
            o lucro <strong>daquele carro</strong>.
          </p>
          <div className={t.danger}>
            <span className={t.boxLabel}>Regra de ouro do ICMS</span>
            <p>
              A <strong>compra do veículo</strong> tem que ser lançada na conta{" "}
              <strong>4.1 — Custo de Aquisição de Veículos</strong>. É essa nota
              de compra que o sistema usa como base do ICMS (venda − compra).
              Preparação e reparos vão em <strong>4.2</strong> e não entram na
              base do imposto.
            </p>
          </div>
        </div>
      </div>

      <h2 className={t.sectionTitle}>2. Margem por veículo (com ICMS)</h2>

      <div className={t.step}>
        <div className={t.stepNumber}>3</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Veja o lucro real de cada carro</h3>
          <p>
            Em <span className={t.uiField}>Margem por veículo</span>, cada carro
            com lançamento mostra receita, custo total, o{" "}
            <strong>ICMS estimado</strong> e o <strong>resultado líquido</strong>.
          </p>
          <div className={t.math}>
            <div><span>Venda</span><span>R$ 200.000</span></div>
            <div><span>Custo de aquisição (conta 4.1)</span><span>− R$ 150.000</span></div>
            <div><span>ICMS 5% sobre o lucro (200.000 − 150.000)</span><span>− R$ 2.500</span></div>
            <div className={t.mathTotal}><span>Resultado líquido</span><span>R$ 47.500 − outros custos</span></div>
          </div>
          <div className={t.tip}>
            <span className={t.boxLabel}>Regime de Lucro Presumido</span>
            <p>
              O ICMS do seminovo incide sobre o <strong>lucro</strong> (nota de
              venda − nota de compra), à alíquota de <strong>5%</strong>, só
              quando há venda com lucro. É a regra do contador da Vamaq, já
              embutida no cálculo.
            </p>
          </div>
        </div>
      </div>

      <h2 className={t.sectionTitle}>3. Dashboard e DRE</h2>

      <div className={t.step}>
        <div className={t.stepNumber}>4</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Leia o resultado do mês</h3>
          <p>
            A tela inicial do <span className={t.uiField}>Financeiro</span>{" "}
            resume o mês: receita, custos (CMV), lucro líquido e margem, com o{" "}
            <strong>DRE</strong> logo abaixo (Receita − Custos = Lucro Bruto;
            menos despesas = Lucro Líquido). Os números vêm dos lançamentos{" "}
            <em>confirmados</em>.
          </p>
        </div>
      </div>

      <h2 className={t.sectionTitle}>4. Contatos, cobranças e contas a pagar</h2>

      <div className={t.step}>
        <div className={t.stepNumber}>5</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Contatos (clientes e fornecedores)</h3>
          <p>
            Em <span className={t.uiField}>Contatos</span>, cadastre clientes e
            fornecedores (nome, CPF/CNPJ, e-mail, telefone). Eles aparecem nos
            lançamentos e, principalmente, na hora de emitir uma cobrança.
          </p>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>6</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Cobranças (boleto e PIX)</h3>
          <p>
            Em <span className={t.uiField}>Cobranças</span>, clique em{" "}
            <span className={t.uiButton}>+ Nova cobrança</span>, escolha o
            cliente, o tipo (boleto ou PIX), valor e vencimento. O sistema gera a
            cobrança e o <strong>link da fatura</strong> para enviar.
          </p>
          <div className={t.warning}>
            <span className={t.boxLabel}>Precisa do Asaas ativo</span>
            <p>
              A cobrança usa a integração <strong>Asaas</strong>. Se a tela
              mostrar &quot;integração não ativada&quot;, é porque falta
              configurar a conta Asaas — as cobranças recebidas aparecem na lista
              com a situação (a vencer / vencida / recebida).
            </p>
          </div>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>7</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Contas a pagar (com aprovação)</h3>
          <p>
            Em <span className={t.uiField}>Contas a pagar</span>, cadastre o que a
            loja deve (aluguel, fornecedores…). Cada conta tem uma{" "}
            <strong>situação</strong>: a vencer, vencida, paga ou aguardando
            aprovação.
          </p>
          <ul>
            <li>
              Conta dentro da sua <strong>alçada</strong> já nasce{" "}
              <strong>aprovada</strong>; acima dela, fica{" "}
              <strong>aguardando aprovação</strong> de alguém com alçada maior;
            </li>
            <li>
              <strong>Aprovar não paga</strong> — depois de aprovada, use{" "}
              <span className={t.uiField}>Marcar pago</span> quando o pagamento
              sair;
            </li>
            <li>
              A alçada de cada pessoa é definida na tela de{" "}
              <strong>Usuários</strong> (admin tem alçada ilimitada).
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
