# punchlist

<!-- What this is, in a sentence or two. -->

## Development

```bash
uv sync                          # create .venv and install deps (incl. the dev group)
uvx pre-commit install           # pre-commit + pre-push hooks
uvx pre-commit run --all-files   # everything
uv run pytest --cov              # tests with coverage
```

## Tooling

| Area      | Tool                                          | Config                     |
| --------- | --------------------------------------------- | -------------------------- |
| Hooks     | pre-commit                                    | `.pre-commit-config.yaml`  |
| Python    | uv, ruff (lint + format), ty, pytest          | `pyproject.toml`           |
| JS/TS     | biome (lint + format, also JSON/CSS)          | `biome.json`               |
| Secrets   | gitleaks, detect-private-key                  |                            |
| Spelling  | typos                                         | `[tool.typos]` in `pyproject.toml` |
| Shell     | shellcheck, shfmt                             | `.editorconfig`            |
| YAML      | yamllint                                      | `.yamllint.yaml`           |
| Docker    | hadolint                                      |                            |
| CI        | actionlint, zizmor                            | `.github/workflows/`       |

Hooks only run on file types that are present, so unused ones cost nothing. Tests run on `pre-push`, not every commit.

`.gitignore` is default-deny (`*`, then `!` includes): list each new top-level file or directory there.
biome also skips anything git ignores, so an unlisted file is invisible to it too.
