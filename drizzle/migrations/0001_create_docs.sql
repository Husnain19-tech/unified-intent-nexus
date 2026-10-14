CREATE TABLE public.docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.docs(id) ON DELETE SET NULL,
  source_id uuid REFERENCES public.sources(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Untitled',
  content text NOT NULL DEFAULT '',
  icon text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.docs TO authenticated;
GRANT ALL ON public.docs TO service_role;
ALTER TABLE public.docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage docs" ON public.docs FOR ALL TO authenticated
  USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));
CREATE INDEX docs_org_idx ON public.docs(org_id);
CREATE TRIGGER docs_touch BEFORE UPDATE ON public.docs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();