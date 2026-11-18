# punchlist

A Claude Code mod that keeps the steps Claude hands you and the questions it's waiting on in a pane beside the chat,
so they don't get buried in the transcript.

- Claude adds items with its `track` tool: steps are `S1`, `S2`…, questions `Q1`, `Q2`…. Each one has a
  self-contained line, context (where, what to expect, why), and a group naming the task.
- Click an item to see its context, then **done** (`d`), **ask** (`a`, fills the prompt with `Re S3 ("…"): `) or
  **drop** (`x`). A question gets an answer field; Enter sends `Re Q2 ("…"): <answer>` as your prompt.
- Closing an item from the pane tells Claude with a silent note it reads on its next turn.
- The list is kept per project directory across sessions. Open items left by earlier sessions are added to Claude's
  system prompt at the start of a new one, so it knows what `S4` meant. Closed items are kept for 14 days.
- `/punchlist` opens the pane. It also opens itself when Claude adds an item (on wide terminals).

## Install

At the prompt of a terminal session:

```text
/plugin install punchlist --marketplace evanrrees/punchlist
```

Answer `y` to add the marketplace, then pick a scope. From a shell:

```bash
claude plugin install punchlist --marketplace evanrrees/punchlist
```

## Development

```bash
uvx pre-commit install           # pre-commit + pre-push hooks
uvx pre-commit run --all-files   # everything
claude plugin validate .         # manifest + hooks module, as the engine reads them
claude plugin test .             # hooks/*.test.tsx
```

`hooks/register.tsx` is the whole mod; `types/index.d.ts` declares its state. Run it from a checkout with
`claude --plugin-dir .`, which reloads on save.

`.gitignore` is default-deny (`*`, then `!` includes): list each new top-level file or directory there.
