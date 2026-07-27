import Link from "next/link";
import styles from "../../admin.module.css";
import t from "../tutorial.module.css";

export const metadata = {
  title: "Tutorial: Gerar Criativos — Vamaq Motors",
};

export default function TutorialCriativosPage() {
  return (
    <div className={t.wrap}>
      <Link href="/admin/tutoriais" className={t.backLink}>
        ← Todos os tutoriais
      </Link>

      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Criativos: artes de anúncio prontas</h1>
        <p className={styles.pageSubtitle}>
          Stories e Feed do Instagram a partir do estoque — sem Photoshop, sem
          recortar fundo à mão
        </p>
      </div>

      <h2 className={t.sectionTitle}>Passo a passo</h2>

      <div className={t.step}>
        <div className={t.stepNumber}>1</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Escolha formato e template</h3>
          <ul>
            <li>
              <strong>Formato</strong>:{" "}
              <span className={t.uiField}>Story · 1080×1920</span> (vertical, pros
              stories) ou <span className={t.uiField}>Feed · 1080×1350</span> (o
              post do feed);
            </li>
            <li>
              <strong>Template</strong>: um <strong>veículo em destaque</strong>{" "}
              ou <span className={t.uiField}>Acervo</span> (vários carros na
              mesma arte).
            </li>
          </ul>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>2</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Puxe o carro do estoque</h3>
          <p>
            No seletor <span className={t.uiField}>Selecione um veículo...</span>
            , escolha o carro. A arte já vem preenchida com marca, modelo, ano,
            km, preço, potência, câmbio e combustível. Você pode ajustar
            qualquer campo à mão depois.
          </p>
          <div className={t.tip}>
            <span className={t.boxLabel}>Preço</span>
            <p>
              Carro sem preço no estoque aparece como{" "}
              <strong>&quot;Consulte&quot;</strong> na arte. Para mostrar um
              valor, preencha o campo de preço.
            </p>
          </div>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>3</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Ajuste os diferenciais e a chamada</h3>
          <ul>
            <li>
              <strong>Diferenciais</strong> (até 3, separados por vírgula) — ex.:{" "}
              <span className={t.uiField}>BLINDADO, TETO SOLAR, ÚNICO DONO</span>;
            </li>
            <li>
              <strong>Título</strong> (linha 1 e linha 2) e{" "}
              <strong>subtítulo</strong> são o texto grande da arte. Deixe curto
              — chamada de anúncio, não descrição.
            </li>
          </ul>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>4</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Enquadre a foto</h3>
          <p>
            Use <span className={t.uiField}>Zoom</span>,{" "}
            <span className={t.uiField}>Posição ↔</span> e{" "}
            <span className={t.uiField}>Posição ↕</span> para centralizar o carro
            na arte. A prévia à direita atualiza em tempo real — mexa até o carro
            ficar bem enquadrado e sem cortar as rodas.
          </p>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>5</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Baixe e poste</h3>
          <p>
            Confira a prévia e clique em <span className={t.uiButton}>Baixar</span>
            . A imagem sai já na medida certa do formato escolhido, pronta para
            subir no Instagram.
          </p>
          <div className={t.tip}>
            <span className={t.boxLabel}>Dica</span>
            <p>
              Precisa do mesmo carro em Story e Feed? Gere um, troque só o{" "}
              <strong>Formato</strong> no topo e baixe de novo — o resto continua
              preenchido.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
