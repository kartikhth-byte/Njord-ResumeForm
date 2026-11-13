-- Release gate: deploy cleanup-problem-screenshots with JWT gateway off and its
-- dedicated 32+ character secret check on. Store that SAME token in Vault as
-- problem_screenshot_cleanup_token; set problem_screenshot_cleanup_url to this
-- project's HTTPS /functions/v1/cleanup-problem-screenshots endpoint.
-- Never put the service key or token in this migration or a frontend environment.
-- pg_cron, pg_net and Vault must already be enabled by the release operator.
do $$
begin
  if not exists(select 1 from vault.decrypted_secrets where name='problem_screenshot_cleanup_token' and length(decrypted_secret)>=32)
    or not exists(select 1 from vault.decrypted_secrets where name='problem_screenshot_cleanup_url'
      and decrypted_secret ~ '^https://[a-z0-9]+\.supabase\.co/functions/v1/cleanup-problem-screenshots$') then
    raise exception 'Configure screenshot cleanup URL and matching token in Vault/Function before scheduling';
  end if;
end $$;
select cron.schedule('problem-screenshot-retention','*/15 * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='problem_screenshot_cleanup_url'),
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='problem_screenshot_cleanup_token')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
