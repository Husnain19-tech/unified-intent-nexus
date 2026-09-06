import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Brain, HandshakeIcon, Radar } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OmniFlow — The organizational operating system" },
      {
        name: "description",
        content:
          "OmniFlow reads your team's conversations, tracks every promise made, scores who delivers, and warns you where client expectations are drifting apart.",
      },
      { property: "og:title", content: "OmniFlow — The organizational operating system" },
      {
        property: "og:description",
        content: "Turn conversations into tracked commitments, reliability scores and early warnings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: HandshakeIcon,
    title: "Commitment tracking",
    body: "Paste any thread. Every “I'll have it by Thursday” becomes a tracked promise with an owner, a deadline and a slip risk.",
  },
  {
    icon: Activity,
    title: "Reliability scores",
    body: "Trust, measured from what actually shipped. See who keeps their word and who is quietly drowning.",
  },
  {
    icon: Brain,
    title: "Organizational memory",
    body: "A searchable record of decisions that answers why, not just what — so nothing walks out the door with people.",
  },
  {
    icon: Radar,
    title: "Expectation gaps",
    body: "Compare what the client thinks was agreed with what your team thinks. The gap is where the dispute starts.",
  },
];

function Landing() {
  return (
    <div className="grid-field min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-lg font-bold tracking-tight">
          Omni<span className="text-primary">Flow</span>
        </span>
        <Link
          to="/auth"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-20 text-center sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
            <span className="live-dot" /> live commitment intelligence
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Your organization makes hundreds of promises. <span className="text-primary">OmniFlow keeps them.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Drop in a chat thread, a call note or an email. OmniFlow pulls out every commitment hiding inside it,
            works out what is likely to slip, and shows you who to talk to before it does.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              to="/auth"
              className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Open your command center
            </Link>
            <a
              href="#capabilities"
              className="rounded-md border border-border px-6 py-3 text-sm font-semibold hover:bg-accent"
            >
              See what it does
            </a>
          </div>
        </section>

        <section id="capabilities" className="grid gap-4 pb-24 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="panel p-6">
              <f.icon className="h-5 w-5 text-primary" />
              <h2 className="mt-4 text-lg font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        OmniFlow — commitment, memory and expectation intelligence.
      </footer>
    </div>
  );
}
