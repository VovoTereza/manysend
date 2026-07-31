create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'operator' check (role in ('admin','operator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id,email,display_name,role)
  values (new.id,new.email,coalesce(new.raw_user_meta_data->>'display_name',new.email),
    case when lower(new.email)='acartomantereal@gmail.com' then 'admin' else 'operator' end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

create table public.workspace_settings (
  id uuid primary key default gen_random_uuid(),
  brand text not null default 'Vovó Tereza',
  instagram_handle text,
  website_url text,
  timezone text not null default 'America/Sao_Paulo',
  language text not null default 'pt-BR',
  ai_name text not null default 'Vovó Tereza',
  ai_tone text not null default 'Acolhedor e didático',
  ai_instructions text not null default '',
  auto_replies boolean not null default false,
  interest_tags boolean not null default false,
  human_handoff boolean not null default true,
  frequency_limit boolean not null default true,
  notification_preferences jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check(platform in ('instagram','facebook','youtube','tiktok','whatsapp','messenger')),
  external_account_id text not null,
  display_name text,
  username text,
  status text not null default 'pending' check(status in ('pending','connected','expired','error','disconnected')),
  permissions text[] not null default '{}',
  token_ciphertext text,
  token_expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(platform,external_account_id)
);

create table public.audience_metrics (
  id bigint generated always as identity primary key,
  social_account_id uuid not null references public.social_accounts(id) on delete cascade,
  followers bigint,
  reach bigint,
  impressions bigint,
  views bigint,
  period_start timestamptz,
  period_end timestamptz,
  captured_at timestamptz not null default now(),
  raw_metrics jsonb not null default '{}'::jsonb
);
create index audience_metrics_account_captured_idx on public.audience_metrics(social_account_id,captured_at desc);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  social_account_id uuid references public.social_accounts(id) on delete set null,
  external_user_id text,
  display_name text,
  username text,
  email text,
  phone text,
  tags text[] not null default '{}',
  consent_status text not null default 'unknown' check(consent_status in ('unknown','granted','revoked')),
  consent_source text,
  consent_at timestamptz,
  unsubscribed_at timestamptz,
  last_interaction_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(social_account_id,external_user_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  social_account_id uuid references public.social_accounts(id) on delete set null,
  platform_thread_id text,
  status text not null default 'open' check(status in ('open','pending','closed')),
  assigned_to uuid references public.profiles(id),
  unread_count integer not null default 0,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique(social_account_id,platform_thread_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  external_message_id text,
  direction text not null check(direction in ('inbound','outbound')),
  sender_type text not null check(sender_type in ('contact','admin','automation','ai')),
  body text,
  media jsonb not null default '[]'::jsonb,
  delivery_status text not null default 'received',
  sent_at timestamptz not null default now(),
  unique(conversation_id,external_message_id)
);

create table public.automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform text,
  trigger_type text not null,
  configuration jsonb not null default '{}'::jsonb,
  active boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  title text,
  caption text,
  media jsonb not null default '[]'::jsonb,
  publish_mode text not null default 'draft' check(publish_mode in ('draft','scheduled','immediate')),
  scheduled_at timestamptz,
  status text not null default 'draft' check(status in ('draft','scheduled','publishing','published','partial','failed')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.post_targets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  social_account_id uuid not null references public.social_accounts(id) on delete cascade,
  platform_options jsonb not null default '{}'::jsonb,
  external_post_id text,
  external_url text,
  status text not null default 'pending',
  error_message text,
  published_at timestamptz,
  unique(post_id,social_account_id)
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft' check(status in ('draft','scheduled','running','paused','completed','failed')),
  audience_filter jsonb not null default '{}'::jsonb,
  message_template text not null,
  consent_required boolean not null default true,
  scheduled_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.social_accounts enable row level security;
alter table public.audience_metrics enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.automations enable row level security;
alter table public.posts enable row level security;
alter table public.post_targets enable row level security;
alter table public.campaigns enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_admin_all on public.profiles for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy settings_admin_all on public.workspace_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy accounts_admin_all on public.social_accounts for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy metrics_admin_all on public.audience_metrics for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy contacts_admin_all on public.contacts for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy conversations_admin_all on public.conversations for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy messages_admin_all on public.messages for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy automations_admin_all on public.automations for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy posts_admin_all on public.posts for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy targets_admin_all on public.post_targets for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy campaigns_admin_all on public.campaigns for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy audit_admin_read on public.audit_logs for select to authenticated using(public.is_admin());

revoke all on public.social_accounts from anon;
revoke all on public.audience_metrics from anon;
revoke all on public.contacts from anon;
revoke all on public.conversations from anon;
revoke all on public.messages from anon;

insert into public.workspace_settings (brand,instagram_handle,website_url,ai_instructions)
values ('Vovó Tereza','@vovotereza','https://vovotereza.com.br','Responda com acolhimento e use somente informações verificadas. Encaminhe para atendimento humano quando necessário.');

