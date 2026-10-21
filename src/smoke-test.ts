import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = new URL(process.env.MCP_URL ?? "http://127.0.0.1:3000/mcp");

async function main() {
  const client = new Client({ name: "smoke-test", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(url));

  const { tools } = await client.listTools();
  console.log(`Connected to ${url}`);
  console.log(`${tools.length} tools: ${tools.map((t) => t.name).join(", ")}`);

  const calls: [string, Record<string, unknown>][] = [
    ["get_expiring_items", { days: 3 }],
    ["suggest_recipes", { max_time_minutes: 20 }],
    ["add_to_shopping_list", { item: "parmesan" }],
    ["get_shopping_list", {}],
    ["start_timer", { label: "pasta", minutes: 10 }],
  ];

  for (const [name, args] of calls) {
    const res = await client.callTool({ name, arguments: args });
    const content = (res.content ?? []) as { type: string; text?: string }[];
    console.log(`\n> ${name} ${JSON.stringify(args)}${res.isError ? "  [ERROR]" : ""}`);
    console.log(content.map((c) => c.text ?? "").join("\n"));
  }

  await client.close();
}

main().catch((e) => {
  console.error("Smoke test failed:", e);
  process.exit(1);
});