-- Run this in the Supabase SQL editor (Dashboard → SQL Editor). Safe to run more than once.
-- Manual safety net: who checked each document with an expiry date against the uploaded file,
-- and who verified a PCAB license on the PCAB website.

-- 1. Where the checks are stored
alter table vendor_doc_expiry add column if not exists checked_by            uuid;
alter table vendor_doc_expiry add column if not exists checked_by_name       text;
alter table vendor_doc_expiry add column if not exists checked_at            timestamptz;
alter table vendor_doc_expiry add column if not exists pcab_verified_by      uuid;
alter table vendor_doc_expiry add column if not exists pcab_verified_by_name text;
alter table vendor_doc_expiry add column if not exists pcab_verified_at      timestamptz;

-- 2. The vendor portal (anon key) may only write the fields vendors fill in, never the checks
revoke insert, update on vendor_doc_expiry from anon;
grant insert (vendor_id, doc_type, expiry_date, source, reg_number, reg_date) on vendor_doc_expiry to anon;
grant update (vendor_id, doc_type, expiry_date, source, reg_number, reg_date) on vendor_doc_expiry to anon;

-- 3. The team (logged in) can record checks
drop policy if exists "auth update doc expiry" on vendor_doc_expiry;
create policy "auth update doc expiry" on vendor_doc_expiry for update to authenticated using (true) with check (true);

-- 4. A changed expiry date clears its checks
create or replace function clear_doc_check_on_date_change() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.expiry_date is distinct from old.expiry_date then
    new.checked_by := null; new.checked_by_name := null; new.checked_at := null;
    new.pcab_verified_by := null; new.pcab_verified_by_name := null; new.pcab_verified_at := null;
  end if;
  return new;
end $$;

drop trigger if exists clear_doc_check_on_date_change on vendor_doc_expiry;
create trigger clear_doc_check_on_date_change before update on vendor_doc_expiry
  for each row execute function clear_doc_check_on_date_change();

-- 5. A replaced document clears its checks; a replaced PCAB proof clears the PCAB verification
create or replace function clear_doc_check_on_new_file() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.file_url is distinct from old.file_url then
    update vendor_doc_expiry
       set checked_by = null, checked_by_name = null, checked_at = null,
           pcab_verified_by = null, pcab_verified_by_name = null, pcab_verified_at = null
     where vendor_id = new.vendor_id and doc_type = new.document_type;
    if new.document_type = 'PCAB Online Verification' then
      update vendor_doc_expiry
         set pcab_verified_by = null, pcab_verified_by_name = null, pcab_verified_at = null
       where vendor_id = new.vendor_id and doc_type = 'PCAB License';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists clear_doc_check_on_new_file on vendor_documents;
create trigger clear_doc_check_on_new_file after insert or update on vendor_documents
  for each row execute function clear_doc_check_on_new_file();
