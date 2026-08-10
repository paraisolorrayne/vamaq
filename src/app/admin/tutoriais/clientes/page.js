import Link from "next/link";
import styles from "../../admin.module.css";
import t from "../tutorial.module.css";

export const metadata = {
  title: "Tutorial: Clientes — Vamaq Motors",
};

export default function TutorialClientesPage() {
  return (
    <div className={t.wrap}>
      <Link href="/admin/tutoriais" className={t.backLink}>
        ← Todos os tutoriais
      </Link>

      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          Clientes: o cadastro que preenche contrato e nota
        </h1>
        <p className={styles.pageSubtitle}>
          Cadastrar uma vez evita redigitar os mesmos dados em todo contrato e
          toda nota fiscal
        </p>
      </div>

      <h2 className={t.sectionTitle}>Antes de começar</h2>
      <p className={t.lead}>
        Só o <strong>nome</strong> é obrigatório. Não precisa recadastrar a
        base inteira de uma vez — o cadastro se completa aos poucos, conforme
        for útil.
      </p>

      <h2 className={t.sectionTitle}>Passo a passo</h2>

      <div className={t.step}>
        <div className={t.stepNumber}>1</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Abra e cadastre</h3>
          <p>
            Em <span className={t.uiField}>Clientes</span>, clique em{" "}
            <span className={t.uiButton}>+ Novo cliente</span>. Preencha o{" "}
            <span className={t.uiField}>Nome</span> — o resto (documento, RG,
            CNH, telefone, e-mail, endereço) é opcional e pode ficar em branco
            por enquanto. A busca no topo da lista encontra pelo nome, pelo
            CPF/CNPJ ou pelo telefone.
          </p>
          <div className={t.tip}>
            <span className={t.boxLabel}>O CPF pode ser digitado como quiser</span>
            <p>
              Com ponto e traço ou só números — o sistema guarda apenas os
              dígitos, e a busca acha dos dois jeitos. Mas o{" "}
              <strong>mesmo CPF não entra duas vezes</strong>: se já existir um
              cliente com aquele documento, o cadastro é recusado.
            </p>
          </div>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>2</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Por que o endereço vem em partes</h3>
          <p>
            <span className={t.uiField}>CEP</span>,{" "}
            <span className={t.uiField}>Logradouro</span>,{" "}
            <span className={t.uiField}>Número</span>,{" "}
            <span className={t.uiField}>Complemento</span>,{" "}
            <span className={t.uiField}>Bairro</span>,{" "}
            <span className={t.uiField}>Município</span> e{" "}
            <span className={t.uiField}>UF</span> aparecem separados porque é
            assim que a <strong>nota fiscal</strong> exige. No contrato, essas
            partes viram uma <strong>linha só</strong>, montada sozinha —
            você não precisa escrever o endereço por extenso em lugar nenhum.
          </p>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>3</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>A ficha, os carros e as oportunidades</h3>
          <p>
            Clique em <span className={t.uiField}>Abrir ficha</span> na lista
            para ver e editar os dados do cliente, os carros ligados a ele,
            as oportunidades do CRM em que ele apareceu e os documentos e
            notas já emitidos.
          </p>
          <p>
            Os carros chegam à ficha por <strong>três caminhos</strong>, todos{" "}
            <strong>sozinhos</strong> — sem precisar ligar à mão: gerar um{" "}
            <strong>contrato</strong> com esse cliente selecionado, emitir uma{" "}
            <strong>nota fiscal</strong> para ele, ou <strong>registrar a
            venda</strong> de uma oportunidade do CRM vinculada a ele (veja o{" "}
            <Link href="/admin/tutoriais/crm">tutorial de CRM</Link>). Em
            qualquer um dos três, o carro entra com o papel certo (Comprou,
            Vendeu ou Consignou). Para negócios anteriores ao sistema, use{" "}
            <span className={t.uiField}>Ligar outro carro</span>, no fim da
            seção Carros, para ligar à mão.
          </p>
          <div className={t.tip}>
            <span className={t.boxLabel}>Oportunidades</span>
            <p>
              A seção <span className={t.uiField}>Oportunidades</span> lista
              etapa, veículo, valor e data de cada oportunidade do CRM
              vinculada a este cliente — é o histórico do funil de vendas,
              visível só para quem abre a ficha (secretaria, financeiro e
              admin). O vendedor não vê esta tela.
            </p>
          </div>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>4</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Usar no contrato e na nota</h3>
          <p>
            Ao gerar um contrato ou emitir uma nota fiscal, escolha o cliente
            já cadastrado em vez de digitar tudo de novo — os dados vêm
            preenchidos sozinhos. Veja o{" "}
            <Link href="/admin/tutoriais/documentos">
              tutorial de Documentos
            </Link>
            .
          </p>
          <div className={t.warning}>
            <span className={t.boxLabel}>
              &quot;Salvar como cliente&quot; não leva o endereço
            </span>
            <p>
              Dentro do gerador de contrato, o botão{" "}
              <span className={t.uiButton}>Salvar como cliente</span> cadastra
              quem foi digitado à mão — mas <strong>sem o endereço</strong>.
              No contrato o endereço é uma linha só; separá-lo em partes na
              adivinhação criaria um endereço errado na nota fiscal. Quem
              cadastrou por ali completa o endereço depois, na ficha do
              cliente.
            </p>
          </div>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>5</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Desativar em vez de apagar</h3>
          <p>
            Não existe apagar um cliente. Na ficha, o botão{" "}
            <span className={t.uiField}>Desativar cliente</span> faz ele sumir
            da busca — marque <span className={t.uiField}>Incluir inativos</span>{" "}
            na lista para encontrá-lo de novo. O histórico (carros, contratos,
            notas) continua todo lá, e{" "}
            <span className={t.uiField}>Reativar cliente</span> desfaz a
            qualquer momento.
          </p>
          <div className={t.tip}>
            <span className={t.boxLabel}>Quem cadastra e quem usa</span>
            <p>
              Cadastrar e editar cliente é da <strong>secretaria</strong> e do{" "}
              <strong>financeiro</strong>. O <strong>vendedor</strong> escolhe
              um cliente já cadastrado ao gerar um contrato, mas{" "}
              <strong>não vê o menu Clientes</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
