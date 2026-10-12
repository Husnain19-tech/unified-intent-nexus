CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'primary',
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage projects" ON public.projects FOR ALL TO authenticated
  USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  commitment_id uuid REFERENCES public.commitments(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','review','done')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent','high','normal','low')),
  assignee_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  due_at date,
  position double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tasks_org_idx ON public.tasks(org_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage tasks" ON public.tasks FOR ALL TO authenticated
  USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));
CREATE TRIGGER tasks_touch BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Demo projects and tasks for existing workspaces
DO $$
DECLARE o record; pr uuid; pr2 uuid; maya uuid; lena uuid; dev uuid; omar uuid; t uuid;
BEGIN
  FOR o IN SELECT id FROM public.organizations LOOP
    SELECT id INTO maya FROM public.people WHERE org_id=o.id AND name='Maya Chen' LIMIT 1;
    SELECT id INTO lena FROM public.people WHERE org_id=o.id AND name='Lena Ortiz' LIMIT 1;
    SELECT id INTO dev FROM public.people WHERE org_id=o.id AND name='Devon Park' LIMIT 1;
    SELECT id INTO omar FROM public.people WHERE org_id=o.id AND name='Omar Haddad' LIMIT 1;
    INSERT INTO public.projects(org_id,name,color) VALUES (o.id,'Northwind reporting','primary') RETURNING id INTO pr;
    INSERT INTO public.projects(org_id,name,color) VALUES (o.id,'Internal operations','warn') RETURNING id INTO pr2;
    INSERT INTO public.tasks(org_id,project_id,title,status,priority,assignee_id,due_at,position) VALUES
      (o.id,pr,'Write reporting scope for Rachel','in_progress','urgent',dev,CURRENT_DATE+1,1) RETURNING id INTO t;
    INSERT INTO public.tasks(org_id,project_id,parent_id,title,status,priority,assignee_id,due_at,position) VALUES
      (o.id,pr,t,'List what the CSV export covers','done','high',dev,CURRENT_DATE,1),
      (o.id,pr,t,'Get engineering estimate for report builder','todo','high',maya,CURRENT_DATE+1,2);
    INSERT INTO public.tasks(org_id,project_id,title,status,priority,assignee_id,due_at,position) VALUES
      (o.id,pr,'Fix export timeout on large date ranges','todo','high',maya,CURRENT_DATE+2,2),
      (o.id,pr,'Dashboard mockups','review','normal',lena,CURRENT_DATE+4,3),
      (o.id,pr2,'Chase overdue invoice INV-1041','todo','urgent',omar,CURRENT_DATE,1),
      (o.id,pr2,'Document the legacy ETL script','todo','normal',maya,CURRENT_DATE+7,2),
      (o.id,pr2,'Move weekly status to Tuesdays','done','low',dev,CURRENT_DATE-1,3);
  END LOOP;
END $$;