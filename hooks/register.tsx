import type { EngineInterface, Register } from "claude-code";
import { atom, read, update } from "claude-code";

import type { Item, ItemKind, ItemStatus } from "../types";

const PANE = "punchlist";
const TOOL = "track";
const KEEP_CLOSED_DAYS = 14;
const RECENT_CLOSED = 5;

// Change the shape tag when Item's fields change.
const items = atom(
  { plugin: "punchlist", key: "items" } as const,
  [] as Item[],
  {
    shape: "items-1",
  },
);
const selected = atom(
  { plugin: "punchlist", key: "selected" } as const,
  null as string | null,
);
const sessionId = atom(
  { plugin: "punchlist", key: "session" } as const,
  null as string | null,
);

type $ = EngineInterface;

type AddArg = {
  kind: ItemKind;
  text: string;
  context?: string;
  group?: string;
};
type CloseArg = {
  id: string;
  status: Exclude<ItemStatus, "open">;
  answer?: string;
};
type TrackInput = { add?: AddArg[]; close?: CloseArg[] };

const DESCRIPTION = `Track instruction steps you give the user and questions you are waiting on them to answer, in a punchlist pane the user keeps beside the chat. The list is saved per project directory and carries across sessions.

Use it whenever you hand the user something to do themselves (physical steps, commands to run in their own terminal, UI clicks, things to check) or ask a question whose answer you need before continuing. Add the items in the same turn you write them in chat. Don't add your own work.

Each item must make sense read alone, days later, in another session:
- text: one imperative line naming the thing acted on ("Plug the Atom S3 Lite into the basement head unit's CN105 port", not "Plug it in").
- context: where/how, the expected result, and what comes next or why it matters. Include hostnames, IPs, file paths, model numbers.
- group: the task it belongs to ("Basement mini-split CN105 pilot"), so items from several threads stay apart.

When you mention an item in chat later, write its id AND a short restatement: "S4 (flash the second Atom over USB)", never a bare "step 4".

Close items with close[] when the user says they did them or you can see they're done (status done), when the user answered in chat (status answered, with the answer), or when they no longer apply (status dropped). Items the user closes in the pane reach you as notes; answers they type in the pane arrive as their prompt, prefixed "Re Q<n>".

The result lists every open item.`;

const INPUT_SCHEMA = {
  type: "object",
  properties: {
    add: {
      type: "array",
      description: "Items to add, in the order the user should do them.",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["step", "question"] },
          text: {
            type: "string",
            description: "One self-contained imperative line or question.",
          },
          context: {
            type: "string",
            description:
              "Where/how, expected result, why. Enough to act on cold.",
          },
          group: { type: "string", description: "The task this belongs to." },
        },
        required: ["kind", "text"],
      },
    },
    close: {
      type: "array",
      description: "Items to close.",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "S<n> or Q<n>." },
          status: { type: "string", enum: ["done", "answered", "dropped"] },
          answer: {
            type: "string",
            description: "For a question: the user's answer.",
          },
        },
        required: ["id", "status"],
      },
    },
  },
};

const storeKey = async ($: $) => `items:${await $.session.cwd()}`;
const counterKey = async ($: $) => `counter:${await $.session.cwd()}`;

const loadStored = async ($: $): Promise<Item[]> => {
  const v = await $.store.get(await storeKey($));
  return Array.isArray(v) ? (v as Item[]) : [];
};

/** Read the project's list from the store (the source shared by sessions), change it, write both. */
const mutate = async ($: $, fn: (list: Item[]) => Item[]): Promise<Item[]> => {
  const next = fn(await loadStored($));
  await $.store.set(await storeKey($), next);
  await update($, items, () => next);
  return next;
};

const openCount = (list: Item[]) =>
  list.filter((i) => i.status === "open").length;

const retitle = async ($: $, list: Item[]) => {
  const n = openCount(list);
  await $.ui.open({ id: PANE, title: n ? `Punchlist (${n})` : "Punchlist" });
};

const nextIds = async ($: $, kinds: ItemKind[]): Promise<string[]> => {
  const key = await counterKey($);
  const c =
    ((await $.store.get(key)) as { S?: number; Q?: number } | undefined) ?? {};
  // Never reuse a number still visible in the list.
  const stored = await loadStored($);
  const max = (p: string) =>
    stored
      .filter((i) => i.id.startsWith(p))
      .reduce((m, i) => Math.max(m, Number(i.id.slice(1)) || 0), 0);
  let s = Math.max(c.S ?? 0, max("S"));
  let q = Math.max(c.Q ?? 0, max("Q"));
  const ids = kinds.map((k) => (k === "step" ? `S${++s}` : `Q${++q}`));
  await $.store.set(key, { S: s, Q: q });
  return ids;
};

const quote = (i: Item) => `${i.id} (“${i.text}”)`;

const describeOpen = (list: Item[], me: string | null) => {
  const open = list.filter((i) => i.status === "open");
  if (!open.length) return "No open items.";
  return open
    .map(
      (i) =>
        `- ${i.id} [${i.kind}${i.group ? ` · ${i.group}` : ""}${i.session !== me ? " · earlier session" : ""}] ${i.text}${i.context ? `\n    ${i.context}` : ""}`,
    )
    .join("\n");
};

const note = ($: $, text: string) =>
  $.session.append({
    message: {
      type: "user",
      content: [{ type: "text", text: `[punchlist] ${text}` }],
    },
  });

const closeByUser = async (
  $: $,
  id: string,
  status: Exclude<ItemStatus, "open">,
  answer?: string,
) => {
  const now = await $.clock.now();
  let hit: Item | undefined;
  await mutate($, (list) =>
    list.map((i) => {
      if (i.id !== id) return i;
      hit = { ...i, status, answer, closedBy: "user", closedAt: now };
      return hit;
    }),
  );
  await update($, selected, () => null);
  await retitle($, await loadStored($));
  return hit;
};

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    await $.command.register({
      name: "punchlist",
      description:
        "Open the punchlist pane: steps to do and questions to answer",
    });
    await $.tool.register({
      name: TOOL,
      description: DESCRIPTION,
      inputSchema: INPUT_SCHEMA,
      isDeferred: false,
    });
    const id = await $.session.id();
    await update($, sessionId, () => id);

    const cutoff = (await $.clock.now()) - KEEP_CLOSED_DAYS * 86_400_000;
    const list = await mutate($, (l) =>
      l.filter((i) => i.status === "open" || (i.closedAt ?? 0) > cutoff),
    );
    // Carried-over open items: show them; otherwise wait until Claude adds one.
    if (openCount(list)) void retitle($, list);
    return next(e);
  });

  on("command.run", { command: "punchlist" }, async ($) => {
    const list = await loadStored($);
    await update($, items, () => list);
    await retitle($, list);
    return { text: `Punchlist opened: ${openCount(list)} open.` };
  });

  // Items left open by earlier sessions in this directory, so Claude knows what they mean.
  on("prompt.compose", async ($, e, next) => {
    const out = await next(e);
    const me = await read($, sessionId);
    const carried = (await loadStored($)).filter(
      (i) => i.status === "open" && i.session !== me,
    );
    if (!carried.length) return out;
    return {
      sections: [
        ...out.sections,
        {
          id: "punchlist:carryover",
          scope: "session" as const,
          text: `# Punchlist carried over\nThe user's punchlist pane still holds these open items from earlier sessions in this directory (mcp__punchlist__track manages them; refer to them by id plus restatement):\n${describeOpen(carried, me)}`,
        },
      ],
    };
  });

  on("tool.run", { tool: "mcp__punchlist__track" }, async ($, e) => {
    const input = e as unknown as TrackInput;
    const me = await read($, sessionId);
    const now = await $.clock.now();
    const adds = (input.add ?? []).filter((a) => a?.text?.trim());
    const ids = await nextIds(
      $,
      adds.map((a) => (a.kind === "question" ? "question" : "step")),
    );
    const missing: string[] = [];
    const list = await mutate($, (l) => {
      const closes = new Map(
        (input.close ?? []).map((c) => [c.id.toUpperCase(), c]),
      );
      for (const id of closes.keys())
        if (!l.some((i) => i.id === id)) missing.push(id);
      const updated = l.map((i) => {
        const c = closes.get(i.id);
        return c
          ? {
              ...i,
              status: c.status,
              answer: c.answer ?? i.answer,
              closedBy: "claude" as const,
              closedAt: now,
            }
          : i;
      });
      const added: Item[] = adds.map((a, n) => ({
        id: ids[n] as string,
        kind: a.kind === "question" ? "question" : "step",
        text: a.text.trim(),
        context: a.context?.trim() || undefined,
        group: a.group?.trim() || undefined,
        status: "open",
        createdAt: now,
        session: me ?? "",
      }));
      return [...updated, ...added];
    });
    if (ids.length || openCount(list)) await retitle($, list);
    const parts = [
      ids.length ? `Added ${ids.join(", ")}.` : "",
      input.close?.length
        ? `Closed ${
            (input.close ?? [])
              .map((c) => c.id)
              .filter((id) => !missing.includes(id.toUpperCase()))
              .join(", ") || "nothing"
          }.`
        : "",
      missing.length ? `Unknown ids: ${missing.join(", ")}.` : "",
      `Open items:\n${describeOpen(list, me)}`,
    ];
    return { result: parts.filter(Boolean).join("\n") };
  });

  on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Input } = $.ui.resolve(e);
    const list = await read($, items);
    const sel = await read($, selected);
    const me = await read($, sessionId);
    const width = Math.max(
      20,
      (e.props as { bodyColumns?: number }).bodyColumns ?? 40,
    );
    const clip = (s: string, n: number) =>
      s.length > n ? `${s.slice(0, n - 1)}…` : s;

    const open = list.filter((i) => i.status === "open");
    const closed = list
      .filter((i) => i.status !== "open")
      .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0))
      .slice(0, RECENT_CLOSED);
    const groups: [string, Item[]][] = [];
    for (const i of open) {
      const g = i.group ?? "Ungrouped";
      const at = groups.find(([name]) => name === g);
      if (at) at[1].push(i);
      else groups.push([g, [i]]);
    }

    const row = (i: Item) => {
      const isSel = sel === i.id;
      const glyph = i.kind === "question" ? "?" : "○";
      const head = `${glyph} ${i.id} `;
      return (
        <Box flexDirection="column">
          <Button
            key={`row-${i.id}`}
            plain
            onPress={() =>
              update($, selected, (s) => (s === i.id ? null : i.id))
            }
          >
            {head}
            {isSel ? i.text : clip(i.text, width - head.length - 1)}
            {i.session !== me && <Text dimColor> · earlier</Text>}
          </Button>
          {isSel && (
            <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
              {i.context && <Text dimColor>{i.context}</Text>}
              {i.kind === "question" && (
                <Input
                  key={`ans-${i.id}`}
                  placeholder="type your answer"
                  submitLabel="send"
                  autoFocus
                  onSubmit={async (v) => {
                    const answer = v.trim();
                    if (!answer) return;
                    const hit = await closeByUser($, i.id, "answered", answer);
                    if (hit)
                      await $.prompt.submit({
                        text: `Re ${quote(hit)}: ${answer}`,
                        asUser: true,
                      });
                  }}
                />
              )}
              <Box flexDirection="row" gap={1}>
                {i.kind === "step" && (
                  <Button
                    key={`done-${i.id}`}
                    label="done"
                    hotkey="d"
                    variant="primary"
                    onPress={async () => {
                      const hit = await closeByUser($, i.id, "done");
                      if (hit)
                        await note($, `The user marked ${quote(hit)} done.`);
                    }}
                  />
                )}
                <Button
                  key={`ask-${i.id}`}
                  label="ask"
                  hotkey="a"
                  onPress={() =>
                    $.prompt.fill({ text: `Re ${quote(i)}: `, mode: "insert" })
                  }
                />
                <Button
                  key={`drop-${i.id}`}
                  label="drop"
                  hotkey="x"
                  onPress={async () => {
                    const hit = await closeByUser($, i.id, "dropped");
                    if (hit)
                      await note(
                        $,
                        `The user dropped ${quote(hit)} as no longer needed.`,
                      );
                  }}
                />
              </Box>
            </Box>
          )}
        </Box>
      );
    };

    return (
      <Box flexDirection="column">
        {open.length === 0 && <Text dimColor>Nothing outstanding.</Text>}
        {groups.map(([name, its]) => (
          <Box flexDirection="column" marginBottom={1}>
            <Text bold>{clip(name, width)}</Text>
            {its.map(row)}
          </Box>
        ))}
        {closed.length > 0 && (
          <Box flexDirection="column">
            <Text dimColor bold>
              Recently closed
            </Text>
            {closed.map((i) => (
              <Text dimColor>
                {clip(
                  `${i.status === "dropped" ? "✗" : "✓"} ${i.id} ${i.text}${i.answer ? ` → ${i.answer}` : ""}`,
                  width,
                )}
              </Text>
            ))}
          </Box>
        )}
      </Box>
    );
  });
};
