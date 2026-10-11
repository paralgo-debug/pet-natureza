-- Pet Natureza · Migração 001 · Base
-- Usuários e perfis, configurações públicas (rascunho/publicado), revisões e auditoria.
-- Como executar: Supabase > SQL Editor > New query > colar este arquivo > Run.

-- ============================================================
-- 1. PERFIS (papéis: administrador e funcionario)
-- ============================================================
create table if not exists public.profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  nome      text not null check (char_length(nome) between 2 and 80),
  papel     text not null default 'funcionario' check (papel in ('administrador', 'funcionario')),
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Funções auxiliares (security definer evita recursão nas políticas de RLS)
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and ativo);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and ativo and papel = 'administrador');
$$;

drop policy if exists "perfil: ver o próprio" on public.profiles;
create policy "perfil: ver o próprio" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "perfil: administrador gerencia" on public.profiles;
create policy "perfil: administrador gerencia" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 2. AUDITORIA
-- ============================================================
create table if not exists public.audit_events (
  id        bigint generated always as identity primary key,
  user_id   uuid references auth.users(id) on delete set null,
  acao      text not null,
  entidade  text not null,
  detalhes  jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists audit_events_criado_em_idx on public.audit_events (criado_em desc);

alter table public.audit_events enable row level security;

drop policy if exists "auditoria: administrador lê" on public.audit_events;
create policy "auditoria: administrador lê" on public.audit_events
  for select to authenticated using (public.is_admin());
-- Sem política de escrita: só funções internas gravam (log_audit).

create or replace function public.log_audit(p_acao text, p_entidade text, p_detalhes jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_events (user_id, acao, entidade, detalhes)
  values (auth.uid(), p_acao, p_entidade, coalesce(p_detalhes, '{}'::jsonb));
$$;
revoke all on function public.log_audit(text, text, jsonb) from public, anon, authenticated;

-- ============================================================
-- 3. CONFIGURAÇÕES: publicado (público) x rascunho (privado) x revisões
-- ============================================================
create table if not exists public.settings_published (
  key          text primary key,
  value        jsonb not null check (jsonb_typeof(value) = 'object'),
  published_at timestamptz not null default now(),
  published_by uuid references auth.users(id) on delete set null
);

create table if not exists public.settings_draft (
  key        text primary key,
  value      jsonb not null check (jsonb_typeof(value) = 'object'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.settings_revisions (
  id           bigint generated always as identity primary key,
  key          text not null,
  value        jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users(id) on delete set null
);
create index if not exists settings_revisions_key_idx on public.settings_revisions (key, published_at desc);

alter table public.settings_published enable row level security;
alter table public.settings_draft     enable row level security;
alter table public.settings_revisions enable row level security;

-- Publicado: qualquer visitante lê (o site público usa isso). Ninguém escreve direto: só a função publish_settings.
drop policy if exists "publicado: leitura pública" on public.settings_published;
create policy "publicado: leitura pública" on public.settings_published
  for select to anon, authenticated using (true);

-- Rascunho: equipe lê; só administrador escreve.
drop policy if exists "rascunho: equipe lê" on public.settings_draft;
create policy "rascunho: equipe lê" on public.settings_draft
  for select to authenticated using (public.is_staff());

drop policy if exists "rascunho: administrador escreve" on public.settings_draft;
create policy "rascunho: administrador escreve" on public.settings_draft
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Revisões: só administrador lê. Gravadas apenas pela função de publicação.
drop policy if exists "revisões: administrador lê" on public.settings_revisions;
create policy "revisões: administrador lê" on public.settings_revisions
  for select to authenticated using (public.is_admin());

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists settings_draft_touch on public.settings_draft;
create trigger settings_draft_touch before update on public.settings_draft
  for each row execute function public.touch_updated_at();

-- ============================================================
-- 4. FUNÇÕES DE PUBLICAÇÃO (validam no servidor, em uma transação)
-- ============================================================
create or replace function public.publish_settings(p_keys text[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  k text;
  d public.settings_draft%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Você não tem permissão para publicar alterações.' using errcode = '42501';
  end if;

  foreach k in array p_keys loop
    select * into d from public.settings_draft where key = k;
    if not found then continue; end if;

    if k = 'empresa' then
      if coalesce(trim(d.value ->> 'nome'), '') = '' then
        raise exception 'O nome da empresa é obrigatório.';
      end if;
      if coalesce(d.value ->> 'whatsapp', '') !~ '^55[0-9]{10,11}$' then
        raise exception 'O WhatsApp informado é inválido. Use DDD e número, por exemplo (98) 98440-2286.';
      end if;
      if coalesce(d.value ->> 'email', '') <> ''
         and (d.value ->> 'email') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
        raise exception 'O e-mail informado é inválido.';
      end if;
    end if;

    insert into public.settings_published (key, value, published_at, published_by)
    values (k, d.value, now(), auth.uid())
    on conflict (key) do update
      set value = excluded.value, published_at = excluded.published_at, published_by = excluded.published_by;

    insert into public.settings_revisions (key, value, published_by) values (k, d.value, auth.uid());
    delete from public.settings_draft where key = k;
    perform public.log_audit('publicar', 'configuracao', jsonb_build_object('chave', k));
  end loop;
end $$;

create or replace function public.descartar_rascunho(p_key text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Você não tem permissão para descartar rascunhos.' using errcode = '42501';
  end if;
  delete from public.settings_draft where key = p_key;
  perform public.log_audit('descartar', 'configuracao', jsonb_build_object('chave', p_key));
end $$;

create or replace function public.restaurar_revisao(p_revisao bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r public.settings_revisions%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Você não tem permissão para restaurar versões.' using errcode = '42501';
  end if;
  select * into r from public.settings_revisions where id = p_revisao;
  if not found then
    raise exception 'Versão não encontrada.';
  end if;
  insert into public.settings_draft (key, value, updated_by)
  values (r.key, r.value, auth.uid())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by;
  perform public.log_audit('restaurar', 'configuracao', jsonb_build_object('chave', r.key, 'revisao', p_revisao));
end $$;

revoke all on function public.publish_settings(text[])     from public, anon;
revoke all on function public.descartar_rascunho(text)     from public, anon;
revoke all on function public.restaurar_revisao(bigint)    from public, anon;
grant execute on function public.publish_settings(text[])  to authenticated;
grant execute on function public.descartar_rascunho(text)  to authenticated;
grant execute on function public.restaurar_revisao(bigint) to authenticated;

-- ============================================================
-- 5. DADOS INICIAIS (já publicados, para o site público funcionar de imediato)
-- ============================================================
insert into public.settings_published (key, value) values
('empresa', jsonb_build_object(
  'nome',      'Pet Natureza',
  'slogan',    'Há 9 anos cuidando do bem-estar do seu Pet!',
  'descricao', 'Pet shop na Cidade Operária com Banho & Tosa, serviços veterinários, farmácia pet, acessórios, itens de higiene, rações, petiscos e muito mais!',
  'whatsapp',  '5598984402286',
  'email',     'petnatureza@gmail.com',
  'endereco',  'Av. 205, n° 10, Cidade Operária, São Luís, Maranhão',
  'horarios',  ''
)),
('redes', jsonb_build_object(
  'instagram', '@petnatureza',
  'facebook',  'Pet Natureza',
  'threads',   'petnatureza',
  'tiktok',    'petnatureza'
))
on conflict (key) do nothing;

