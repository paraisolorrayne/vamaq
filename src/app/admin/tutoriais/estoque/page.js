import Link from "next/link";
import styles from "../../admin.module.css";
import t from "../tutorial.module.css";

export const metadata = {
  title: "Tutorial: Estoque — Vamaq Motors",
};

export default function TutorialEstoquePage() {
  return (
    <div className={t.wrap}>
      <Link href="/admin/tutoriais" className={t.backLink}>
        ← Todos os tutoriais
      </Link>

      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Estoque: cadastrar e publicar um veículo</h1>
        <p className={styles.pageSubtitle}>
          O estoque é a vitrine do site — o que você publica aqui é o que o
          cliente vê no acervo
        </p>
      </div>

      <h2 className={t.sectionTitle}>Antes de começar</h2>
      <p className={t.lead}>
        Tenha à mão as <strong>fotos do carro</strong> e o <strong>CRLV</strong>{" "}
        (para marca, modelo, ano, cor e quilometragem). O preço pode sair da
        consulta FIPE embutida na própria tela.
      </p>

      <h2 className={t.sectionTitle}>Passo a passo</h2>

      <div className={t.step}>
        <div className={t.stepNumber}>1</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Abra o cadastro</h3>
          <p>
            Em <span className={t.uiField}>Estoque</span>, clique em{" "}
            <span className={t.uiButton}>+ Adicionar Veículo</span>. Para mexer
            num carro que já existe, use <span className={t.uiField}>Editar</span>{" "}
            no card dele. A busca no topo filtra por marca, modelo ou cor.
          </p>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>2</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Preencha os dados do veículo</h3>
          <p>
            Marca, modelo, ano, cor, combustível, câmbio e quilometragem. Copie
            do CRLV para não errar.
          </p>
          <ul>
            <li>
              <strong>Preço</strong> no formato <strong>158.000,00</strong>.
              Deixe em branco para o site mostrar{" "}
              <strong>&quot;Sob Consulta&quot;</strong>;
            </li>
            <li>
              A quilometragem aceita o formato brasileiro (ex.:{" "}
              <strong>130.726</strong>);
            </li>
            <li>
              <strong>Ficha técnica</strong> (motor, aceleração, velocidade
              máxima, portas, lugares) é opcional — aparece na página do veículo
              quando preenchida.
            </li>
          </ul>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>3</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Não sabe o preço? Use a FIPE ali mesmo</h3>
          <p>
            A tela tem uma <strong>consulta FIPE embutida</strong>: escolha
            marca, modelo e ano para ver o valor de referência e usá-lo como
            base do preço de anúncio. (A aba{" "}
            <span className={t.uiField}>Tabela FIPE</span> do menu faz a mesma
            consulta de forma avulsa.)
          </p>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>4</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Suba as fotos</h3>
          <p>
            A <strong>foto principal</strong> é a capa do card no acervo. As
            demais entram na <strong>galeria</strong> da página do veículo.
          </p>
          <div className={t.warning}>
            <span className={t.boxLabel}>Remoção de fundo</span>
            <p>
              A foto principal já vem com <strong>remoção de fundo ligada</strong>{" "}
              (o carro sai recortado sobre um fundo claro, padrão da vitrine); a
              galeria vem <strong>desligada</strong> (mostra a foto original).
              Ligue ou desligue conforme o resultado — fotos de estúdio às vezes
              ficam melhores sem recorte.
            </p>
          </div>
          <div className={t.tip}>
            <span className={t.boxLabel}>Fotos de iPhone funcionam</span>
            <p>
              Fotos em HEIC (iPhone) e imagens grandes são convertidas e
              otimizadas automaticamente. O processamento leva alguns segundos
              por foto — aguarde o preview aparecer antes de salvar.
            </p>
          </div>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>5</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Destaque, selo e publicação</h3>
          <ul>
            <li>
              <strong>Destaque</strong>: o carro aparece na vitrine da página
              inicial, além do acervo;
            </li>
            <li>
              <strong>Selo</strong> (Novo / Destaque / Blindado): a etiqueta que
              aparece sobre a foto no card;
            </li>
            <li>
              <strong>Publicado</strong>: controla se o carro{" "}
              <strong>aparece no site</strong>. Despublicado, ele some do acervo
              mas continua no seu estoque para editar depois.
            </li>
          </ul>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>6</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Salve e confira no site</h3>
          <p>
            Clique em <span className={t.uiButton}>Salvar</span>. O site é
            atualizado na hora — abra <span className={t.uiField}>/acervo</span>{" "}
            (ou a página do veículo) para conferir foto, preço e dados.
          </p>
          <div className={t.tip}>
            <span className={t.boxLabel}>Vendeu? Não exclua — despublique</span>
            <p>
              Para tirar um carro vendido do site, use{" "}
              <strong>Despublicar</strong> em vez de excluir. Assim o histórico
              do veículo é preservado (importante quando o Financeiro entrar, que
              liga cada carro à sua margem).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
