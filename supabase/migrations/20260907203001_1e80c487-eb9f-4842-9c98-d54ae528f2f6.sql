REVOKE EXECUTE ON FUNCTION public.seed_operations_demo(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.seed_operations_demo(uuid) TO service_role;
