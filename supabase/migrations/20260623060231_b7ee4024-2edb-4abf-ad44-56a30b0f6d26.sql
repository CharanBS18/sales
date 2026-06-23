
-- Enums
create type public.app_role as enum ('admin', 'user');
create type public.payment_status as enum ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
create type public.login_status as enum ('ONLINE', 'OFFLINE', 'SESSION_EXPIRED');

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- =========================
-- profiles
-- =========================
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  email text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create policy "Users read own profile" on public.profiles
  for select to authenticated using (auth.uid() = user_id);
create policy "Users update own profile" on public.profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- =========================
-- user_roles + has_role
-- =========================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users read own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);
create policy "Admins read all roles" on public.user_roles
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Admins read all profiles
create policy "Admins read all profiles" on public.profiles
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- =========================
-- handle_new_user: auto-create profile + default 'user' role
-- =========================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uname text;
begin
  uname := coalesce(new.raw_user_meta_data->>'username',
                    split_part(new.email, '@', 1));
  -- ensure uniqueness with suffix if needed
  if exists (select 1 from public.profiles where username = uname) then
    uname := uname || '_' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  insert into public.profiles (user_id, username, email)
    values (new.id, uname, new.email);
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =========================
-- projects
-- =========================
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null default 'General',
  thumbnail_url text,
  file_key text not null,             -- S3 object key (private)
  file_size_bytes bigint,
  version text not null default '1.0.0',
  tags text[] not null default '{}',
  price_paise integer not null check (price_paise >= 0),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.projects to authenticated;
grant all on public.projects to service_role;
alter table public.projects enable row level security;

create policy "Authenticated read published projects" on public.projects
  for select to authenticated using (is_published or public.has_role(auth.uid(), 'admin'));
create policy "Admins manage projects" on public.projects
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- =========================
-- payments
-- =========================
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  gateway text not null default 'razorpay',
  order_id text not null unique,
  payment_id text,
  amount_paise integer not null,
  status public.payment_status not null default 'PENDING',
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;

create policy "Users read own payments" on public.payments
  for select to authenticated using (auth.uid() = user_id);
create policy "Admins read all payments" on public.payments
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- =========================
-- purchases (granted access rows)
-- =========================
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  amount_paise integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, project_id)
);
grant select on public.purchases to authenticated;
grant all on public.purchases to service_role;
alter table public.purchases enable row level security;

create policy "Users read own purchases" on public.purchases
  for select to authenticated using (auth.uid() = user_id);
create policy "Admins read all purchases" on public.purchases
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- =========================
-- download_logs
-- =========================
create table public.download_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);
grant select on public.download_logs to authenticated;
grant all on public.download_logs to service_role;
alter table public.download_logs enable row level security;

create policy "Users read own downloads" on public.download_logs
  for select to authenticated using (auth.uid() = user_id);
create policy "Admins read all downloads" on public.download_logs
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- =========================
-- login_activity
-- =========================
create table public.login_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ip_address text,
  browser text,
  os text,
  device_type text,
  status public.login_status not null default 'ONLINE',
  login_time timestamptz not null default now(),
  logout_time timestamptz
);
grant select on public.login_activity to authenticated;
grant all on public.login_activity to service_role;
alter table public.login_activity enable row level security;

create policy "Users read own logins" on public.login_activity
  for select to authenticated using (auth.uid() = user_id);
create policy "Admins read all logins" on public.login_activity
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- =========================
-- audit_logs
-- =========================
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;

create policy "Admins read audit logs" on public.audit_logs
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- helpful indexes
create index on public.payments (user_id);
create index on public.payments (status);
create index on public.purchases (user_id);
create index on public.download_logs (user_id);
create index on public.download_logs (project_id);
create index on public.login_activity (user_id);
create index on public.audit_logs (created_at desc);
