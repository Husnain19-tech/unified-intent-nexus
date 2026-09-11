create extension if not exists vector;

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null default 'source',
  source_id uuid references public.sources(id) on delete cascade,
  commitment_id uuid references public.commitments(id) on delete cascade,
  chunk_index int not null default 0,
  heading text,
  content text not null,
  embedding vector(3072) not null,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.knowledge_chunks to authenticated;
grant all on public.knowledge_chunks to service_role;

alter table public.knowledge_chunks enable row level security;

drop policy if exists "members manage knowledge chunks" on public.knowledge_chunks;
create policy "members manage knowledge chunks" on public.knowledge_chunks
  for all to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create index if not exists knowledge_chunks_org_idx on public.knowledge_chunks (org_id, kind);
create index if not exists knowledge_chunks_source_idx on public.knowledge_chunks (source_id);
create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks using hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

create or replace function public.match_knowledge_chunks(
  v_org uuid,
  query_embedding vector(3072),
  match_count int default 8,
  v_kind text default 'source'
)
returns table (
  id uuid,
  source_id uuid,
  commitment_id uuid,
  heading text,
  content text,
  similarity float
)
language sql
stable
set search_path = public
as $$
  select k.id, k.source_id, k.commitment_id, k.heading, k.content,
         1 - (k.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) as similarity
  from public.knowledge_chunks k
  where k.org_id = v_org and k.kind = v_kind
  order by k.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  limit match_count;
$$;

revoke all on function public.match_knowledge_chunks(uuid, vector, int, text) from public, anon;
grant execute on function public.match_knowledge_chunks(uuid, vector, int, text) to authenticated, service_role;