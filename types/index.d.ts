export type ItemKind = "step" | "question";
export type ItemStatus = "open" | "done" | "answered" | "dropped";

export type Item = {
  /** S<n> for a step, Q<n> for a question; unique within a project. */
  id: string;
  kind: ItemKind;
  /** One self-contained line: what to do or what is asked. */
  text: string;
  /** Where, with what, expected result, why: enough to act on days later. */
  context?: string;
  /** The task this item belongs to, e.g. "Basement mini-split CN105". */
  group?: string;
  status: ItemStatus;
  answer?: string;
  /** Who closed it. */
  closedBy?: "user" | "claude";
  createdAt: number;
  closedAt?: number;
  /** Session that created it. */
  session: string;
};

declare module "claude-code" {
  interface PluginState {
    punchlist: {
      items: Shaped<Item[]>;
      selected: string | null;
      session: string | null;
      /** The directory the list is kept under: the session's directory when it started, not wherever it has cd'd since. */
      root: string | null;
    };
  }
}
