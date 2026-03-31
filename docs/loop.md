# Working Loop

Use this loop for substantial work:

1. Read:
   - `documentation.md`
   - `docs/prd.md`
   - `docs/tasks.md`
2. Inspect the current code before proposing changes.
3. Implement the smallest coherent change that solves the issue.
4. Verify with:
   - `npm run lint`
   - `npm run build`
   - `npm run test:smoke` when relevant
5. Update docs if workflows, architecture, or status changed.
6. Leave clear notes on any residual risks or follow-ups.
