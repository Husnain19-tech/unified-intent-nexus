-- Track demo seeding independently from mutable business records.
-- Backfill existing workspaces so this migration never re-seeds their data.
CREATE TABLE IF NOT EXISTS public.workspace_demo_seed_state (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  seeded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_demo_seed_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.workspace_demo_seed_state FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.workspace_demo_seed_state TO service_role;

INSERT INTO public.workspace_demo_seed_state (org_id)
SELECT id FROM public.organizations
ON CONFLICT (org_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_operations_demo(v_org uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c_north uuid; c_helio uuid; l_atlas uuid; l_verd uuid;
  v_claimed uuid;
BEGIN
  -- Claim this workspace once. The marker is committed atomically with the seed rows.
  INSERT INTO public.workspace_demo_seed_state (org_id)
  VALUES (v_org)
  ON CONFLICT (org_id) DO NOTHING
  RETURNING org_id INTO v_claimed;
  IF v_claimed IS NULL THEN RETURN; END IF;
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

REVOKE ALL ON FUNCTION public.seed_operations_demo(uuid) FROM PUBLIC, anon, authenticated;
