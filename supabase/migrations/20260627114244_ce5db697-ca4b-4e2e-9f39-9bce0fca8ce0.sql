
REVOKE EXECUTE ON FUNCTION public.pick_calling_credential(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.report_credential_failure(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.report_credential_success(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_credential_minutes(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pick_calling_credential(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.report_credential_failure(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.report_credential_success(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_credential_minutes(uuid, int) TO service_role;
