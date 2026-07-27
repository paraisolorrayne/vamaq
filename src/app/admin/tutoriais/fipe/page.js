import Link from "next/link";
import styles from "../../admin.module.css";
import t from "../tutorial.module.css";

export const metadata = {
  title: "Tutorial: Tabela FIPE — Vamaq Motors",
};

export default function TutorialFipePage() {
  return (
    <div className={t.wrap}>
      <Link href="/admin/tutoriais" className={t.backLink}>
        ← Todos os tutoriais
      </Link>

      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Tabela FIPE: preço de referência</h1>
        <p className={styles.pageSubtitle}>
          Consulte o valor médio de mercado de qualquer veículo
        </p>
      </div>

      <h2 className={t.sectionTitle}>Passo a passo</h2>

      <div className={t.step}>
        <div className={t.stepNumber}>1</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Escolha o tipo de veículo</h3>
          <p>
            Carro, moto ou caminhão. Isso define a lista de marcas que aparece
            em seguida.
          </p>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>2</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Selecione marca, modelo e ano</h3>
          <p>
            Escolha na ordem: <strong>marca → modelo → ano</strong>. Cada
            escolha carrega a lista da próxima. O resultado mostra o{" "}
            <strong>valor FIPE</strong> e o mês de referência da tabela.
          </p>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>3</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Use como base — não como preço final</h3>
          <div className={t.warning}>
            <span className={t.boxLabel}>A FIPE é referência, não regra</span>
            <p>
              O valor FIPE é uma média de mercado. O preço de anúncio real
              depende de quilometragem, estado, opcionais, blindagem e demanda —
              ajuste a partir da FIPE, não copie cego.
            </p>
          </div>
          <div className={t.tip}>
            <span className={t.boxLabel}>Atalho</span>
            <p>
              Ao <strong>cadastrar ou editar um veículo</strong> no Estoque, a
              mesma consulta FIPE está embutida na tela — não precisa vir aqui e
              copiar o número. Veja o{" "}
              <Link href="/admin/tutoriais/estoque">tutorial de Estoque</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
