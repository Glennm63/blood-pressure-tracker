begin;
create table public.pressure_readings (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null check (length(id) between 1 and 100),
 sys integer not null check (sys between 1 and 400),
 dia integer not null check (dia between 1 and 300 and dia < sys),
 pulse integer check (pulse between 1 and 300),
 time timestamptz not null check (isfinite(time) and time <= now()),
 note text not null default '' check (length(note) <= 500),
 primary key (user_id,id)
);
create index pressure_readings_time on public.pressure_readings(user_id,time);
alter table public.pressure_readings enable row level security;
alter table public.pressure_readings force row level security;
revoke all on public.pressure_readings from public,anon;
grant select,insert,update,delete on public.pressure_readings to authenticated;
create policy pressure_select on public.pressure_readings for select to authenticated
 using ((select auth.uid()) = user_id);
create policy pressure_insert on public.pressure_readings for insert to authenticated
 with check ((select auth.uid()) = user_id);
create policy pressure_update on public.pressure_readings for update to authenticated
 using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy pressure_delete on public.pressure_readings for delete to authenticated
 using ((select auth.uid()) = user_id);
commit;
