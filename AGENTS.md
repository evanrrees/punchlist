# AGENTS.md: punchlist

<!-- One paragraph: what this repo is, and what to read first. -->

## Commands

- Setup: `uv sync`, then `uvx pre-commit install` (installs the pre-commit and pre-push hooks).
- All checks: `uvx pre-commit run --all-files`. Tests: `uv run pytest` (`--cov` for coverage).
- Add a dependency with `uv add <pkg>` (`uv add --dev <pkg>` for tooling); never edit `uv.lock` by hand.

## Conventions

- Python is managed by uv (`.python-version`); don't use system pip or create venvs by hand.
- Python lint and type rules live in `pyproject.toml` (ruff `ALL` minus a short ignore list; ty with every rule as an
  error); JS/TS/JSON/CSS rules in `biome.json`. Fix the code rather than adding `# noqa` / `# ty: ignore` / `biome-ignore`; when an ignore is really needed, give the specific code and a reason.
- `.gitignore` is default-deny: a new top-level file or directory stays untracked until you add `!name` (and `!/dir/**`)
  for it. Exclusions go after the includes (later patterns win).
- Don't bypass hooks with `--no-verify`. If a hook is wrong, fix its config.
- Commit small, with a body that says why. Push only when asked.
