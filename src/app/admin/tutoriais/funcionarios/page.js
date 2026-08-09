import Link from "next/link";
import styles from "../../admin.module.css";
import t from "../tutorial.module.css";

export const metadata = {
  title: "Tutorial: Funcionários — Vamaq Motors",
};

export default function TutorialFuncionariosPage() {
  return (
    <div className={t.wrap}>
      <Link href="/admin/tutoriais" className={t.backLink}>
        ← Todos os tutoriais
      </Link>

      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          Funcionários: ficha, admissão e saída
        </h1>
        <p className={styles.pageSubtitle}>
          O cadastro das pessoas, separado do acesso ao sistema — só
          administrador entra aqui
        </p>
      </div>

      <h2 className={t.sectionTitle}>Passo a passo</h2>

      <div className={t.step}>
        <div className={t.stepNumber}>1</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Criar a ficha</h3>
          <p>
            Em <Link href="/admin/funcionarios">Funcionários</Link>, use{" "}
            <span className={t.uiButton}>+ Nova ficha</span>. Só o{" "}
            <span className={t.uiField}>Nome</span> é obrigatório — CPF,
            telefone, nascimento, RG, e-mail pessoal, endereço e observações
            ficam em branco até você preencher.
          </p>
          <div className={t.tip}>
            <span className={t.boxLabel}>A ficha é a pessoa</span>
            <p>
              A ficha não dá acesso ao sistema sozinha. Cargo e data de
              admissão são registrados depois de salvar, direto na ficha.
            </p>
          </div>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>2</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Registrar a admissão</h3>
          <p>
            Na ficha, em <span className={t.uiField}>Passagens pela
            loja</span>, informe <span className={t.uiField}>Cargo</span> e{" "}
            <span className={t.uiField}>Data de admissão</span> e confirme.
            A situação da ficha muda para o cargo informado, e essa
            passagem entra na tabela de histórico.
          </p>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>3</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Dar acesso ao sistema</h3>
          <p>
            No bloco <span className={t.uiField}>Acesso ao sistema</span>,
            informe um <span className={t.uiField}>Login</span> (vira
            e-mail <em>login@vamaqmotors.com.br</em>) e o{" "}
            <span className={t.uiField}>Papel</span>, e use{" "}
            <span className={t.uiButton}>Criar acesso</span>. A senha
            provisória aparece <strong>só uma vez</strong> — copie e envie
            para a pessoa antes de sair da tela.
          </p>
          <div className={t.tip}>
            <span className={t.boxLabel}>Login que já existia</span>
            <p>
              Se a pessoa já entrava no sistema antes de ter ficha — comum
              em quem já trabalhava na loja quando este módulo foi criado —
              não crie um acesso novo. Escolha o login dela em{" "}
              <span className={t.uiField}>Acesso existente</span> e use{" "}
              <span className={t.uiButton}>Vincular</span>. Esse campo só
              aparece quando existe algum login ainda não ligado a nenhuma
              ficha.
            </p>
          </div>
          <p>
            Ficha e login são independentes nos dois sentidos: existe
            funcionário sem acesso ao sistema, e existe acesso ainda não
            ligado a nenhuma ficha.
          </p>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>4</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Registrar a saída</h3>
          <p>
            Com o vínculo em aberto, o mesmo bloco de{" "}
            <span className={t.uiField}>Passagens pela loja</span> pede{" "}
            <span className={t.uiField}>Data de saída</span> e, opcional, o{" "}
            <span className={t.uiField}>Motivo</span>. Confirme em{" "}
            <span className={t.uiButton}>Desligar</span>.
          </p>
          <div className={t.danger}>
            <span className={t.boxLabel}>O login é desativado na mesma ação</span>
            <p>
              Se a pessoa tinha acesso ao sistema, ele é desativado{" "}
              <strong>junto</strong> com o desligamento — não existe um
              instante em que a pessoa já saiu e o login ainda funciona.
              Não é preciso ir a outra tela para cortar o acesso.
            </p>
          </div>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>5</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Readmitir</h3>
          <p>
            Sem vínculo em aberto, o mesmo formulário volta a pedir cargo e
            data, mas o botão muda para <span className={t.uiButton}>
            Readmitir</span>. A nova passagem entra como uma linha nova na
            tabela — as passagens anteriores <strong>continuam
            visíveis</strong>, com data de saída e motivo. É esse histórico
            que serve de prova depois.
          </p>
          <div className={t.warning}>
            <span className={t.boxLabel}>O login não volta sozinho</span>
            <p>
              Readmitir a ficha não reativa um login que havia sido
              desativado no desligamento. Se a pessoa volta a precisar de
              acesso, reative e redefina a senha na tela de Usuários.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
