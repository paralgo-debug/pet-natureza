-- Pet Natureza · Migração 002 · Página inicial
-- Atualiza a função de publicação para validar também "inicio" (página inicial) e os links de "redes".
-- Pode ser executada mais de uma vez sem problema.
-- Como executar: Supabase > SQL Editor > New query > colar > Run.

create or replace function public.publish_settings(p_keys text[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  k text;
  a text;
  u text;
  d public.settings_draft%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Você não tem permissão para publicar alterações.' using errcode = '42501';
  end if;

  foreach k in array p_keys loop
    select * into d from public.settings_draft where key = k;
    if not found then continue; end if;

    -- ---------- Informações da empresa ----------
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

    -- ---------- Redes sociais: os endereços (se informados) precisam começar com https:// ----------
    if k = 'redes' then
      foreach u in array array['instagram_url', 'facebook_url', 'threads_url', 'tiktok_url'] loop
        if coalesce(d.value ->> u, '') <> ''
           and ((d.value ->> u) !~ '^https://[^[:space:]]+$' or length(d.value ->> u) > 300) then
          raise exception 'Um dos endereços das redes sociais é inválido. Ele deve começar com https://';
        end if;
      end loop;
    end if;

    -- ---------- Página inicial ----------
    if k = 'inicio' then
      if length(d.value::text) > 80000 then
        raise exception 'O conteúdo da página inicial está grande demais.';
      end if;
      if coalesce(trim(d.value #>> '{hero,titulo}'), '') = '' then
        raise exception 'O título da seção principal é obrigatório.';
      end if;
      if jsonb_typeof(d.value -> 'servicos') is distinct from 'array'
         or jsonb_array_length(d.value -> 'servicos') > 30 then
        raise exception 'A lista de serviços é inválida ou tem itens demais (máximo 30).';
      end if;
      if jsonb_typeof(d.value -> 'diferenciais') is distinct from 'array'
         or jsonb_array_length(d.value -> 'diferenciais') > 12 then
        raise exception 'A lista de diferenciais é inválida ou tem itens demais (máximo 12).';
      end if;
      foreach a in array array['loja', 'banho', 'vet'] loop
        if coalesce(trim(d.value #>> array['acoes', a, 'titulo']), '') = ''
           or coalesce(trim(d.value #>> array['acoes', a, 'rotulo']), '') = '' then
          raise exception 'Preencha o título e o texto do botão dos três cartões de ação.';
        end if;
      end loop;
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

revoke all on function public.publish_settings(text[]) from public, anon;
grant execute on function public.publish_settings(text[]) to authenticated;
