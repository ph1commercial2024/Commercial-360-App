-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- Hands out PR numbers from the database so they never repeat and restart at 0001 each year.

create table if not exists pr_number_counters (
  year        integer primary key,
  last_value  integer not null
);

-- Only the function below touches this table
alter table pr_number_counters enable row level security;

-- Start each year's counter after the highest number already used that year
insert into pr_number_counters (year, last_value)
select split_part(pr_number, '-', 2)::int, max(split_part(pr_number, '-', 3)::int)
from purchase_requests
where pr_number ~ '^PR-[0-9]{4}-[0-9]+$'
group by 1
on conflict (year) do update set last_value = greatest(pr_number_counters.last_value, excluded.last_value);

create or replace function next_pr_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  y integer := extract(year from now() at time zone 'Asia/Manila');
  n integer;
begin
  insert into pr_number_counters (year, last_value) values (y, 1)
  on conflict (year) do update set last_value = pr_number_counters.last_value + 1
  returning last_value into n;
  return 'PR-' || y || '-' || case when n < 10000 then lpad(n::text, 4, '0') else n::text end;
end;
$$;

revoke all on function next_pr_number() from public;
grant execute on function next_pr_number() to authenticated;

-- Safety net: the database itself refuses a duplicate PR number
create unique index if not exists purchase_requests_pr_number_key on purchase_requests (pr_number);
