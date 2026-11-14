import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { closeDb, getDb } from "../src/db/connection.ts";
import { initDatabase } from "../src/db/index.ts";
import * as timerRepo from "../src/db/timerRepo.ts";

const repoRoot = path.resolve(import.meta.dirname ?? __dirname, "..");

function makeTempDb() {
  const tempRoot = path.join(repoRoot, ".tmp-timers-tests");
  mkdirSync(tempRoot, { recursive: true });
  const dbDir = mkdtempSync(path.join(tempRoot, "db-"));
  const file = path.join(dbDir, "kitchen.db");
  return { dir: dbDir, file };
}

async function connectClient(dbFile: string) {
  const client = new Client({ name: "timers-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["dist/stdio.js"],
    cwd: repoRoot,
    env: { ...process.env, KITCHEN_DB_PATH: dbFile },
    stderr: "ignore",
  });

  await client.connect(transport);
  return client;
}

test("start, list, and cancel a timer through the stdio MCP server", async () => {
  const { dir, file } = makeTempDb();

  try {
    process.env.KITCHEN_DB_PATH = file;
    closeDb();
    initDatabase();

    const client = await connectClient(file);

    try {
      const started = await client.callTool({ name: "start_timer", arguments: { label: "pasta", minutes: 10 } });
      const startedText = (started.content ?? []).map((item) => item.text ?? "").join("\n");
      const startedPayload = JSON.parse(startedText);

      assert.equal(startedPayload.label, "pasta");
      assert.equal(startedPayload.status, "running");
      assert.equal(typeof startedPayload.id, "string");

      const listed = await client.callTool({ name: "list_timers", arguments: { status: "running" } });
      const listedText = (listed.content ?? []).map((item) => item.text ?? "").join("\n");
      const listedPayload = JSON.parse(listedText);
      assert.ok(Array.isArray(listedPayload.timers));
      assert.ok(listedPayload.timers.some((timer: { id: string }) => timer.id === startedPayload.id));

      const cancelled = await client.callTool({ name: "cancel_timer", arguments: { id: startedPayload.id } });
      const cancelledText = (cancelled.content ?? []).map((item) => item.text ?? "").join("\n");
      const cancelledPayload = JSON.parse(cancelledText);
      assert.equal(cancelledPayload.status, "cancelled");
    } finally {
      await client.close();
    }
  } finally {
    closeDb();
    delete process.env.KITCHEN_DB_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cancel_timer rejects missing or non-running timers", async () => {
  const { dir, file } = makeTempDb();

  try {
    process.env.KITCHEN_DB_PATH = file;
    closeDb();
    initDatabase();

    const client = await connectClient(file);

    try {
      const missing = await client.callTool({ name: "cancel_timer", arguments: { id: "missing-id" } });
      assert.equal(missing.isError, true);

      const started = await client.callTool({ name: "start_timer", arguments: { label: "tea", minutes: 5 } });
      const startedText = (started.content ?? []).map((item) => item.text ?? "").join("\n");
      const startedPayload = JSON.parse(startedText);

      const cancelled = await client.callTool({ name: "cancel_timer", arguments: { id: startedPayload.id } });
      assert.ok(!cancelled.isError);

      const secondCancel = await client.callTool({ name: "cancel_timer", arguments: { id: startedPayload.id } });
      assert.equal(secondCancel.isError, true);
    } finally {
      await client.close();
    }
  } finally {
    closeDb();
    delete process.env.KITCHEN_DB_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("list_timers marks expired running timers as done", async () => {
  const { dir, file } = makeTempDb();

  try {
    process.env.KITCHEN_DB_PATH = file;
    closeDb();
    initDatabase();

    const db = getDb(file);
    db.prepare(
      "INSERT INTO timers (id, label, ends_at, status, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run("expired-timer", "toast", Date.now() - 1000, "running", new Date(Date.now() - 5 * 60_000).toISOString());
    closeDb();

    const client = await connectClient(file);
    try {
      const listed = await client.callTool({ name: "list_timers", arguments: { status: "all" } });
      const listedText = (listed.content ?? []).map((item) => item.text ?? "").join("\n");
      const listedPayload = JSON.parse(listedText);
      const done = listedPayload.timers.find((timer: { id: string }) => timer.id === "expired-timer");
      assert.ok(done);
      assert.equal(done.status, "done");
    } finally {
      await client.close();
    }
  } finally {
    closeDb();
    delete process.env.KITCHEN_DB_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("start_timer rejects invalid minute values and enforces a 50 active timer limit", async () => {
  const { dir, file } = makeTempDb();

  try {
    process.env.KITCHEN_DB_PATH = file;
    closeDb();
    initDatabase();

    const client = await connectClient(file);

    try {
      for (const minutes of [0, -1, 1441]) {
        const result = await client.callTool({ name: "start_timer", arguments: { label: "bad", minutes } });
        assert.equal(result.isError, true);
      }

      for (let index = 0; index < 50; index += 1) {
        const result = await client.callTool({ name: "start_timer", arguments: { label: `timer-${index}`, minutes: 10 } });
        assert.ok(!result.isError);
      }

      const overflow = await client.callTool({ name: "start_timer", arguments: { label: "overflow", minutes: 10 } });
      assert.equal(overflow.isError, true);
    } finally {
      await client.close();
    }
  } finally {
    closeDb();
    delete process.env.KITCHEN_DB_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("timers persist across stdio restarts", async () => {
  const { dir, file } = makeTempDb();

  try {
    const first = await connectClient(file);
    try {
      const started = await first.callTool({ name: "start_timer", arguments: { label: "garden", minutes: 30 } });
      const startedText = (started.content ?? []).map((item) => item.text ?? "").join("\n");
      const startedPayload = JSON.parse(startedText);
      assert.ok(!started.isError);
      await first.close();

      const second = await connectClient(file);
      try {
        const listed = await second.callTool({ name: "list_timers", arguments: { status: "running" } });
        const listedText = (listed.content ?? []).map((item) => item.text ?? "").join("\n");
        const listedPayload = JSON.parse(listedText);
        const timer = listedPayload.timers.find((item: { id: string }) => item.id === startedPayload.id);
        assert.ok(timer);
        assert.ok(Number(timer.remaining_seconds) > 0);
      } finally {
        await second.close();
      }
    } finally {
      await first.close().catch(() => undefined);
    }
  } finally {
    closeDb();
    delete process.env.KITCHEN_DB_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});

const repoRootTemp = path.join(repoRoot, ".tmp-timers-tests");
try {
  rmSync(repoRootTemp, { recursive: true, force: true });
} catch {
  // no-op
}
