-- ============================================================================
-- VAMAQ MOTORS — assinatura eletrônica (Assinafy) dos documentos gerados.
--
-- Uma linha por ENVIO de um documento para assinatura. O contrato em si
-- continua em documentos_gerados; aqui fica o rastro do que aconteceu com ele
-- no Assinafy: quem assina, em que ordem, onde está o link de cada um e onde
-- caiu o PDF assinado quando voltou.
--
-- Por que uma tabela e não colunas em documentos_gerados: um mesmo contrato
-- pode ser reenviado (o cliente recusou, o e-mail estava errado, o prazo
-- expirou). Cada tentativa é uma linha, e o histórico das anteriores é o que
-- explica a atual. `envio_atual_de_documento_idx` garante que só uma esteja
-- viva por vez.
--
-- Aplicar:  psql "$DATABASE_URL" -f db/assinatura-schema.sql   (re-aplicável)
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists documento_assinaturas (
  id                    uuid primary key default gen_random_uuid(),

  -- O documento que foi enviado. `cascade` aqui é proposital e é o oposto da
  -- regra de documentos_gerados: aquele é prova e nunca some, mas um registro
  -- de envio sem o documento que foi enviado não é prova de nada.
  documento_id          uuid not null references documentos_gerados(id) on delete cascade,

  -- Identificadores do lado do Assinafy. `document_id` é único porque o mesmo
  -- documento lá nunca corresponde a dois envios nossos — é o que permite ao
  -- webhook achar a linha certa sem depender do corpo do evento.
  assinafy_document_id  text not null unique,
  assinafy_assignment_id text,

  -- Espelha o status do Assinafy (ver GET /v1/documents/statuses). Guardado
  -- como texto livre de propósito: se eles criarem um status novo, o webhook
  -- grava em vez de estourar. A tela traduz o que conhece e mostra o cru no
  -- resto.
  status                text not null default 'uploaded',

  -- [{ papel, nome, email, assinafy_signer_id, step, signing_url, assinado_em }]
  -- O signing_url é o fallback que a Mayra manda por WhatsApp quando o e-mail
  -- não chega.
  signers               jsonb not null default '[]'::jsonb,

  -- Caminho relativo do PDF assinado dentro de data/documentos, preenchido só
  -- quando o documento volta certificado. Null enquanto ninguém terminou.
  arquivo_assinado      text,
  assinado_em           timestamptz,

  -- Motivo da recusa, quando status = rejected_by_signer.
  recusa_motivo         text,

  enviado_por           uuid references users(id) on delete set null,

  -- Último payload relevante, para depurar sem precisar do painel deles.
  raw                   jsonb,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Estados em que o envio ainda está "vivo" — ninguém assinou até o fim, nem
-- recusou, nem expirou. Reenviar um documento nesse estado seria criar duas
-- coletas concorrentes para o mesmo contrato, com dois links válidos e duas
-- vias assinadas diferentes. O índice parcial abaixo torna isso impossível no
-- banco, não só na tela.
create unique index if not exists documento_assinaturas_envio_atual_idx
  on documento_assinaturas(documento_id)
  where status in ('uploading','uploaded','metadata_processing','metadata_ready',
                   'pending_signature','certificating');

create index if not exists documento_assinaturas_documento_idx
  on documento_assinaturas(documento_id, created_at desc);

create index if not exists documento_assinaturas_status_idx
  on documento_assinaturas(status);

-- updated_at sempre acompanha a última escrita. Sem isto, "parado há 3 dias"
-- vira uma pergunta sem resposta.
create or replace function documento_assinaturas_touch() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists documento_assinaturas_touch_trg on documento_assinaturas;
create trigger documento_assinaturas_touch_trg
  before update on documento_assinaturas
  for each row execute function documento_assinaturas_touch();
