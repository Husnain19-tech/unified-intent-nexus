REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.bootstrap_workspace() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bootstrap_workspace() FROM anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_workspace() TO authenticated;