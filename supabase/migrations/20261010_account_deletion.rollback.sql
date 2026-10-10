drop function if exists public.sv_del_finalize(uuid[]), public.sv_del_purge_due(int), public.restore_my_account(),
  public.my_deletion_status(), public.sv_del_verify_otp(uuid, text), public.sv_del_issue_otp(uuid, text), public.sv_del_blockers(uuid);
drop table if exists public.account_deletion_otps;
-- Only run the next line if NO customer has requested deletion yet (it would lose the schedule):
alter table public.customers drop column if exists deletion_requested_at, drop column if exists deletion_purge_at, drop column if exists anonymized_at;
