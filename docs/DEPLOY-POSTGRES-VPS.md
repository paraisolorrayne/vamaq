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

## 4. Aplicar o schema

```bash
cd "$APP_DIR"
PGPASSWORD='TROQUE_ESTA_SENHA' psql "postgres://vamaq@localhost:5432/vamaq" -f db/schema.sql
```

Deve criar as tabelas `vehicles` e `vehicle_images`. Conferir:

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
