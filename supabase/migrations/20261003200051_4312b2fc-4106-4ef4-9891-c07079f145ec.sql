create extension if not exists pg_cron;
create extension if not exists pg_net;

create table public.agent_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  paused boolean not null default false,
  pause_reason text,
  lease_until timestamptz,
  last_run_at timestamptz,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.agent_settings to authenticated;
grant all on public.agent_settings to service_role;
alter table public.agent_settings enable row level security;
create policy "org agent settings" on public.agent_settings for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  trigger text not null default 'manual',
  status text not null default 'running',
  decisions int not null default 0,
  summary text,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
grant select, insert, update on public.agent_runs to authenticated;
grant all on public.agent_runs to service_role;
alter table public.agent_runs enable row level security;
create policy "org agent runs" on public.agent_runs for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create index agent_runs_org_idx on public.agent_runs (org_id, started_at desc);

create table public.agent_decisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  agent text not null,
  action text not null,
  target_table text not null,
  target_id uuid not null,
  target_label text,
  before jsonb,
  after jsonb,
  created_record boolean not null default false,
  rationale text,
  undone_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.agent_decisions to authenticated;
grant all on public.agent_decisions to service_role;
alter table public.agent_decisions enable row level security;
create policy "org agent decisions" on public.agent_decisions for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create index agent_decisions_org_idx on public.agent_decisions (org_id, created_at desc);

-- Private token used only by the hourly scheduler; not reachable by app users.
create table public.scheduler_tokens (
  id int primary key,
  token text not null
);
grant all on public.scheduler_tokens to service_role;
revoke all on public.scheduler_tokens from anon, authenticated;
alter table public.scheduler_tokens enable row level security;
insert into public.scheduler_tokens (id, token)
values (1, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (id) do nothing;

-- Single-flight lease so two agent runs never overlap for one organization.
create or replace function public.acquire_agent_lease(v_org uuid, v_seconds int default 600)
returns boolean
language plpgsql
set search_path = public
as $$
declare got boolean;
begin
  insert into public.agent_settings (org_id) values (v_org) on conflict (org_id) do nothing;
  update public.agent_settings
     set lease_until = now() + make_interval(secs => v_seconds), updated_at = now()
   where org_id = v_org and (lease_until is null or lease_until < now())
  returning true into got;
  return coalesce(got, false);
end;
$$;
revoke all on function public.acquire_agent_lease(uuid, int) from public, anon;
grant execute on function public.acquire_agent_lease(uuid, int) to authenticated, service_role;