import { expect, mock, test } from "claude-code/testing";

const PANE = {
  plugin: "punchlist",
  component: "Pane",
  requestId: "punchlist",
  props: {
    title: "Punchlist",
    isFocused: false,
    bodyColumns: 50,
    placement: "dock",
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const;

test("Claude adds items; the person marks one done", async ($, on) => {
  mock.store(on);
  mock.clock(on);
  on("session.id", () => ({ value: "sess-1" }));
  on("session.cwd", () => ({ value: "/proj" }));
  on("command.register", () => ({ value: { command: "punchlist" } }));
  on("tool.register", () => ({ value: { tool: "mcp__punchlist__track" } }));
  on("ui.open", () => ({ value: { isPlaced: true } }));
  on("session.start", (_, e) => ({ cwd: e.cwd }));
  const notes: string[] = [];
  on("prompt.submit", (_, e) => {
    notes.push(e.text);
    return { text: e.text };
  });

  await $.session.start({
    cwd: "/proj",
    surface: "terminal",
    isInteractive: true,
  });
  const res = await (
    $.tool as unknown as { run: (i: unknown) => Promise<unknown> }
  ).run({
    tool: "mcp__punchlist__track",
    add: [
      {
        kind: "step",
        text: "Flash the Atom S3 Lite over USB",
        context: "esphome run basement.yaml",
        group: "CN105",
      },
      {
        kind: "question",
        text: "Which port is the Kumo adapter on?",
        group: "CN105",
      },
    ],
    tool_use_id: "t1",
  });
  expect(JSON.stringify(res)).toContain("Added S1, Q1");

  for (const surface of ["terminal", "desktop"] as const) {
    const ui = await $.ui.mount({ ...PANE, surface });
    expect((await ui.find({ type: "Text", text: /CN105/ }))?.text).toBe(
      "CN105",
    );
    await ui.unmount();
  }

  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await ui.press({ key: "row-S1" });
  await ui.press({ key: "done-S1" });
  expect(notes.join()).toContain("marked S1");

  await ui.press({ key: "row-Q1" });
  await ui.press({ key: "drop-Q1" });
  expect(notes.join()).toContain("dropped Q1");
  expect(await ui.find({ type: "Text", text: /✓ S1/ })).toBeTruthy();
  await ui.unmount();
});
