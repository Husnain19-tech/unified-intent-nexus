import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ReactNode } from "react";
import {
  Activity,
  Boxes,
  Banknote,
  GitBranch,
  Handshake,
  LifeBuoy,
  LogOut,
  Network,
  PhoneCall,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Intelligence",
    items: [
      { to: "/command", label: "Command Center", icon: Activity },
      { to: "/knowledge", label: "Knowledge Mesh", icon: Network },
      { to: "/dependencies", label: "Dependency Monitor", icon: GitBranch },
    ],
  },
  {
    label: "Revenue",
    items: [
      { to: "/sales", label: "Sales Orchestrator", icon: Target },
      { to: "/pipeline", label: "Predictive Pipeline", icon: TrendingUp },
      { to: "/calls", label: "VoIP Intelligence", icon: PhoneCall },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/commitments", label: "Commitments", icon: Handshake },
      { to: "/people", label: "People & Reliability", icon: Users },
      { to: "/expectations", label: "Expectation Mapper", icon: Boxes },
      { to: "/support", label: "Customer Support", icon: LifeBuoy },
      { to: "/finance", label: "Financial Intelligence", icon: Banknote },
    ],
  },
] as const;

const NAV = NAV_GROUPS.flatMap((g) => g.items);

export function Shell({ children, org }: { children: ReactNode; org?: string | undefined }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-panel/60 md:flex md:flex-col">
          <div className="flex items-center gap-2 border-b border-border px-5 py-5">
            <span className="live-dot inline-block h-2 w-2 rounded-full bg-primary" />
            <span className="font-display text-lg font-bold tracking-tight">OmniFlow</span>
          </div>
          <nav className="flex flex-1 flex-col gap-1 p-3">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                activeProps={{ className: "bg-accent text-foreground" }}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-border p-3">
            <div className="px-2 pb-2 text-xs uppercase tracking-widest text-muted-foreground">
              {org ?? "workspace"}
            </div>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-border bg-panel/40 px-4 py-3 md:hidden">
            <span className="font-display font-bold">OmniFlow</span>
            <button onClick={signOut} className="text-sm text-muted-foreground">
              Sign out
            </button>
          </header>
          <nav className="flex gap-1 overflow-x-auto border-b border-border bg-panel/40 px-2 py-2 md:hidden">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs text-muted-foreground"
                activeProps={{ className: "bg-accent text-foreground" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

export function PageHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function riskTone(score: number | null | undefined) {
  const value = score ?? 0;
  if (value >= 70) return { label: "slipping", className: "text-destructive", bg: "bg-destructive/15 text-destructive" };
  if (value >= 45) return { label: "at risk", className: "text-warn", bg: "bg-warn/15 text-warn" };
  return { label: "on track", className: "text-success", bg: "bg-success/15 text-success" };
}

export function dueLabel(due: string | null) {
  if (!due) return "unscheduled";
  const diff = new Date(due).getTime() - Date.now();
  const days = Math.round(diff / 86400000);
  if (days < -1) return `${Math.abs(days)}d overdue`;
  if (days === -1 || (days === 0 && diff < 0)) return "overdue";
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `in ${days}d`;
}
