import fs from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = new URL(process.env.MCP_URL ?? "http://127.0.0.1:3000/mcp");

async function main() {
  const repoRoot = path.resolve(import.meta.dirname ?? __dirname, "..");
  const tempRoot = path.join(repoRoot, ".tmp-smoke-tests");
  fs.mkdirSync(tempRoot, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(tempRoot, "db-"));
  const databasePath = path.join(tempDir, "kitchen.db");
  process.env.KITCHEN_DB_PATH = databasePath;

  const client = new Client({ name: "smoke-test", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(url));

  const { tools } = await client.listTools();
  if (tools.length !== 13) {
    throw new Error(`Expected 13 tools, got ${tools.length}: ${tools.map((t) => t.name).join(", ")}`);
  }

  const calls: [string, Record<string, unknown>][] = [
    ["get_expiring_items", { days: 3 }],
    ["suggest_recipes", { max_time_minutes: 20 }],
    ["add_to_shopping_list", { item: "parmesan" }],
    ["get_shopping_list", { status: "pending" }],
    ["start_timer", { label: "pasta", minutes: 10 }],
  ];

  for (const [name, args] of calls) {
    const res = await client.callTool({ name, arguments: args });
    const content = (res.content ?? []) as { type: string; text?: string }[];
    const output = content.map((c) => c.text ?? "").join("\n");
    if (res.isError) {
      throw new Error(`${name} failed: ${output}`);
    }
  }

  await client.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
}

main().catch((e) => {
  console.error("Smoke test failed:", e);
  process.exit(1);
});