-- Jarvis Finance, migração 010: foto de perfil. Rode UMA vez.

alter table public.membros add column if not exists foto_url text;

-- Cada pessoa troca a própria foto em todas as carteiras dela.
create or replace function public.atualizar_minha_foto(p_url text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_url is not null and char_length(p_url) > 500 then
    raise exception 'Endereço da foto inválido';
  end if;
  update public.membros set foto_url = p_url where user_id = auth.uid();
end;
$$;
revoke all on function public.atualizar_minha_foto(text) from public, anon;
grant execute on function public.atualizar_minha_foto(text) to authenticated;

-- Bucket público para leitura (só avatares); cada pessoa mexe só na própria pasta.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists avatares_enviar on storage.objects;
drop policy if exists avatares_trocar on storage.objects;
drop policy if exists avatares_apagar on storage.objects;
create policy avatares_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatares_trocar on storage.objects for update to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatares_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
