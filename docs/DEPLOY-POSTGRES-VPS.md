# Deploy do site público com Postgres na VPS

Runbook para colocar o site no ar usando **Postgres local na VPS** (sem
Supabase). Cobre só o site público (home, `/acervo`, `/veiculo/<slug>`).
O admin (`/admin`) depende de Auth + Storage do Supabase e fica para uma fase
posterior — por enquanto ele só redireciona para o login e não opera.

Tudo abaixo roda **na VPS**, como root (ou com sudo). Comandos testados para
Debian/Ubuntu (apt).

---

## 0. Pré-requisitos

- Node 20+ instalado (`node -v`). Se não tiver:
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  ```
- O repositório já clonado na VPS. Ajuste `APP_DIR` abaixo para o caminho real.
- ⚠️ **Cuidado com `/var/vamaq`.** Repassado sem data de quando foi observado
  e **não reverificado nesta sessão** — pode estar desatualizado. Registro:
  havia, nesse path, um clone antigo e abandonado, com histórico divergente
  do `main`. Se ainda existir na VPS, nunca rodar nada lá — confira com `pwd`
  e `git remote -v` antes de aplicar qualquer coisa fora de
  `/var/www/vamaq` (o `$APP_DIR` de baixo). O app em produção é sempre
  `/var/www/vamaq`.

```bash
export APP_DIR=/var/www/vamaq        # <-- ajuste para o path do repo na VPS
```

---

## 1. Atualizar o código

```bash
cd "$APP_DIR"
git pull origin main
npm install            # instala o driver pg, entre outros
```

### Se o `git pull` falhar (VPS não alcança o GitHub direto)

> ⚠️ **Sintoma:** `fatal: could not read Username for 'https://github.com'`
> seguido de `fatal: expected flush after ref listing`.
>
> Registrado numa depuração de 01–02/09/2026 — **não é fato reverificado
> depois disso; teste o `git pull` direto primeiro e só use o bundle se ele
> falhar de novo.** Na época, um `git ls-remote` anônimo contra o mesmo
> repositório falhava do mesmo jeito, mesmo o repositório sendo **público** e
> um `curl` feito da própria VPS pegando **200** em
> `https://github.com/paraisolorrayne/vamaq.git/info/refs?service=git-upload-pack`
> — a mesma URL que o git usa por baixo. Ou seja: a rede estava boa, quem
> recusava era o git. Já descartado então: proxy (nenhum no ambiente), DNS
> (`github.com` resolvia certo), `~/.netrc` (não existia), `~/.gitconfig`
> global (não existia), credential helper (vazio). **Não checado:**
> `/etc/gitconfig` (escopo *system*, fora do `--global`) e a versão do git —
> causa raiz nunca foi encontrada.
>
> O caminho que funcionou tira o GitHub do meio — um `git bundle`:
> ```bash
> # no Mac, a partir do sha que está rodando na VPS:
> git bundle create ~/Downloads/vamaq-<sha>.bundle <sha-atual-da-vps>..main
> git bundle verify ~/Downloads/vamaq-<sha>.bundle
> scp -i ~/.ssh/vamaq_vps ~/Downloads/vamaq-<sha>.bundle root@<ip-da-vps>:/root/
>
> # na VPS:
> cd "$APP_DIR" && git pull /root/vamaq-<sha>.bundle main
> ```
> Depois do `git pull` (por bundle ou direto), segue normal a partir do
> `npm install`.

---

## 2. Instalar o Postgres

```bash
apt-get update
apt-get install -y postgresql
systemctl enable --now postgresql
pg_isready              # deve responder "accepting connections"
```

---

## 3. Criar banco e usuário

Troque `TROQUE_ESTA_SENHA` por uma senha forte.

```bash
sudo -u postgres psql <<'SQL'
create user vamaq with password 'TROQUE_ESTA_SENHA';
create database vamaq owner vamaq;
SQL
```

---

## 4. Aplicar os schemas

> ⚠️ **São sete arquivos, e a ordem importa.** `crm-schema.sql` referencia `clientes`,
> `clientes-schema.sql` altera `documentos_gerados` e `notas_fiscais`, e assim por diante.
> Aplicar fora de ordem falha com `relation "..." does not exist` no meio, deixando o banco
> pela metade. **Use o script**, que já conhece a ordem e para no primeiro erro:

```bash
cd "$APP_DIR"
./db/aplicar-schemas.sh "postgres://vamaq@localhost:5432/vamaq"
# ou, com DATABASE_URL definido:  ./db/aplicar-schemas.sh
```

Todos os arquivos são idempotentes — **rodar de novo é o jeito normal** de aplicar uma
mudança de schema num banco que já existe. Não há script de deploy neste repositório
(o deploy é manual); este é o passo a rodar antes do `npm run build` (seção 7).

O financeiro (`db/fin-*.sql`) fica **fora** desse script: vive no schema `fin`, é aplicado com
outra conexão (`DATABASE_URL_FIN`, role `vamaq_fin`) e a blindagem tem script próprio
(`scripts/setup-fin-role.sh`). Ver o cabeçalho de `db/aplicar-schemas.sh`.

Deve criar as tabelas `vehicles` e `vehicle_images`, entre outras. Conferir:

```bash
PGPASSWORD='TROQUE_ESTA_SENHA' psql "postgres://vamaq@localhost:5432/vamaq" -c '\dt'
```

---

## 5. Configurar a `DATABASE_URL`

Crie/edite o `.env.local` na raiz do projeto:

```bash
cd "$APP_DIR"
cat > .env.local <<'ENV'
DATABASE_URL=postgres://vamaq:TROQUE_ESTA_SENHA@localhost:5432/vamaq
NEXT_PUBLIC_SITE_URL=https://vamaqmotors.com.br
ENV
chmod 600 .env.local
```

> O `.env.local` está no `.gitignore` — nunca é commitado.

---

## 6. Popular o estoque (seed)

```bash
cd "$APP_DIR"
npm run seed
```

Saída esperada: 8 veículos criados (4 `published`, 4 `draft`) + as fotos dos
4 lotes prontos (14/16/18/17) registradas. É **idempotente** — rodar de novo
só exibe "já existia / pulando".

---

## 7. Build e (re)start

O `next start` já serve as fotos de `public/veiculos/` — não precisa configurar
nada no nginx para as imagens.

```bash
cd "$APP_DIR"
npm run build
```

Subir/reiniciar o processo conforme o gerenciador da VPS:

```bash
# Se usa PM2:
pm2 restart vamaq || pm2 start "npm run start" --name vamaq
pm2 save

# Se usa systemd, reinicie o service correspondente:
# systemctl restart vamaq
```

> O `next start` lê o `.env.local` automaticamente, então o app já sobe com a
> `DATABASE_URL` apontando para o Postgres local.

---

## 8. Verificar

```bash
# Home traz os 2 destaques publicados (Cayenne + X4):
curl -s http://localhost:3000/ | grep -o "Cayenne Coupé Platinum Edition"

# Acervo lista os 4 publicados:
curl -s http://localhost:3000/acervo | grep -oE "/veiculo/[a-z0-9-]+" | sort -u

# Foto-capa serve 200:
curl -s -o /dev/null -w "%{http_code}\n" \
  http://localhost:3000/veiculos/porsche-cayenne-coupe-platinum-2022/00000260-PHOTO-2026-05-05-13-47-31.jpg
```

No navegador, abra o domínio: home + `/acervo` mostram os 4 carros com foto;
os 4 em `draft` ficam ocultos até o Mateus mandar as fotos.

---

## Quando o Mateus mandar as fotos dos 4 pendentes

1. Coloque as fotos em `public/veiculos/<slug>/` (use os slugs:
   `bmw-m-sport-2025`, `porsche-718-boxster-2020`, `chery-tiggo-7-pro-hibrido`,
   `dodge-ram-2500-night-edition-2021`).
2. Registre as imagens e publique via SQL (ajuste o slug):
   ```sql
   -- registrar as fotos: elas vivem no jsonb `images` do próprio veículo
   -- ({main, gallery} — ver db/schema.sql), não numa tabela à parte.
   update vehicles set images = jsonb_build_object(
     'main',    '/veiculos/porsche-718-boxster-2020/01.jpg',
     'gallery', jsonb_build_array(
       '/veiculos/porsche-718-boxster-2020/02.jpg',
       '/veiculos/porsche-718-boxster-2020/03.jpg'
     )
   )
   where slug = 'porsche-718-boxster-2020';

   -- publicar no site: quem controla a vitrine é a coluna BOOLEANA `published`.
   -- `status` é outra coisa — é o ciclo de vida do carro no pátio, e só aceita
   -- 'disponivel' | 'reservado' | 'vendido' | 'inativo' (VEHICLE_STATUSES, em
   -- src/lib/vehicleStore.js). Não existe status 'published', nem coluna
   -- `published_at`.
   update vehicles set published = true
   where slug = 'porsche-718-boxster-2020';
   ```
3. `npm run build` + restart.

Pendências de conteúdo (confirmar com o Mateus) estão no
`CONTEUDO-ESTOQUE.md`: modelo exato da "BMW M Sport 2025" e ano/cor da Tiggo.

---

## Deploy do ciclo de vida do veículo (17/09/2026)

O carro que a Vamaq vende e recebe de volta numa troca ganhou um número de
ciclo (`vehicles.ciclo`, `notas_fiscais.ciclo`, `fin.transactions.ciclo`) —
ver o cabeçalho de `db/estoque-ciclo.sql` e `db/fin-ciclo.sql` para o porquê.
Este deploy tem **dois schemas em duas conexões diferentes**, e é do tipo que
falha sem ninguém perceber na hora. Leia até o fim antes de rodar.

> ⚠️ **Os dois `.sql` são obrigatórios — nenhum substitui o outro.**
> `db/estoque-ciclo.sql` roda em `$DATABASE_URL` (schema `public`);
> `db/fin-ciclo.sql` roda em `$DATABASE_URL_FIN` (schema `fin`, role
> `vamaq_fin`). Aplicar só o primeiro deixa `fin.transactions` sem a coluna
> `ciclo`, e a consulta de margem — `getVehicleMargins` em
> `src/lib/fin/repositories/finance.js`, que alimenta o `custoAquisicao` que
> vira a **base do ICMS da nota de venda** em `src/lib/fiscal/notas.js` —
> quebra com `column t.ciclo does not exist`.
>
> Onde isso aparece: **`/api/admin/financeiro/margens` responde 500**, e com
> ele o card "Margem por veículo" do painel e a tela `/admin/financeiro/
> margens` — a rota não tem `try/catch`. A **emissão de nota NÃO cai**: o
> `try/catch` de `getDadosEmissao` (`src/lib/fiscal/notas.js`) degrada para
> `custoOrigem = "ausente"` e a tela pede o valor de aquisição à operadora.
> Degradar não é ficar certo: quem digitar o valor errado erra a base do ICMS
> em nota autorizada, e ninguém vê erro nenhum na tela. Mesma coisa em
> `/admin/estoque/entradas-saidas` e no placar de saúde financeira, os outros
> dois consumidores com `catch`.

> ⚠️ **Nunca re-aplique `db/fin-schema.sql` DEPOIS de `db/fin-ciclo.sql`.**
> Os dois criam `fin.v_vehicle_margin`, e o de `fin-schema.sql` é a versão
> **cega ao ciclo**: reaplicá-lo rebaixa a view em silêncio, sem erro nenhum.
> A ordem correta é sempre `fin-schema.sql` e depois `fin-ciclo.sql`; se
> precisar mexer no schema do `fin`, rode os dois, nessa ordem.

### Ordem exata

```bash
cd "$APP_DIR"
git pull origin main   # se falhar, ver "Se o git pull falhar" na Seção 1

# public — o runner já inclui estoque-ciclo.sql (arquivo 9/9, ver o
# cabeçalho de db/aplicar-schemas.sh). É o caminho seguro: transacional por
# arquivo e idempotente, então rodar de novo num banco já migrado não dói.
./db/aplicar-schemas.sh "$DATABASE_URL"
# alternativa manual, só este arquivo (se já souber que os outros 8 estão em dia):
# psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f db/estoque-ciclo.sql

# fin — fora do runner, outra conexão, outra role. Ver seção 4.
psql "$DATABASE_URL_FIN" -v ON_ERROR_STOP=1 --single-transaction -f db/fin-ciclo.sql

npm install && npm run build
pm2 restart vamaq

git rev-parse --short HEAD   # única prova de qual commit ficou rodando — não pular
```

**Os dois `-v ON_ERROR_STOP=1 --single-transaction` não são enfeite.** `psql
-f` sem eles **continua depois de um erro e ainda sai com código 0**: o
arquivo fica meio aplicado, o terminal despeja um `ERROR` no meio de dezenas
de linhas e o passo "confirmou `ok`?" da seção *Se algo falhar no meio* fica
sem sinal nenhum para ler. É o mesmo par de flags que `db/aplicar-schemas.sh`
já usa em cada arquivo — a alternativa manual só está igualando o padrão da
casa.

Migration sempre antes do código: `ciclo` entrou no `SELECT_COLS` de
`src/lib/vehicleStore.js`, que sustenta nove consultas — `readVehicles` e
`getVehicleById` entre elas. Se o código subir antes de `db/estoque-ciclo.sql`
estar aplicado, quebra a listagem inteira de veículos no admin, não só o botão
novo.

### Smoke check (código 200 não prova nada aqui)

Nesta migration, a vitrine pública **não é sinal de nada**: o `SELECT` de
`src/lib/repositories/vehicles.js` (o que abastece home e `/acervo`) lista as
colunas por nome, e `ciclo` não está entre elas — aplicar ou não
`db/estoque-ciclo.sql` não muda uma vírgula do que a vitrine mostra. (Isso é
diferente de outra migration, anterior a esta, que tocava colunas que a
consulta pública de fato seleciona — ali sim o `catch` de `getAllVehicles`
devolvendo `[]` fazia a home ficar no ar com 200 e zero carros. Não é o caso
aqui; não confundir as duas.)

Quem quebra — e quebra **visivelmente** — é o **admin**: `readVehicles` e
`getVehicleById` (`src/lib/vehicleStore.js`) passam por `SELECT_COLS`, que
agora inclui `ciclo`, e não têm `catch` em volta da query — sem a coluna
aplicada, `/api/admin/vehicles` e as rotas que dependem dela respondem 500 na
hora.

```bash
# 1. checagem geral de "o deploy não derrubou o site" — NÃO prova a migration:
#    ficaria com a mesma cara com ou sem db/estoque-ciclo.sql aplicado
curl -s https://vamaqmotors.com.br/acervo | grep -o "Tenho Interesse" | wc -l
# tem que voltar mais que zero. Use `grep -o | wc -l`, não `grep -c`: -c conta
# LINHAS com ocorrência, e o HTML do Next varia de quebra de linha entre um
# build e outro — dá pra ler uma queda que não existe.

# 2. a única prova de que a metade public da migration entrou: a coluna
#    existe e o default pegou nas linhas antigas
psql "$DATABASE_URL" -c "select count(*) from vehicles where ciclo <> 1"
# sem a coluna aplicada isto não devolve um número — devolve
# "ERROR: column "ciclo" does not exist" na cara. Por isso o check é sobre a
# query RODAR, não só sobre o valor. Esperado: 0 (nenhum carro trocou de
# ciclo ainda — é o primeiro deploy da feature).

# 3. a única prova do lado fin — o que o check 2 NÃO cobre
psql "$DATABASE_URL_FIN" -c "select count(*) from fin.transactions where ciclo <> 1"
# mesma lógica: erro alto se a coluna não existe, 0 é o esperado.

# 4. os TRIGGERS existem? Os checks 2 e 3 passam com a coluna aplicada e o
#    trigger não — e nesse meio-estado tudo parece verde (ninguém trocou de
#    ciclo ainda, então `ciclo <> 1` devolve 0 dos dois lados), enquanto toda
#    nota e todo lançamento novo nasce carimbado no ciclo 1 PARA SEMPRE. É a
#    falha mais cara e a mais silenciosa desta migration.
psql "$DATABASE_URL" -c \
  "select tgname from pg_trigger where tgname = 'notas_fiscais_carimba_ciclo'"
psql "$DATABASE_URL_FIN" -c \
  "select tgname from pg_trigger where tgname = 'transactions_carimba_ciclo'"
# cada um tem que devolver UMA linha com o nome. "(0 rows)" = trigger ausente:
# o arquivo .sql rodou pela metade (veja se usou ON_ERROR_STOP) — reaplique-o
# inteiro antes de seguir.
```

O check 1 só prova que o site continua no ar — um operador cansado que vê
carros no `/acervo` **não pode concluir daí que a migration entrou**. Os
checks 2 e 3 provam as colunas, cada um a sua metade, e o 4 prova o carimbo,
que é o que faz as colunas valerem alguma coisa. O 3 e o 4 são os únicos que
pegam uma falha do lado `fin`: sem `fin.transactions.ciclo`,
`/api/admin/financeiro/margens` responde 500 (o card de margem do painel e a
tela `/admin/financeiro/margens` ficam vazios), enquanto a emissão de nota
degrada calada para `custoOrigem = "ausente"` e pede o valor à operadora —
nada disso aparece num smoke check do site.

### Se algo falhar no meio

Os dois `.sql` são conexões diferentes — dá pra aplicar um e não perceber que
o outro ficou de fora. Regra: **não segue para o próximo passo até o anterior
confirmar `ok`.**

- **`aplicar-schemas.sh` (ou o `psql -f db/estoque-ciclo.sql` manual) falha:**
  pare aqui. Não aplique `fin-ciclo.sql`, não rode `npm run build`, não
  reinicie o pm2. O script é transacional por arquivo e idempotente — resolva
  o erro e rode de novo; nada fica pela metade.
- **`estoque-ciclo.sql` aplicou, `fin-ciclo.sql` falha:** pare antes do build.
  O `public` sozinho é inofensivo — o código que ainda está no ar não lê a
  coluna nova. Confira a role `vamaq_fin` (`scripts/setup-fin-role.sh`) e rode
  `psql "$DATABASE_URL_FIN" -f db/fin-ciclo.sql` de novo.
- **Os dois `.sql` aplicaram mas o código subiu antes (ordem invertida):**
  o admin responde 500 nas rotas de veículo (`readVehicles`/`getVehicleById`
  batendo em `SELECT_COLS` sem a coluna `ciclo`). A vitrine pública **não** é
  afetada — ela não seleciona essa coluna, então continua mostrando carros
  normalmente; não deixe isso enganar sobre o estado da migration. Aplique
  o(s) `.sql` que faltou e só então repita `npm run build && pm2 restart
  vamaq`; reiniciar o pm2 sozinho não resolve.
- **Só percebeu depois do deploy completo:** rode os quatro smoke checks acima
  para descobrir qual conexão ficou pra trás antes de aplicar qualquer coisa
  de novo.
