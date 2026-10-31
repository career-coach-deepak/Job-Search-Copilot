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

- Access rule lives in src/lib/access.ts (computeAccessStatus); server checks and UI must reuse it — single source for the active/upcoming/expired logic.
- Copilot history loads after the access-gated page renders with inline retry states, so a history-service failure cannot replace the workspace with a page-load error.
- Protected logic uses TanStack server functions, not Supabase Edge Functions — platform standard.
- Signed-in pages live under src/routes/_authenticated/ (client-only layout that redirects to /). Keep auth out of the child pages: the session lives in the browser, so a server-side gate would redirect-loop on hard refresh.
- src/start.ts registers attachSupabaseAuth as functionMiddleware. Keep it registered, or every protected server function loses the caller's token and returns 401.
- Identity comes only from the verified auth token (requireSupabaseAuth context / JWT claims), never from request bodies — client access and admin rights must not be forgeable by the caller.
