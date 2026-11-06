# Embedded AI layout hotfix — KT commands

Prepared locally; nothing pushed or deployed. This fixes the live 311-pixel
browser-pane regression independently of the broader warm-theme rollout.
The same pane tests pass on the local warm integration candidate.

## Commit Needle

```zsh
cd /Users/kartikraghavan/Tools/NjordHR/.local/worktrees/needle-operator-pilot
git branch --show-current
# Must be codex/needle-embed-responsive.
git status --short
git add -- frontend/src/shell/AppShell.tsx docs/HOLMES_EMBED_2026-11-05.md
git diff --cached --check
git diff --cached --stat
git commit -m "Make embedded search navigation responsive and keyboard accessible"
```

## Commit Holmes

```zsh
cd /Users/kartikraghavan/Tools/NjordHR/.local/worktrees/holmes-responsive-hotfix
git branch --show-current
# Must be codex/holmes-embed-responsive.
git status --short
git add -- src/components/recruiter/RecruiterTopbar.jsx src/pages/RecruiterAiSearch.jsx \
  tests/smoke/needle-embed.spec.js docs/needle-embed-rollout.md \
  docs/EMBED_RESPONSIVE_RELEASE_2026-11-06.md
git diff --cached --check
git diff --cached --stat
git commit -m "Fit embedded AI search into narrow Holmes browser panes"
```

## KT-only promotion

First verify the committed diffs contain only the explicit files above. Record
the current Railway engine/worker and Vercel deployments for rollback. Both
remote baselines below were read-only verified on 2026-11-06; the guards refuse
a changed branch. Do not force push.

```zsh
cd /Users/kartikraghavan/Tools/NjordHR/.local/worktrees/needle-operator-pilot
if [[ "$(git ls-remote origin refs/heads/railway-m1 | cut -f1)" == "b82cc1ed53a112ddbcdadad41015ff77b56a3e6a" ]]; then
  git push origin codex/needle-embed-responsive:railway-m1
else
  print "STOP: Railway branch changed; reconcile before promotion."
fi
```

Wait for engine and worker Active on the new commit, then:

```zsh
cd /Users/kartikraghavan/Tools/NjordHR/.local/worktrees/holmes-responsive-hotfix
if [[ "$(git ls-remote origin refs/heads/main | cut -f1)" == "ea97b2a810cedb6a0def6c55ae872defd459dd46" ]]; then
  git push origin codex/holmes-embed-responsive:main
else
  print "STOP: Holmes main changed; reconcile before promotion."
fi
```

After Vercel Ready, repeat live search/repository, open and close Search menu,
keyboard focus/Escape and the screenshot's narrow-pane layout; also verify
desktop navigation, session recovery and logout. Keep both AI flags `operator`
and `NJORDHR_DRIVE_INTAKE_ENABLED=false`. No migration, function deployment,
credential change, fact approval or model/GPU work is part of this hotfix.

Rollback: restore the recorded previous Vercel deployment and previous Railway
engine/worker deployments. No database rollback is needed. Then consolidate the
Holmes hotfix commit into `codex/holmes-warm-integration` before that candidate
is reviewed/promoted, preserving the warm sidebar rather than restoring the
old topbar. Needle's fix stays in the Needle repository.

## Verification

Six synthetic paired browser tests pass: three existing desktop/scope/PDF/session
flows and three 311/375/640-pixel cases. The latter assert no outer horizontal
overflow, a full-width iframe, a header under 80 pixels, a usable navigation
drawer, Tab/Shift+Tab containment, and Escape focus restoration. Both frontends
build and Holmes lint passes. Independent review's keyboard-focus finding was
fixed and reviewed again with no remaining blocker in this responsive slice.
Existing bundle-size and Browserslist warnings remain.

The full integration design is not complete. Add to Holmes, H8, Match resumes,
required résumé upload and wider operator/multi-customer features remain.
Live Coordinator denial (no account available), live same-candidate Preview
denial and standard-Chrome inline PDF rendering remain unverified.
