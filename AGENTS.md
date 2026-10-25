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
- Protected logic uses TanStack server functions, not Supabase Edge Functions — platform standard.
