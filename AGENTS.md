# AGENTS.md: punchlist

A Claude Code mod (function-hooks plugin): a pane of user-facing steps and questions, a `track` tool the model calls to
manage them, and a `/punchlist` command. Read `hooks/register.tsx` first; `types/index.d.ts` is its `$.state` contract.

## Commands

- Hooks: `uvx pre-commit install`; all checks: `uvx pre-commit run --all-files`.
- `claude plugin validate .` (also type-checks) and `claude plugin test .`.
- Try it: `claude --plugin-dir .`.

## Conventions

- Bump the atom's `shape` tag in `register.tsx` when `Item`'s fields change; stored values outlive reloads.
- JS/TS/JSON rules live in `biome.json`. Fix the code rather than adding `biome-ignore`.
- `.gitignore` is default-deny: a new top-level file or directory stays untracked until you add `!name` (and `!/dir/**`)
  for it. `.claude-plugin/types/` is generated and stays ignored.
- Don't bypass hooks with `--no-verify`. Commit small, with a body that says why. Push only when asked.
