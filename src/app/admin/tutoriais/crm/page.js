import Link from "next/link";
import styles from "../../admin.module.css";
import t from "../tutorial.module.css";

export const metadata = {
  title: "Tutorial: CRM — Vamaq Motors",
};

export default function TutorialCrmPage() {
  return (
    <div className={t.wrap}>
      <Link href="/admin/tutoriais" className={t.backLink}>
        ← Todos os tutoriais
      </Link>

      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          CRM: acompanhar as oportunidades de venda
        </h1>
        <p className={styles.pageSubtitle}>
          Feito para usar no celular, em pé, no pátio
        </p>
      </div>

      <h2 className={t.sectionTitle}>Antes de começar</h2>
      <p className={t.lead}>
        O funil segue uma ordem: <strong>Novo → Em contato → Proposta →
        Negociação → Ganho</strong>. <strong>Perdido</strong> não é uma etapa
        de passagem — é uma saída lateral, que pode acontecer a partir de
        qualquer uma das outras.
      </p>

      <h2 className={t.sectionTitle}>Passo a passo</h2>

      <div className={t.step}>
        <div className={t.stepNumber}>1</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>A lista agrupada por etapa</h3>
          <p>
            Em <span className={t.uiField}>CRM</span>, as oportunidades
            aparecem agrupadas por etapa, cada grupo com a contagem de
            quantas estão nele. O <strong>card inteiro é clicável</strong> —
            não precisa mirar num botão pequeno para abrir. Use{" "}
            <span className={t.uiButton}>+ Nova oportunidade</span> para
            cadastrar um lead novo (só o nome do cliente é obrigatório).
          </p>
          <div className={t.tip}>
            <span className={t.boxLabel}>O campo Cliente busca no cadastro</span>
            <p>
              Digite o nome e o campo <span className={t.uiField}>Cliente</span>{" "}
              já procura no cadastro — escolha um resultado para vincular a
              oportunidade a ele. Se ninguém aparecer, o botão{" "}
              <span className={t.uiButton}>Cadastrar «nome» como cliente
              novo</span> cria o cliente dali mesmo, sem sair do CRM (o
              vendedor pode fazer isso, mesmo sem ver o menu{" "}
              <span className={t.uiField}>Clientes</span>). Sem escolher nem
              cadastrar, a oportunidade fica só com o nome digitado, sem
              vínculo com a ficha.
            </p>
          </div>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>2</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>
            A tela da oportunidade e o botão que diz para onde vai
          </h3>
          <p>
            Ao abrir uma oportunidade você vê cliente, veículo, valor,
            origem, telefone, e-mail e observações. O botão principal já diz
            o destino — <strong>&quot;Avançar para Proposta&quot;</strong>,
            não só &quot;Avançar&quot; — então nunca é preciso adivinhar em
            que etapa você vai cair. Quando o cliente está vinculado ao
            cadastro, o nome aparece como link e a tela mostra quantos carros
            já passam pelo histórico dele — quem abre é o vendedor, então só
            esse número aparece, nunca contrato ou nota fiscal.
          </p>
          <div className={t.tip}>
            <span className={t.boxLabel}>Por que cada ação é uma tela</span>
            <p>
              Não existe janelinha de confirmação no meio da lista. É decisão,
              não limitação: o CRM é usado no celular, em pé, no pátio — uma
              tela inteira por ação evita errar o toque e mudar a etapa
              errada sem querer.
            </p>
          </div>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>3</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Chamar no WhatsApp</h3>
          <p>
            Quando a oportunidade tem um telefone que dá para montar um link
            de conversa, o botão{" "}
            <span className={t.uiButton}>Chamar no WhatsApp</span> aparece e
            abre a conversa direto com esse número. Se o telefone estiver
            incompleto (por exemplo, sem DDD), o botão simplesmente não
            aparece — em vez de abrir a conversa errada.
          </p>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>4</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>
            Perder: não apaga, tem motivo, dá para reabrir
          </h3>
          <p>
            <span className={t.uiButton}>Marcar como perdido</span> leva a
            uma tela que pede o <strong>motivo</strong> (opcional). A
            oportunidade continua na lista, agora agrupada em{" "}
            <strong>Perdido</strong>, com o motivo visível no card — a
            palavra assusta, mas nada some. Para retomar, abra a oportunidade
            e use <span className={t.uiButton}>Reabrir oportunidade</span>:
            ela volta para o começo do funil, em Novo.
          </p>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>5</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Registrar a venda</h3>
          <p>
            O botão <span className={t.uiButton}>Registrar venda</span> só
            aparece quando a oportunidade está em <strong>Ganho</strong> e
            tem um <strong>veículo vinculado</strong>. Faltando uma das duas
            coisas, a tela explica o que fazer: mover para Ganho, ou editar a
            oportunidade para ligar um veículo.
          </p>
          <div className={t.danger}>
            <span className={t.boxLabel}>Confirmar a venda é sério</span>
            <p>
              O veículo é marcado como <strong>VENDIDO</strong>. Ele{" "}
              <strong>sai do site na hora</strong>. E a receita{" "}
              <strong>não</strong> é lançada sozinha: registre-a no
              Financeiro, ligada a esse veículo — sem isso, a{" "}
              <strong>margem daquele carro não aparece</strong>.
            </p>
          </div>
          <div className={t.tip}>
            <span className={t.boxLabel}>O carro entra na ficha do cliente</span>
            <p>
              Quando a oportunidade está vinculada a um cliente do cadastro,
              confirmar a venda também liga o carro à <strong>ficha</strong>{" "}
              dele (papel &quot;Comprou&quot;) — o mesmo histórico que um
              contrato ou uma nota fiscal alimentam. Sem cliente vinculado,
              esse vínculo não acontece; só a venda em si é registrada.
            </p>
          </div>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>6</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Mover e remover</h3>
          <p>
            No fim da tela da oportunidade, três ações de gerenciar:
          </p>
          <ul>
            <li>
              <strong>Editar</strong>: muda cliente, veículo, valor, origem,
              telefone, e-mail ou observações;
            </li>
            <li>
              <strong>Mover</strong>: joga a oportunidade direto para
              qualquer etapa, inclusive Ganho ou Perdido — é o caminho para o
              caso raro de uma venda cair depois de já estar em Ganho (ex.:
              financiamento negado). De Ganho não dá para &quot;perder&quot;
              pelo botão principal; é aqui que isso se resolve;
            </li>
            <li>
              <strong>Remover</strong>: apaga a oportunidade de vez — não dá
              para desfazer, e não mexe no veículo nem no financeiro. Se a
              ideia é só tirar do funil sem perder o histórico, use{" "}
              <strong>Marcar como perdido</strong> em vez de remover.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
