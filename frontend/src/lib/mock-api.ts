// Static demo backend: replays a recorded run of the real Through Line agent
// (local mode, synthetic Northstar Cloud data) entirely in the browser, so the
// UI can be deployed on its own without the FastAPI service, SQLite or API keys.
//
// Recordings in ./demo were captured from the real backend:
//   analyze.json     - refund-policy change (4 impacts, ACME exception, 4 drafts)
//   analyze_ooc.json - unrelated request (evidence gate refuses, no impacts)
import type { Action } from "./api";
import refundRun from "./demo/analyze.json";
import refusalRun from "./demo/analyze_ooc.json";
import sourcesData from "./demo/sources.json";
import statusData from "./demo/status.json";
import seedData from "./demo/seed.json";

type ActivityItem = { id: number; kind: string; message: string; created_at: string };

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const newAnalysisId = () =>
  "an_" + Array.from({ length: 10 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

let actions: Action[] = [];
let activity: ActivityItem[] = [];
let nextActivityId = 1;

function log(kind: string, message: string) {
  activity.unshift({ id: nextActivityId++, kind, message, created_at: now() });
}

log("seed", "Local dataset ready: 12 sources (static demo build)");

// The recorded refusal run came from a cafeteria-menu request; the gate logic
// is the same for any request the corpus has no evidence for.
function isRefundRequest(text: string) {
  return /refund|money[- ]back|return window/i.test(text);
}

function withAnalysisId<T>(run: T, oldId: string, id: string): T {
  return JSON.parse(JSON.stringify(run).split(oldId).join(id));
}

export const mockApi = {
  health: async () => ({ status: "ok", service: "throughline-demo" }),

  brainStatus: async () => {
    await sleep(120);
    return {
      ...clone(statusData),
      message: "Static demo — replays a recorded agent run (no live backend, no API keys).",
    };
  },

  sources: async () => {
    await sleep(120);
    return clone(sourcesData);
  },

  seed: async () => {
    await sleep(400);
    log("seed", "Local dataset verified: 12 sources");
    return clone(seedData);
  },

  analyze: async (change_request: string) => {
    await sleep(600);
    const id = newAnalysisId();

    if (!isRefundRequest(change_request)) {
      const run = withAnalysisId(clone(refusalRun), refusalRun.analysis_id, id);
      log("analysis", `${id}: insufficient evidence, no impacts generated [local]`);
      return run;
    }

    const recorded = withAnalysisId(clone(refundRun), refundRun.analysis_id, id);
    const run = { ...recorded, actions: recorded.actions as Action[] };
    // Idempotent like the real service: re-running the same change reuses the
    // existing drafts (and their decisions) instead of duplicating them.
    if (actions.length === 0) {
      actions = clone(run.actions) as Action[];
      for (const a of actions) log("action_created", `Draft created: ${a.title} [${a.department}]`);
    }
    run.actions = clone(actions);
    log("analysis", `Analysis ${id} completed in local mode`);
    log("analysis", `${id}: ${run.summary} [local]`);
    return run;
  },

  actions: async () => {
    await sleep(100);
    return { actions: clone(actions) };
  },

  approve: async (id: string, note = "") => decide(id, "approved", note),
  reject: async (id: string, note = "") => decide(id, "rejected", note),

  activity: async () => {
    await sleep(80);
    return clone(activity);
  },
};

async function decide(id: string, status: "approved" | "rejected", note: string) {
  await sleep(300);
  const a = actions.find((x) => x.id === id);
  if (!a) throw new Error(`404 Action not found`);
  a.status = status;
  a.approval_note = note;
  if (status === "approved") {
    log("action_approved", `Action ${a.id} approved: ${a.title}`);
    log("memory", `Approval memory recorded: Approved: ${a.title} [${a.department}] owner ${a.owner}. Note: ${note || "—"}`);
    return { ...clone(a), local_memory_id: `mem_${a.id}`, hydra_memory_ids: null, memory_status: "local" };
  }
  log("action_rejected", `Action ${a.id} rejected: ${a.title}`);
  return clone(a);
}
