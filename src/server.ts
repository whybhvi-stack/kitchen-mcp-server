import express from "express";
import type { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildServer } from "./tools.js";

const PORT = Number(process.env.PORT ?? 3000);
// Bind to localhost only, so the server isn't exposed to your network by default.
const HOST = process.env.HOST ?? "127.0.0.1";

const app = express();
app.use(express.json());

// Stateless Streamable HTTP: a fresh MCP server + transport for each request.
app.post("/mcp", async (req: Request, res: Response) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// Stateless mode has no server-to-client stream or sessions to delete.
const methodNotAllowed = (_req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
};
app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", name: "kitchen-mcp-server" });
});

app.listen(PORT, HOST, () => {
  console.log(`Kitchen MCP server listening on http://${HOST}:${PORT}/mcp`);
});