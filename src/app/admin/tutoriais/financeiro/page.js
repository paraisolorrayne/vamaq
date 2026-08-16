import Link from "next/link";
import styles from "../../admin.module.css";
import t from "../tutorial.module.css";
import Demonstracao from "../Demonstracao";

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
              <strong>4.1 — Custo de Aquisição de Veículos</strong>. É esse valor
              que a nota fiscal de venda imprime nas informações complementares,
              identificando de onde o carro veio. Preparação e reparos vão em{" "}
              <strong>4.2</strong>.
            </p>
            <p>
              Lançar a compra na conta errada <strong>erra o imposto</strong>: a
              base do ICMS do seminovo é a margem (venda − compra), então uma
              aquisição fora da 4.1 faz a margem parecer maior do que é.
            </p>
          </div>
        </div>
      </div>

      <h2 className={t.sectionTitle}>2. Margem por veículo (com impostos)</h2>

      <div className={t.step}>
        <div className={t.stepNumber}>3</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Veja o lucro real de cada carro</h3>
          <p>
            Em <span className={t.uiField}>Margem por veículo</span>, cada carro
            com lançamento mostra receita, custo total, o{" "}
            <strong>impostos da venda</strong> (ICMS, PIS e COFINS) e o{" "}
            <strong>resultado líquido</strong>.
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
              <span className={t.uiButton}>Marcar pago</span> quando o pagamento
              sair;
            </li>
            <li>
              A alçada de cada pessoa é definida na tela de{" "}
              <strong>Usuários</strong> (admin tem alçada ilimitada).
            </li>
          </ul>
          <div className={t.tip}>
            <span className={t.boxLabel}>Quem aprova é avisado</span>
            <p>
              Conta parada em <strong>aguardando aprovação</strong> aparece no{" "}
              <strong>Dashboard</strong> de quem tem alçada, logo ao entrar, com a
              quantidade e o total. Enquanto não for aprovada, ela não pode ser
              marcada como paga.
            </p>
          </div>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>8</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Conta que chega todo mês</h3>
          <p>
            Água, luz, internet e aluguel não precisam ser cadastrados um por um.
            No formulário, em{" "}
            <span className={t.uiField}>Repetir mensalmente</span>, escolha por
            quantos meses — o sistema cria a série inteira de uma vez, numerada
            (<em>Conta de água (1/12)</em>, <em>(2/12)</em>…).
          </p>
          <div className={t.warning}>
            <span className={t.boxLabel}>O valor é uma previsão</span>
            <p>
              Conta de água não vem igual todo mês. As parcelas nascem com o valor
              que você informou e <strong>devem ser corrigidas</strong> quando a
              conta real chegar. Isso não atrapalha o resultado do mês: conta a
              pagar não entra no DRE — quem entra é o lançamento do pagamento.
            </p>
          </div>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>9</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Ler o boleto e guardar a conta</h3>
          <p>
            No alto do formulário há{" "}
            <span className={t.uiField}>Linha digitável do boleto ou da conta</span>.
            Digite ou cole os números impressos <strong>abaixo do código de
            barras</strong> e clique em <span className={t.uiButton}>Ler conta</span>:
            o valor é preenchido sozinho e, quando é boleto bancário, o vencimento
            também.
          </p>
          <div className={t.tip}>
            <span className={t.boxLabel}>Serve para conferir, não só para poupar digitação</span>
            <p>
              Os números trazem dígitos de conferência. Se você trocar um algarismo
              sem perceber, o sistema recusa <strong>na hora</strong> — em vez de a
              loja descobrir o valor errado só na conciliação. Em conta de água e
              luz o vencimento não vem no código: preencha à mão.
            </p>
          </div>
          <Demonstracao
            slug="conta-a-pagar"
            titulo="cadastrar uma conta lendo o boleto"
            legenda="Abrir Nova conta, colar a linha digitável, clicar em Ler conta — o valor entra sozinho — e escrever a descrição."
          />
          <p>
            Na lista, o botão <span className={t.uiButton}>Anexar</span> guarda o
            PDF ou a foto do boleto e do comprovante junto da conta. No celular ele
            abre a câmera direto. Depois de anexado, vira{" "}
            <span className={t.uiButton}>Ver anexo</span>.
          </p>
        </div>
      </div>

      <h2 className={t.sectionTitle}>5. Categorias, fechamento e saúde</h2>

      <div className={t.step}>
        <div className={t.stepNumber}>10</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Criar uma categoria que falta</h3>
          <p>
            Em <span className={t.uiField}>Categorias</span>, a loja cria as
            próprias categorias de receita e despesa, sem pedir desenvolvimento.
            Você escolhe o <strong>nome</strong> e <strong>onde ela entra</strong> —
            “Despesas administrativas”, “Custos do veículo”, “Despesas
            comerciais” — e o resto o sistema resolve.
          </p>
          <div className={t.warning}>
            <span className={t.boxLabel}>Custo do veículo ou despesa da loja?</span>
            <p>
              É a pergunta que muda o número. Gasto que pertence a{" "}
              <strong>um carro</strong> — lava jato, chaveiro, funilaria — vai em{" "}
              <strong>Custos do veículo</strong> e pesa na margem daquele carro
              quando o lançamento é ligado a ele. Gasto de manter a loja aberta vai
              em <strong>Despesas administrativas</strong>.
            </p>
          </div>
          <Demonstracao
            slug="criar-categoria"
            titulo="criar uma categoria nova"
            legenda="Nome, onde ela entra, e pronto — o código sai sozinho e ela já aparece na hora de lançar."
          />
          <p>
            Categoria errada <strong>não se apaga</strong>: use{" "}
            <span className={t.uiButton}>Desativar</span>. Ela some da lista na hora
            de lançar, mas continua nos lançamentos antigos — apagar quebraria o
            resultado de meses já fechados. As marcadas como{" "}
            <strong>fixas do plano</strong> são as que o DRE e a margem usam para
            montar o resultado e não podem ser desligadas.
          </p>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>11</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Fechar o mês</h3>
          <p>
            Em <span className={t.uiField}>Fechamento mensal</span>, escolha o mês e
            confira o retrato do resultado. Antes do botão de fechar há um{" "}
            <strong>checklist de pendências</strong>, e cada linha leva à tela onde
            se resolve:
          </p>
          <ul>
            <li>lançamentos pendentes — ficam fora dos números até confirmar;</li>
            <li>lançamentos sem categoria;</li>
            <li>contas a pagar vencidas e ainda em aberto;</li>
            <li>veículos vendidos no mês <strong>sem nota fiscal emitida</strong>;</li>
            <li>veículos vendidos <strong>sem data de saída</strong>.</li>
          </ul>
          <p>
            Fechar o mês é um marco gerencial: dá para fechar mesmo com pendências,
            e lançamento retroativo continua permitido.
          </p>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>12</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Score de saúde financeira</h3>
          <p>
            Na tela de <span className={t.uiField}>Orçamento</span>, acima das metas,
            fica o <strong>score de saúde</strong> — uma nota de 0 a 100 formada por
            cinco itens: resultado do período, aderência ao orçamento, contas em
            dia, organização dos lançamentos e margem dos veículos vendidos.
          </p>
          <div className={t.tip}>
            <span className={t.boxLabel}>O número explica a si mesmo</span>
            <p>
              Cada item mostra quantos pontos deu, de quantos podia dar, e o porquê
              — “1 de 1 conta vencida e em aberto”. É para agir, não para decorar.
              Item <strong>sem dado</strong> fica de fora da conta em vez de valer
              zero: não ter orçamento cadastrado não é sinal de empresa doente. E
              quando poucos itens puderam ser avaliados, o sistema diz{" "}
              <strong>avaliação parcial</strong> em vez de dar um veredito que o
              dado não sustenta.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
