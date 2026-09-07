-- DEPENDENCIES
CREATE TABLE public.dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'package',
  version text,
  criticality integer NOT NULL DEFAULT 50,
  usage_note text,
  debt_hours numeric NOT NULL DEFAULT 0,
  risk_score integer NOT NULL DEFAULT 40,
  risk_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dependencies TO authenticated;
GRANT ALL ON public.dependencies TO service_role;
ALTER TABLE public.dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org dependencies" ON public.dependencies FOR ALL TO authenticated USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id));
CREATE TRIGGER dependencies_touch BEFORE UPDATE ON public.dependencies FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- LEADS
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  company text NOT NULL,
  contact_name text,
  email text,
  channel text NOT NULL DEFAULT 'email',
  stage text NOT NULL DEFAULT 'new',
  value numeric NOT NULL DEFAULT 0,
  sentiment text NOT NULL DEFAULT 'neutral',
  notes text,
  last_touch_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org leads" ON public.leads FOR ALL TO authenticated USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id));
CREATE TRIGGER leads_touch BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- LEAD TOUCHES
CREATE TABLE public.lead_touches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'email',
  note text,
  sentiment text NOT NULL DEFAULT 'neutral',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_touches TO authenticated;
GRANT ALL ON public.lead_touches TO service_role;
ALTER TABLE public.lead_touches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org lead touches" ON public.lead_touches FOR ALL TO authenticated USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id));

-- CALLS
CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  participant text NOT NULL,
  direction text NOT NULL DEFAULT 'outbound',
  duration_seconds integer NOT NULL DEFAULT 0,
  transcript text NOT NULL,
  summary text,
  sentiment text,
  objections text,
  talk_ratio integer,
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org calls" ON public.calls FOR ALL TO authenticated USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id));

-- TICKETS
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  requester text NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  priority text NOT NULL DEFAULT 'normal',
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  ai_reply text,
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org tickets" ON public.tickets FOR ALL TO authenticated USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id));
CREATE TRIGGER tickets_touch BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- DEALS
CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  name text NOT NULL,
  owner_name text,
  stage text NOT NULL DEFAULT 'qualify',
  value numeric NOT NULL DEFAULT 0,
  probability integer NOT NULL DEFAULT 40,
  close_date date,
  health_score integer,
  health_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deals TO authenticated;
GRANT ALL ON public.deals TO service_role;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org deals" ON public.deals FOR ALL TO authenticated USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id));
CREATE TRIGGER deals_touch BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- INVOICES
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  number text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  issued_at date NOT NULL DEFAULT CURRENT_DATE,
  due_at date,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org invoices" ON public.invoices FOR ALL TO authenticated USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id));
CREATE TRIGGER invoices_touch BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- EXPENSES
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'operations',
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  incurred_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org expenses" ON public.expenses FOR ALL TO authenticated USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id));

-- SEED HELPER
CREATE OR REPLACE FUNCTION public.seed_operations_demo(v_org uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c_north uuid; c_helio uuid; l_atlas uuid; l_verd uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.deals WHERE org_id = v_org) THEN RETURN; END IF;
  SELECT id INTO c_north FROM public.clients WHERE org_id = v_org AND name = 'Northwind Logistics' LIMIT 1;
  SELECT id INTO c_helio FROM public.clients WHERE org_id = v_org AND name = 'Helio Health' LIMIT 1;

  INSERT INTO public.dependencies (org_id, name, kind, version, criticality, usage_note, debt_hours, risk_score, risk_note) VALUES
    (v_org, 'auth-provider-sdk', 'package', '4.2.1', 95, 'Every signed-in request goes through it. Pinned two majors behind.', 26, 88, 'Two breaking majors behind and the login path has no fallback.'),
    (v_org, 'reporting-queue', 'service', 'managed', 80, 'Backs the CSV export promised to Northwind.', 12, 64, 'Single region, no dead-letter handling.'),
    (v_org, 'charting-lib', 'package', '2.9.0', 45, 'Client dashboards only.', 6, 32, 'Stable, but the maintainer has slowed releases.'),
    (v_org, 'invoicing-api', 'service', 'v2', 70, 'Finance module reads and writes invoices here.', 9, 55, 'v1 shutdown announced for next quarter.'),
    (v_org, 'legacy-etl-script', 'internal', '—', 60, 'Nightly client data import, written by a contractor.', 34, 79, 'Undocumented, one person understands it.');

  INSERT INTO public.leads (org_id, company, contact_name, email, channel, stage, value, sentiment, notes, last_touch_at) VALUES
    (v_org, 'Atlas Freight', 'Priya Raman', 'priya@atlasfreight.com', 'email', 'qualified', 48000, 'warm', 'Came in from the logistics webinar. Cares about route reporting.', now() - interval '3 days') RETURNING id INTO l_atlas;
  INSERT INTO public.leads (org_id, company, contact_name, email, channel, stage, value, sentiment, notes, last_touch_at) VALUES
    (v_org, 'Verdant Care', 'Tom Blake', 'tom@verdantcare.io', 'call', 'contacted', 26000, 'neutral', 'Compliance heavy. Asked twice about audit logs.', now() - interval '9 days') RETURNING id INTO l_verd;
  INSERT INTO public.leads (org_id, company, contact_name, email, channel, stage, value, sentiment, notes, last_touch_at) VALUES
    (v_org, 'Baymark Studio', 'Ines Alvarez', 'ines@baymark.studio', 'linkedin', 'new', 14000, 'cold', 'Small team, price sensitive.', NULL),
    (v_org, 'Corveta Group', 'Daniel Kew', 'dkew@corveta.com', 'email', 'proposal', 91000, 'warm', 'Wants a security review before signing.', now() - interval '1 day');

  INSERT INTO public.lead_touches (org_id, lead_id, channel, note, sentiment, created_at) VALUES
    (v_org, l_atlas, 'email', 'Sent the route reporting one-pager.', 'warm', now() - interval '9 days'),
    (v_org, l_atlas, 'call', 'Fifteen minute intro call, asked for pricing.', 'warm', now() - interval '3 days'),
    (v_org, l_verd, 'call', 'Discovery call, stalled on audit log questions.', 'neutral', now() - interval '9 days');

  INSERT INTO public.calls (org_id, client_id, participant, direction, duration_seconds, transcript, summary, sentiment, objections, talk_ratio, action_items) VALUES
    (v_org, c_north, 'Rachel Adeyemi (Northwind)', 'inbound', 1420,
     'Rachel: The board meeting is in three weeks and we still cannot build our own reports. Devon: The export is coming, and the dashboard after it. Rachel: If the builder is not there we will have to explain that to the board. Devon: Let me get you a written scope this week.',
     'Northwind is anxious about the reporting builder before their board meeting; a written scope was promised.', 'negative', 'Scope of the reporting module; timeline before board meeting', 62,
     '["Send written reporting scope to Rachel this week","Confirm whether a report builder can ship before the board meeting"]'::jsonb),
    (v_org, c_helio, 'Dr. Sana Iqbal (Helio)', 'outbound', 860,
     'Sana: We are telling our staff the launch is end of quarter. Maya: We planned an internal beta at that point. Sana: That is a very different message. Maya: I will bring a revised plan on Thursday.',
     'Helio believes the quarter-end date is a public launch; the team planned an internal beta.', 'mixed', 'Launch definition mismatch', 48,
     '["Bring a revised launch plan to Helio on Thursday"]'::jsonb),
    (v_org, NULL, 'Priya Raman (Atlas Freight)', 'outbound', 640,
     'Priya: Our biggest pain is reconciling route costs weekly. Devon: We can automate that. Priya: Send pricing and I will take it to my director.',
     'Strong fit on route cost reconciliation; pricing requested.', 'positive', 'Needs director approval', 40,
     '["Send Atlas Freight pricing"]'::jsonb);

  INSERT INTO public.tickets (org_id, client_id, requester, channel, priority, subject, body, status, resolution) VALUES
    (v_org, c_north, 'Rachel Adeyemi', 'email', 'high', 'Export is timing out on large date ranges', 'When I pick a full quarter the export spins and then fails. Smaller ranges work.', 'open', NULL),
    (v_org, c_helio, 'Jon Meyer', 'chat', 'normal', 'How do I add a second admin?', 'We need our operations manager to have admin access.', 'resolved', 'auto'),
    (v_org, c_north, 'Sam Okafor', 'email', 'low', 'Can we get the weekly status on Tuesdays instead?', 'Mondays clash with our internal standup.', 'open', NULL),
    (v_org, c_helio, 'Dr. Sana Iqbal', 'call', 'urgent', 'Launch date confusion with our staff', 'Our team has been told end of quarter is the public launch. Please confirm.', 'escalated', 'human');

  INSERT INTO public.deals (org_id, client_id, name, owner_name, stage, value, probability, close_date, health_score, health_note) VALUES
    (v_org, c_north, 'Northwind reporting expansion', 'Devon Park', 'proposal', 64000, 55, CURRENT_DATE + 24, 42, 'Open expectation gap on the report builder is dragging this deal.'),
    (v_org, c_helio, 'Helio platform renewal', 'Devon Park', 'negotiation', 120000, 70, CURRENT_DATE + 40, 58, 'Renewal likely, but the launch-date mismatch is unresolved.'),
    (v_org, NULL, 'Atlas Freight new logo', 'Devon Park', 'qualify', 48000, 30, CURRENT_DATE + 62, 61, 'Good fit, early stage, single champion.'),
    (v_org, NULL, 'Corveta Group new logo', 'Devon Park', 'proposal', 91000, 45, CURRENT_DATE + 35, 50, 'Security review is the gate.'),
    (v_org, c_north, 'Northwind onboarding services', 'Maya Chen', 'closed_won', 22000, 100, CURRENT_DATE - 20, 90, 'Delivered and invoiced.');

  INSERT INTO public.invoices (org_id, client_id, number, amount, issued_at, due_at, status) VALUES
    (v_org, c_north, 'INV-1041', 22000, CURRENT_DATE - 40, CURRENT_DATE - 10, 'overdue'),
    (v_org, c_north, 'INV-1052', 18500, CURRENT_DATE - 12, CURRENT_DATE + 18, 'sent'),
    (v_org, c_helio, 'INV-1048', 31000, CURRENT_DATE - 25, CURRENT_DATE - 2, 'overdue'),
    (v_org, c_helio, 'INV-1055', 27500, CURRENT_DATE - 4, CURRENT_DATE + 26, 'sent'),
    (v_org, c_north, 'INV-1030', 15000, CURRENT_DATE - 70, CURRENT_DATE - 40, 'paid'),
    (v_org, c_helio, 'INV-1035', 24000, CURRENT_DATE - 60, CURRENT_DATE - 30, 'paid');

  INSERT INTO public.expenses (org_id, client_id, category, description, amount, incurred_at) VALUES
    (v_org, NULL, 'payroll', 'Engineering payroll', 48000, CURRENT_DATE - 20),
    (v_org, NULL, 'payroll', 'Design and account payroll', 26000, CURRENT_DATE - 20),
    (v_org, NULL, 'tooling', 'Cloud and managed queue', 3400, CURRENT_DATE - 12),
    (v_org, c_north, 'contractors', 'ETL contractor for Northwind import', 7200, CURRENT_DATE - 30),
    (v_org, c_helio, 'contractors', 'Illustration set for Helio onboarding', 4100, CURRENT_DATE - 26);
END; $function$;

REVOKE ALL ON FUNCTION public.seed_operations_demo(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.bootstrap_workspace()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_existing uuid;
  v_org uuid;
  p_maya uuid; p_dev uuid; p_lena uuid; p_omar uuid;
  c_north uuid; c_helio uuid;
  s_standup uuid; s_client uuid; s_arch uuid;
  c_root uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT org_id INTO v_existing FROM public.memberships WHERE user_id = v_uid LIMIT 1;
  IF v_existing IS NOT NULL THEN
    PERFORM public.seed_operations_demo(v_existing);
    RETURN v_existing;
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  INSERT INTO public.organizations (name)
  VALUES ('My Organization')
  RETURNING id INTO v_org;

  INSERT INTO public.memberships (org_id, user_id, role) VALUES (v_org, v_uid, 'owner');
  INSERT INTO public.profiles (id, email, display_name, org_id)
  VALUES (v_uid, v_email, split_part(COALESCE(v_email, 'operator@omniflow'), '@', 1), v_org)
  ON CONFLICT (id) DO UPDATE SET org_id = EXCLUDED.org_id;

  INSERT INTO public.people (org_id, name, role_title, email) VALUES
    (v_org, 'Maya Chen', 'Engineering Lead', 'maya@omniflow.dev') RETURNING id INTO p_maya;
  INSERT INTO public.people (org_id, name, role_title, email) VALUES
    (v_org, 'Devon Park', 'Account Director', 'devon@omniflow.dev') RETURNING id INTO p_dev;
  INSERT INTO public.people (org_id, name, role_title, email) VALUES
    (v_org, 'Lena Ortiz', 'Product Designer', 'lena@omniflow.dev') RETURNING id INTO p_lena;
  INSERT INTO public.people (org_id, name, role_title, email) VALUES
    (v_org, 'Omar Haddad', 'Finance Manager', 'omar@omniflow.dev') RETURNING id INTO p_omar;

  INSERT INTO public.clients (org_id, name, account_owner) VALUES (v_org, 'Northwind Logistics', 'Devon Park') RETURNING id INTO c_north;
  INSERT INTO public.clients (org_id, name, account_owner) VALUES (v_org, 'Helio Health', 'Devon Park') RETURNING id INTO c_helio;

  INSERT INTO public.sources (org_id, title, channel, content, summary, created_by) VALUES
    (v_org, 'Monday standup notes', 'slack',
     'Maya: I''ll have the auth migration merged by EOD Wednesday. Lena: I can get the new dashboard mockups to Devon by Friday. Devon: I''ll send Northwind the revised SOW tomorrow morning. Omar: invoices for March go out end of week.',
     '4 promises captured across engineering, design, account and finance.', v_uid)
  RETURNING id INTO s_standup;
  INSERT INTO public.sources (org_id, title, channel, content, summary, created_by) VALUES
    (v_org, 'Northwind check-in call', 'call',
     'Client asked for the reporting module to be "done" before the quarterly board meeting. We committed to a working export and a live dashboard. Client also mentioned they expect ad-hoc report builder, which was not in scope.',
     'Scope ambiguity on the word "done" for the reporting module.', v_uid)
  RETURNING id INTO s_client;
  INSERT INTO public.sources (org_id, title, channel, content, summary, created_by) VALUES
    (v_org, 'Architecture decision: queue layer', 'doc',
     'We chose a managed queue over self-hosting because the team has no ops capacity this quarter. Revisit once headcount grows. Maya owns the migration plan and will circulate it next Tuesday.',
     'Decision trail: managed queue chosen over self-hosted for ops capacity reasons.', v_uid)
  RETURNING id INTO s_arch;

  INSERT INTO public.commitments (org_id, source_id, person_id, client_id, owner_name, counterparty, promise, quote, due_at, status, risk_score, risk_label, risk_reason)
  VALUES (v_org, s_standup, p_maya, NULL, 'Maya Chen', 'Engineering team', 'Merge the auth migration', 'I''ll have the auth migration merged by EOD Wednesday', now() + interval '2 days', 'open', 34, 'on_track', 'Owner has delivered 9 of the last 10 commitments on time.')
  RETURNING id INTO c_root;

  INSERT INTO public.commitments (org_id, source_id, person_id, client_id, depends_on_id, owner_name, counterparty, promise, quote, due_at, status, risk_score, risk_label, risk_reason) VALUES
    (v_org, s_standup, p_lena, NULL, c_root, 'Lena Ortiz', 'Devon Park', 'Deliver new dashboard mockups', 'I can get the new dashboard mockups to Devon by Friday', now() + interval '4 days', 'open', 58, 'at_risk', 'Blocked behind the auth migration and two other open items this week.'),
    (v_org, s_standup, p_dev, c_north, NULL, 'Devon Park', 'Northwind Logistics', 'Send revised SOW to Northwind', 'I''ll send Northwind the revised SOW tomorrow morning', now() - interval '1 day', 'open', 81, 'slipping', 'Past due by a day with no status update recorded.'),
    (v_org, s_standup, p_omar, NULL, NULL, 'Omar Haddad', 'Finance', 'Send out March invoices', 'invoices for March go out end of week', now() + interval '3 days', 'open', 25, 'on_track', 'Recurring task with a perfect delivery history.'),
    (v_org, s_client, p_dev, c_north, NULL, 'Devon Park', 'Northwind Logistics', 'Working CSV export for reporting module', 'we committed to a working export', now() + interval '10 days', 'open', 46, 'at_risk', 'Scope of "done" is disputed with the client.'),
    (v_org, s_client, p_maya, c_helio, NULL, 'Maya Chen', 'Helio Health', 'Live reporting dashboard for board meeting', 'and a live dashboard', now() + interval '12 days', 'open', 52, 'at_risk', 'Depends on export work that has not started.'),
    (v_org, s_arch, p_maya, NULL, NULL, 'Maya Chen', 'Engineering team', 'Circulate queue migration plan', 'Maya owns the migration plan and will circulate it next Tuesday', now() + interval '6 days', 'open', 30, 'on_track', 'Small scope, owner reliable.'),
    (v_org, s_standup, p_lena, c_helio, NULL, 'Lena Ortiz', 'Helio Health', 'Ship onboarding illustration set', 'illustrations to Helio by last Thursday', now() - interval '6 days', 'delivered', 20, 'on_track', 'Delivered two days late but accepted.'),
    (v_org, s_standup, p_omar, NULL, NULL, 'Omar Haddad', 'Leadership', 'Q1 cash flow forecast', 'forecast before the board pack', now() - interval '12 days', 'delivered', 15, 'on_track', 'Delivered on time.'),
    (v_org, s_client, p_dev, c_north, NULL, 'Devon Park', 'Northwind Logistics', 'Weekly status report every Monday', 'we will send a weekly status every Monday', now() - interval '9 days', 'broken', 90, 'slipping', 'Missed two consecutive weeks.');

  INSERT INTO public.commitment_events (org_id, commitment_id, kind, note)
  VALUES (v_org, c_root, 'created', 'Extracted from Monday standup notes.');

  INSERT INTO public.expectations (org_id, client_id, label, client_view, team_view, gap_score, gap_note) VALUES
    (v_org, c_north, 'Definition of "done" for reporting', 'Fully self-serve report builder with saved views.', 'CSV export plus one fixed dashboard.', 78, 'Client expects a builder; team scoped a fixed dashboard. High conflict risk before the board meeting.'),
    (v_org, c_north, 'Meaning of "urgent"', 'Same business day response.', 'Within 48 hours during business week.', 61, 'Response-time language in the SOW is undefined.'),
    (v_org, c_helio, 'Launch date commitment', 'Public launch at the end of the quarter.', 'Internal beta at the end of the quarter.', 84, 'Two different launch definitions are in circulation.'),
    (v_org, c_helio, 'Design revision rounds', 'Unlimited tweaks until happy.', 'Two rounds included, then change request.', 44, 'Revision limits were discussed verbally but never written down.');

  PERFORM public.seed_operations_demo(v_org);

  RETURN v_org;
END; $function$;
