-- Complete a task and its linked commitment in one database transaction.
-- SECURITY INVOKER preserves the caller's RLS permissions; both writes are org-scoped.
CREATE OR REPLACE FUNCTION public.complete_task_with_commitment(
  v_task uuid,
  v_org uuid,
  v_patch jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_commitment uuid;
  v_updated_commitment uuid;
BEGIN
  UPDATE public.tasks
  SET
    status = 'done',
    priority = CASE WHEN v_patch ? 'priority' THEN v_patch->>'priority' ELSE priority END,
    assignee_id = CASE WHEN v_patch ? 'assignee_id' THEN NULLIF(v_patch->>'assignee_id', '')::uuid ELSE assignee_id END,
    due_at = CASE WHEN v_patch ? 'due_at' THEN NULLIF(v_patch->>'due_at', '')::date ELSE due_at END,
    title = CASE WHEN v_patch ? 'title' THEN v_patch->>'title' ELSE title END
  WHERE id = v_task AND org_id = v_org
  RETURNING commitment_id INTO v_commitment;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found in the active organization';
  END IF;

  IF v_commitment IS NOT NULL THEN
    UPDATE public.commitments
    SET status = 'delivered'
    WHERE id = v_commitment AND org_id = v_org
    RETURNING id INTO v_updated_commitment;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Linked commitment not found in the active organization';
    END IF;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_task_with_commitment(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_task_with_commitment(uuid, uuid, jsonb) TO authenticated;
