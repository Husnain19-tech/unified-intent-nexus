<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- All chat/reasoning AI calls go through createLovableClaudeProvider in src/lib/ai-gateway.server.ts (Anthropic Messages API, streamed) — one place to change the model. Embeddings stay on the gateway embedding model because Claude has none.
- Tasks live in their own tasks/projects tables and src/lib/tasks.functions.ts; a task linked to a promise marks that promise delivered when done — keeps tasks and commitments in sync.
