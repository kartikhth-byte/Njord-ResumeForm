-- Explicit retries append evidence; never rewrite a previously reviewed attempt.
begin;
alter table public.resume_extractions drop constraint resume_extractions_version_id_extractor_version_key;
create index resume_extractions_latest on public.resume_extractions(version_id,created_at desc,id desc);
create function public.reject_extraction_rewrite() returns trigger language plpgsql as $$
begin raise exception 'immutable_extraction_attempt';end $$;
create trigger resume_extraction_immutable before update or delete on public.resume_extractions for each row execute function public.reject_extraction_rewrite();
commit;
