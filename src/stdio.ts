#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./tools.js";

async function main() {
  const server = buildServer();
  const transport = new StdioServerTransport();
  try {
    await server.connect(transport);
  } catch (error) {
    console.error("Failed to start stdio transport:", error);
    process.exitCode = 1;
  }
}

void main();
