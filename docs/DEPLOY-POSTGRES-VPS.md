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
   -- registrar as fotos (repita por arquivo, position crescente, 1 primária):
   insert into vehicle_images (vehicle_id, position, is_primary, url)
   select id, 0, true, '/veiculos/porsche-718-boxster-2020/<arquivo>.jpg'
   from vehicles where slug = 'porsche-718-boxster-2020';

   -- publicar:
   update vehicles set status='published', published_at=now()
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
> quebra com `column t.ciclo does not exist`. Isso só aparece na hora de
> emitir uma nota, não num smoke check do site.

### Ordem exata

```bash
cd /var/www/vamaq
git pull origin main

# public — o runner já inclui estoque-ciclo.sql (arquivo 9/9, ver o
# cabeçalho de db/aplicar-schemas.sh). É o caminho seguro: transacional por
# arquivo e idempotente, então rodar de novo num banco já migrado não dói.
./db/aplicar-schemas.sh "$DATABASE_URL"
# alternativa manual, só este arquivo (se já souber que os outros 8 estão em dia):
# psql "$DATABASE_URL" -f db/estoque-ciclo.sql

# fin — fora do runner, outra conexão, outra role. Ver seção 4.
psql "$DATABASE_URL_FIN" -f db/fin-ciclo.sql

npm install && npm run build
pm2 restart vamaq

git rev-parse --short HEAD   # única prova de qual commit ficou rodando — não pular
```

Migration sempre antes do código: `ciclo` entrou no `SELECT_COLS` de
`src/lib/vehicleStore.js`, que sustenta nove consultas — `readVehicles` e
`getVehicleById` entre elas. Se o código subir antes de `db/estoque-ciclo.sql`
estar aplicado, quebra a listagem inteira de veículos no admin, não só o botão
novo.

### Smoke check (código 200 não prova nada aqui)

`getAllVehicles` (`src/lib/repositories/vehicles.js`) tem `catch` que devolve
`[]` — sem o schema do `public` aplicado, a home e o `/acervo` continuam
respondendo **200, com zero veículos**, e o único sinal é um `console.error`
no log do pm2.

```bash
# 1. a vitrine lista carros de verdade, não só responde 200
curl -s https://vamaqmotors.com.br/acervo | grep -o "Tenho Interesse" | wc -l
# tem que voltar mais que zero. Use `grep -o | wc -l`, não `grep -c`: -c conta
# LINHAS com ocorrência, e o HTML do Next varia de quebra de linha entre um
# build e outro — dá pra ler uma queda que não existe.

# 2. a coluna existe no public e o default pegou nas linhas antigas
psql "$DATABASE_URL" -c "select count(*) from vehicles where ciclo <> 1"
# sem a coluna aplicada isto não devolve um número — devolve
# "ERROR: column "ciclo" does not exist" na cara. Por isso o check é sobre a
# query RODAR, não só sobre o valor. Esperado: 0 (nenhum carro trocou de
# ciclo ainda — é o primeiro deploy da feature).

# 3. o mesmo do lado fin — é o que o check 2 NÃO cobre
psql "$DATABASE_URL_FIN" -c "select count(*) from fin.transactions where ciclo <> 1"
# mesma lógica: erro alto se a coluna não existe, 0 é o esperado.
```

O check 1 prova que o site está de pé. Os checks 2 e 3 provam que os dois
schemas aplicaram — e são os únicos que pegam uma falha do lado `fin`: o
`/acervo` fica bonito mesmo com `fin.transactions` sem `ciclo`, porque essa
tabela só entra em jogo na hora de emitir uma nota de venda.

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
  sintoma duplo — o admin responde 500 nas rotas de veículo e a vitrine
  pública fica no ar com zero carros. Aplique o(s) `.sql` que faltou e só
  então repita `npm run build && pm2 restart vamaq`; reiniciar o pm2 sozinho
  não resolve.
- **Só percebeu depois do deploy completo:** rode os três smoke checks acima
  para descobrir qual conexão ficou pra trás antes de aplicar qualquer coisa
  de novo.
