CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;

CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text,
  display_name text,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

CREATE TABLE public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  role_title text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  account_owner text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;

CREATE TABLE public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  channel text NOT NULL DEFAULT 'note',
  content text NOT NULL,
  summary text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sources TO authenticated;
GRANT ALL ON public.sources TO service_role;

CREATE TABLE public.commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.sources(id) ON DELETE SET NULL,
  person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  depends_on_id uuid REFERENCES public.commitments(id) ON DELETE SET NULL,
  owner_name text NOT NULL,
  counterparty text,
  promise text NOT NULL,
  quote text,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  confidence numeric,
  risk_score int,
  risk_label text,
  risk_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commitments TO authenticated;
GRANT ALL ON public.commitments TO service_role;

CREATE TABLE public.commitment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  commitment_id uuid NOT NULL REFERENCES public.commitments(id) ON DELETE CASCADE,
  kind text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commitment_events TO authenticated;
GRANT ALL ON public.commitment_events TO service_role;

CREATE TABLE public.expectations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  label text NOT NULL,
  client_view text,
  team_view text,
  gap_score int,
  gap_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expectations TO authenticated;
GRANT ALL ON public.expectations TO service_role;

CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships m WHERE m.org_id = _org_id AND m.user_id = auth.uid());
$$;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read org" ON public.organizations FOR SELECT TO authenticated USING (public.is_org_member(id));
CREATE POLICY "members update org" ON public.organizations FOR UPDATE TO authenticated USING (public.is_org_member(id)) WITH CHECK (public.is_org_member(id));

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own membership rows" ON public.memberships FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_org_member(org_id));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org people" ON public.people FOR ALL TO authenticated USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org clients" ON public.clients FOR ALL TO authenticated USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));

ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org sources" ON public.sources FOR ALL TO authenticated USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));

ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org commitments" ON public.commitments FOR ALL TO authenticated USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));

ALTER TABLE public.commitment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org commitment events" ON public.commitment_events FOR ALL TO authenticated USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));

ALTER TABLE public.expectations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org expectations" ON public.expectations FOR ALL TO authenticated USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER commitments_touch BEFORE UPDATE ON public.commitments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.bootstrap_workspace()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
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

  RETURN v_org;
END; $$;

REVOKE ALL ON FUNCTION public.bootstrap_workspace() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_workspace() TO authenticated;