-- Run this in the Supabase SQL editor (Dashboard → SQL Editor). Safe to run more than once.
-- Before: every logged-in account could read and change everything (including brand-new sign-ups and
-- deactivated users), and several tables (rfqs, rfq_vendors, rfq_submissions, rfp_*, rfa_documents,
-- notifications) were open to anyone without logging in.
-- After: only ACTIVE staff with a POSITION (or admins) can use the data. New sign-ups have no position
-- until an admin assigns one, so they see nothing. The vendor portal keeps its existing access.

begin;

-- Active staff = active profile with a position, or an admin. Checked without re-applying profile policies.
create or replace function public.current_user_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select (coalesce(is_admin, false) or nullif(trim(position), '') is not null) and coalesce(is_active, true)
    from profiles where id = auth.uid()
  ), false)
$$;
revoke all on function public.current_user_is_staff() from public;
grant execute on function public.current_user_is_staff() to authenticated;

-- New accounts never start with a position or admin rights. Admin "Add user" sets them right after
-- (the create-user function updates the profile with the service key), so it keeps working.
alter table profiles alter column position drop not null;
alter table profiles alter column position drop default;
create or replace function public.profiles_new_no_access() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.position := null;
  new.is_admin := false;
  return new;
end $$;
drop trigger if exists profiles_new_no_access on profiles;
create trigger profiles_new_no_access before insert on profiles
  for each row execute function public.profiles_new_no_access();

-- budget_codes
drop policy if exists "Authenticated users can delete budget codes" on budget_codes;
create policy "Authenticated users can delete budget codes" on budget_codes for delete to authenticated using (public.current_user_is_staff());
drop policy if exists "Authenticated users can insert budget codes" on budget_codes;
create policy "Authenticated users can insert budget codes" on budget_codes for insert to authenticated with check (public.current_user_is_staff());
drop policy if exists "Authenticated users can read budget codes" on budget_codes;
create policy "Authenticated users can read budget codes" on budget_codes for select to authenticated using (public.current_user_is_staff());
drop policy if exists "Authenticated users can update budget codes" on budget_codes;
create policy "Authenticated users can update budget codes" on budget_codes for update to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());

-- business_units
drop policy if exists "Admins can delete business units" on business_units;
create policy "Admins can delete business units" on business_units for delete to authenticated using (public.current_user_is_staff());
drop policy if exists "Admins can manage business units" on business_units;
create policy "Admins can manage business units" on business_units for insert to authenticated with check (public.current_user_is_staff());
drop policy if exists "Admins can update business units" on business_units;
create policy "Admins can update business units" on business_units for update to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());
drop policy if exists "Authenticated users can view business units" on business_units;
create policy "Authenticated users can view business units" on business_units for select to authenticated using (public.current_user_is_staff());

-- contracts
drop policy if exists "auth_all_contracts" on contracts;
create policy "auth_all_contracts" on contracts for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());

-- cost_report_items
drop policy if exists "auth insert cost report items" on cost_report_items;
create policy "auth insert cost report items" on cost_report_items for insert to authenticated with check (public.current_user_is_staff());
drop policy if exists "auth read cost report items" on cost_report_items;
create policy "auth read cost report items" on cost_report_items for select to authenticated using (public.current_user_is_staff());

-- cost_report_lines
drop policy if exists "auth insert cost report lines" on cost_report_lines;
create policy "auth insert cost report lines" on cost_report_lines for insert to authenticated with check (public.current_user_is_staff());
drop policy if exists "auth read cost report lines" on cost_report_lines;
create policy "auth read cost report lines" on cost_report_lines for select to authenticated using (public.current_user_is_staff());

-- cost_reports
drop policy if exists "auth delete cost reports" on cost_reports;
create policy "auth delete cost reports" on cost_reports for delete to authenticated using (public.current_user_is_staff());
drop policy if exists "auth insert cost reports" on cost_reports;
create policy "auth insert cost reports" on cost_reports for insert to authenticated with check (public.current_user_is_staff());
drop policy if exists "auth read cost reports" on cost_reports;
create policy "auth read cost reports" on cost_reports for select to authenticated using (public.current_user_is_staff());

-- group_managers
drop policy if exists "Admins can delete group managers" on group_managers;
create policy "Admins can delete group managers" on group_managers for delete to authenticated using (public.current_user_is_staff());
drop policy if exists "Admins can manage group managers" on group_managers;
create policy "Admins can manage group managers" on group_managers for insert to authenticated with check (public.current_user_is_staff());
drop policy if exists "Authenticated users can view group managers" on group_managers;
create policy "Authenticated users can view group managers" on group_managers for select to authenticated using (public.current_user_is_staff());

-- pr_return_history
drop policy if exists "auth insert pr return history" on pr_return_history;
create policy "auth insert pr return history" on pr_return_history for insert to authenticated with check (public.current_user_is_staff());
drop policy if exists "auth read pr return history" on pr_return_history;
create policy "auth read pr return history" on pr_return_history for select to authenticated using (public.current_user_is_staff());
drop policy if exists "auth update pr return history" on pr_return_history;
create policy "auth update pr return history" on pr_return_history for update to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());

-- profiles
drop policy if exists "Authenticated users can view all profiles" on profiles;
create policy "Authenticated users can view all profiles" on profiles for select to authenticated using (public.current_user_is_staff());

-- projects
drop policy if exists "Admins can insert projects" on projects;
create policy "Admins can insert projects" on projects for insert to authenticated with check (public.current_user_is_staff());
drop policy if exists "Admins can update projects" on projects;
create policy "Admins can update projects" on projects for update to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());
drop policy if exists "Logged in users can view projects" on projects;
create policy "Logged in users can view projects" on projects for select to authenticated using (public.current_user_is_staff());

-- purchase_requests
drop policy if exists "Allow delete for authenticated" on purchase_requests;
create policy "Allow delete for authenticated" on purchase_requests for delete to authenticated using (public.current_user_is_staff());
drop policy if exists "Allow insert for authenticated" on purchase_requests;
create policy "Allow insert for authenticated" on purchase_requests for insert to authenticated with check (public.current_user_is_staff());
drop policy if exists "Allow select for authenticated" on purchase_requests;
create policy "Allow select for authenticated" on purchase_requests for select to authenticated using (public.current_user_is_staff());
drop policy if exists "Allow update for authenticated" on purchase_requests;
create policy "Allow update for authenticated" on purchase_requests for update to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());

-- rfa_vendors
drop policy if exists "rfa_vendors_all" on rfa_vendors;
create policy "rfa_vendors_all" on rfa_vendors for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());

-- rfas
drop policy if exists "rfas_all" on rfas;
create policy "rfas_all" on rfas for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());

-- scope_items
drop policy if exists "Authenticated users can delete scope items" on scope_items;
create policy "Authenticated users can delete scope items" on scope_items for delete to authenticated using (public.current_user_is_staff());
drop policy if exists "Authenticated users can insert scope items" on scope_items;
create policy "Authenticated users can insert scope items" on scope_items for insert to authenticated with check (public.current_user_is_staff());
drop policy if exists "Authenticated users can read scope items" on scope_items;
create policy "Authenticated users can read scope items" on scope_items for select to authenticated using (public.current_user_is_staff());
drop policy if exists "Authenticated users can update scope items" on scope_items;
create policy "Authenticated users can update scope items" on scope_items for update to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());

-- trade_categories
drop policy if exists "Admin delete trades" on trade_categories;
create policy "Admin delete trades" on trade_categories for delete to authenticated using (public.current_user_is_staff());
drop policy if exists "Admin read all trades" on trade_categories;
create policy "Admin read all trades" on trade_categories for select to authenticated using (public.current_user_is_staff());
drop policy if exists "Admin update trades" on trade_categories;
create policy "Admin update trades" on trade_categories for update to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());

-- vendor_accreditation_tokens
drop policy if exists "Authenticated users can create invite tokens" on vendor_accreditation_tokens;
create policy "Authenticated users can create invite tokens" on vendor_accreditation_tokens for insert to authenticated with check (public.current_user_is_staff());
drop policy if exists "Authenticated users can read tokens" on vendor_accreditation_tokens;
create policy "Authenticated users can read tokens" on vendor_accreditation_tokens for select to authenticated using (public.current_user_is_staff());
drop policy if exists "Authenticated users can update tokens" on vendor_accreditation_tokens;
create policy "Authenticated users can update tokens" on vendor_accreditation_tokens for update to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());

-- vendor_affiliates
drop policy if exists "Authenticated users can manage vendor affiliates" on vendor_affiliates;
create policy "Authenticated users can manage vendor affiliates" on vendor_affiliates for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());

-- vendor_clients
drop policy if exists "Authenticated users can manage vendor clients" on vendor_clients;
create policy "Authenticated users can manage vendor clients" on vendor_clients for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());

-- vendor_company_info
drop policy if exists "Authenticated users can manage vendor company info" on vendor_company_info;
create policy "Authenticated users can manage vendor company info" on vendor_company_info for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());

-- vendor_contacts
drop policy if exists "Authenticated users can manage vendor contacts" on vendor_contacts;
create policy "Authenticated users can manage vendor contacts" on vendor_contacts for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());

-- vendor_doc_expiry
drop policy if exists "auth update doc expiry" on vendor_doc_expiry;
create policy "auth update doc expiry" on vendor_doc_expiry for update to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());
drop policy if exists "auth_all" on vendor_doc_expiry;
create policy "auth_all" on vendor_doc_expiry for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());

-- vendor_documents
drop policy if exists "Authenticated users can manage vendor documents" on vendor_documents;
create policy "Authenticated users can manage vendor documents" on vendor_documents for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());

-- vendor_hseq
drop policy if exists "Authenticated users can manage vendor hseq" on vendor_hseq;
create policy "Authenticated users can manage vendor hseq" on vendor_hseq for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());

-- vendor_owners
drop policy if exists "Authenticated users can manage vendor owners" on vendor_owners;
create policy "Authenticated users can manage vendor owners" on vendor_owners for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());

-- vendor_projects
drop policy if exists "Authenticated users can manage vendor projects" on vendor_projects;
create policy "Authenticated users can manage vendor projects" on vendor_projects for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());

-- vendor_registration
drop policy if exists "Authenticated users can manage vendor registration" on vendor_registration;
create policy "Authenticated users can manage vendor registration" on vendor_registration for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());

-- vendor_return_history
drop policy if exists "auth insert return history" on vendor_return_history;
create policy "auth insert return history" on vendor_return_history for insert to authenticated with check (public.current_user_is_staff());
drop policy if exists "auth read return history" on vendor_return_history;
create policy "auth read return history" on vendor_return_history for select to authenticated using (public.current_user_is_staff());
drop policy if exists "auth update return history" on vendor_return_history;
create policy "auth update return history" on vendor_return_history for update to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());

-- vendor_submissions
drop policy if exists "auth read submissions" on vendor_submissions;
create policy "auth read submissions" on vendor_submissions for select to authenticated using (public.current_user_is_staff());

-- vendor_upload_failures
drop policy if exists "auth read upload failures" on vendor_upload_failures;
create policy "auth read upload failures" on vendor_upload_failures for select to authenticated using (public.current_user_is_staff());

-- vendors
drop policy if exists "Authenticated users can insert vendors" on vendors;
create policy "Authenticated users can insert vendors" on vendors for insert to authenticated with check (public.current_user_is_staff());
drop policy if exists "Authenticated users can update vendors" on vendors;
create policy "Authenticated users can update vendors" on vendors for update to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());
drop policy if exists "Authenticated users can view vendors" on vendors;
create policy "Authenticated users can view vendors" on vendors for select to authenticated using (public.current_user_is_staff());

-- Tables that were open to everyone, even without logging in
drop policy if exists "Allow all" on notifications;
drop policy if exists "staff all notifications" on notifications;
create policy "staff all notifications" on notifications for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());
drop policy if exists "anon full access rfa_documents" on rfa_documents;
drop policy if exists "staff all rfa_documents" on rfa_documents;
create policy "staff all rfa_documents" on rfa_documents for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());
drop policy if exists "Allow all" on rfp_boq_items;
drop policy if exists "staff all rfp_boq_items" on rfp_boq_items;
create policy "staff all rfp_boq_items" on rfp_boq_items for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());
drop policy if exists "Allow all" on rfp_evaluation_approvals;
drop policy if exists "staff all rfp_evaluation_approvals" on rfp_evaluation_approvals;
create policy "staff all rfp_evaluation_approvals" on rfp_evaluation_approvals for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());
drop policy if exists "Allow all" on rfp_evaluations;
drop policy if exists "staff all rfp_evaluations" on rfp_evaluations;
create policy "staff all rfp_evaluations" on rfp_evaluations for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());
drop policy if exists "Allow all" on rfp_proposal_boq;
drop policy if exists "staff all rfp_proposal_boq" on rfp_proposal_boq;
create policy "staff all rfp_proposal_boq" on rfp_proposal_boq for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());
drop policy if exists "Allow all" on rfp_proposals;
drop policy if exists "staff all rfp_proposals" on rfp_proposals;
create policy "staff all rfp_proposals" on rfp_proposals for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());
drop policy if exists "Allow all" on rfp_prs;
drop policy if exists "staff all rfp_prs" on rfp_prs;
create policy "staff all rfp_prs" on rfp_prs for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());
drop policy if exists "Allow all" on rfp_vendors;
drop policy if exists "staff all rfp_vendors" on rfp_vendors;
create policy "staff all rfp_vendors" on rfp_vendors for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());
drop policy if exists "Allow all" on rfps;
drop policy if exists "staff all rfps" on rfps;
create policy "staff all rfps" on rfps for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());
drop policy if exists "allow all" on rfq_submissions;
drop policy if exists "staff all rfq_submissions" on rfq_submissions;
create policy "staff all rfq_submissions" on rfq_submissions for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());
drop policy if exists "allow all" on rfq_vendors;
drop policy if exists "staff all rfq_vendors" on rfq_vendors;
create policy "staff all rfq_vendors" on rfq_vendors for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());
drop policy if exists "allow all" on rfqs;
drop policy if exists "staff all rfqs" on rfqs;
create policy "staff all rfqs" on rfqs for all to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());

-- The vendor portal reads the RFQ it was invited to (it never writes rfqs)
drop policy if exists "vendor_portal_anon_select" on rfqs;
create policy "vendor_portal_anon_select" on rfqs for select to anon using (true);

-- vendor_doc_expiry: drop the duplicate open-to-everyone policies (the vendor_portal_anon_* ones stay)
drop policy if exists "anon_insert" on vendor_doc_expiry;
drop policy if exists "anon_select" on vendor_doc_expiry;
drop policy if exists "anon_update" on vendor_doc_expiry;

-- settings: staff read; only admins change (the Settings page is admin-only)
drop policy if exists "staff read settings" on settings;
create policy "staff read settings" on settings for select to authenticated using (public.current_user_is_staff());
drop policy if exists "Admins can insert settings" on settings;
create policy "Admins can insert settings" on settings for insert to authenticated with check (public.current_user_is_admin());
drop policy if exists "Admins can update settings" on settings;
create policy "Admins can update settings" on settings for update to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

commit;

-- Check: accounts that have NO access after this (no position, or inactive). Assign a position on the
-- Users page for anyone here who should have access.
select full_name, email, position, is_admin, is_active, created_at
from profiles
where not ((coalesce(is_admin, false) or nullif(trim(position), '') is not null) and coalesce(is_active, true))
order by created_at desc;
