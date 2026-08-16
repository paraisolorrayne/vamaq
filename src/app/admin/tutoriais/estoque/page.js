import Link from "next/link";
import styles from "../../admin.module.css";
import t from "../tutorial.module.css";
import Demonstracao from "../Demonstracao";

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
            <span className={t.uiButton}>+ Novo Veículo</span>. Para mexer num
            carro que já existe, use <span className={t.uiButton}>Editar</span> na
            linha dele.
          </p>
          <p>
            A busca no topo acha por <strong>marca, modelo, cor, placa ou
            chassi</strong> — inclusive pelos últimos dígitos do chassi, que é
            como se costuma conferir. Logo abaixo dela há o filtro por{" "}
            <strong>período</strong>, que mostra os carros que entraram (ou
            saíram) entre duas datas.
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
              <strong>Ano de fabricação</strong> e <strong>Ano do modelo</strong>:
              preencha os dois para o carro aparecer como{" "}
              <strong>2021/2022</strong> no site, no estoque e no contrato;
            </li>
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
          <div className={t.tip}>
            <span className={t.boxLabel}>Ano do modelo igual ao de fabricação?</span>
            <p>
              Deixe o campo <span className={t.uiField}>Ano do modelo</span> em
              branco — o sistema mostra um ano só. E o modelo{" "}
              <strong>nunca pode ser anterior</strong> ao de fabricação: tentar
              salvar assim é recusado.
            </p>
          </div>
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
          <h3 className={t.stepTitle}>Inventário: placa e documentos</h3>
          <p>
            O estoque também é o <strong>inventário</strong> da loja. Preencha a{" "}
            <span className={t.uiField}>Placa</span> e anexe os{" "}
            <strong>documentos do veículo</strong> (CRLV, CRV, nota fiscal…) na
            seção <span className={t.uiField}>Documentos do veículo</span>.
          </p>
          <p>
            Preencha também o <span className={t.uiField}>Chassi</span>. Ele é{" "}
            <strong>obrigatório para emitir a nota fiscal</strong> do veículo —
            sem ele, a tela de emissão avisa e não deixa seguir. Veja o{" "}
            <Link href="/admin/tutoriais/fiscal">tutorial de Notas Fiscais</Link>.
          </p>
          <div className={t.warning}>
            <span className={t.boxLabel}>Pendências</span>
            <p>
              Carro <strong>sem placa ou sem documento</strong> aparece com um
              aviso <strong>⚠ pendência</strong> na lista de estoque. É o que
              ajuda a saber quais veículos ainda precisam ser regularizados.
            </p>
          </div>
          <div className={t.tip}>
            <span className={t.boxLabel}>Privacidade</span>
            <p>
              Placa e documentos são <strong>internos</strong> — não aparecem no
              site. Os arquivos ficam guardados com segurança e só abrem para quem
              está logado no painel. (Para anexar documentos, salve o veículo
              primeiro.)
            </p>
          </div>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>6</div>
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
        <div className={t.stepNumber}>7</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Salve e confira no site</h3>
          <p>
            Clique em <span className={t.uiButton}>Salvar</span>. O site é
            atualizado na hora — abra <span className={t.uiField}>/acervo</span>{" "}
            (ou a página do veículo) para conferir foto, preço e dados.
          </p>
          <div className={t.tip}>
            <span className={t.boxLabel}>Não usou o carro? Use Desativar</span>
            <p>
              Na lista de estoque, o botão <strong>Desativar</strong> tira o
              carro do site mas o mantém no estoque (dá para{" "}
              <strong>Reativar</strong> depois) — para o carro sair de
              circulação sem ter sido vendido. Para uma venda de verdade, veja
              o próximo passo: <strong>Desativar não marca o carro como
              vendido</strong> e não libera a nota fiscal.
            </p>
          </div>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>8</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Vendeu? Marque a venda</h3>
          <p>
            Quando o carro é vendido <strong>no balcão</strong>, para alguém
            que nunca foi um lead no CRM, use{" "}
            <span className={t.uiButton}>Marcar vendido</span> na lista de
            estoque. A tela mostra o carro, deixa escolher o{" "}
            <span className={t.uiField}>Cliente</span> (opcional — dá para
            vincular depois) e avisa antes de confirmar: o carro vira{" "}
            <strong>VENDIDO</strong> e <strong>sai do site na hora</strong>.
          </p>
          <div className={t.warning}>
            <span className={t.boxLabel}>A receita não é lançada sozinha</span>
            <p>
              Marcar a venda só muda o status do carro. Registre a receita no{" "}
              <strong>Financeiro</strong>, ligada a este veículo — sem isso a
              margem dele não aparece nos relatórios.
            </p>
          </div>
          <Demonstracao
            slug="marcar-vendido"
            titulo="marcar um carro como vendido"
            legenda="Do Estoque, o botão Marcar vendido abre uma tela que explica o que vai acontecer antes de confirmar."
          />
          <div className={t.tip}>
            <span className={t.boxLabel}>Venda veio de um lead? Use o CRM</span>
            <p>
              Se a venda nasceu de uma oportunidade no <strong>CRM</strong>,
              registre-a por lá (<span className={t.uiField}>Ganho</span> →{" "}
              <span className={t.uiButton}>Registrar a venda</span>) em vez de
              marcar pelo Estoque — assim o histórico da negociação fica
              completo. Os dois caminhos levam ao mesmo lugar: o carro vendido
              aparece em <Link href="/admin/tutoriais/fiscal">Notas
              Fiscais</Link>, pronto para emitir a nota.
            </p>
          </div>
        </div>
      </div>

      <h2 className={t.sectionTitle}>Entradas e saídas</h2>

      <div className={t.step}>
        <div className={t.stepNumber}>7</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Registre quando o carro entrou e saiu</h3>
          <p>
            No cadastro de cada veículo há{" "}
            <span className={t.uiField}>Data de entrada na loja</span> e{" "}
            <span className={t.uiField}>Data de saída</span>. A de entrada é o dia
            em que o carro chegou — <strong>não</strong> é a data em que alguém
            cadastrou no sistema. A de saída é preenchida sozinha quando o carro é
            marcado como vendido, e continua editável se a data real for outra.
          </p>
          <div className={t.warning}>
            <span className={t.boxLabel}>Os carros antigos estão sem data</span>
            <p>
              Os veículos que já estavam no estoque quando esse campo passou a
              existir nasceram <strong>sem data</strong>, de propósito — inventar
              uma data seria pior que deixar em branco. Preencha conforme for
              mexendo em cada carro. Enquanto isso, o filtro por período avisa
              quantos ficaram de fora.
            </p>
          </div>
        </div>
      </div>

      <div className={t.step}>
        <div className={t.stepNumber}>8</div>
        <div className={t.stepBody}>
          <h3 className={t.stepTitle}>Veja tudo junto</h3>
          <p>
            O botão <span className={t.uiButton}>📋 Entradas e saídas</span>, no
            topo do Estoque, abre a lista de todos os carros com entrada, saída e —
            para quem tem acesso ao Financeiro — os valores de compra, venda e
            resultado. Dá para filtrar por período e buscar por placa ou chassi.
          </p>
          <div className={t.tip}>
            <span className={t.boxLabel}>De onde vêm os valores</span>
            <p>
              Não são digitados ali: saem dos lançamentos do{" "}
              <strong>Financeiro</strong> ligados a cada veículo. Carro sem compra
              ou venda lançada aparece com um travessão — é sinal de lançamento
              faltando, não de carro sem valor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
