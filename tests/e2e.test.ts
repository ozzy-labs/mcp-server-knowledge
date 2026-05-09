import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SERVER_PATH = path.resolve(import.meta.dirname, "../dist/index.js");

function createServer(): ChildProcess {
  return spawn("node", [SERVER_PATH], {
    env: { ...process.env, NODE_ENV: "test" },
  });
}

async function sendJsonRpc(
  server: ChildProcess,
  message: unknown,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (data: Buffer) => {
      buffer += data.toString();
      if (buffer.includes("\n")) {
        server.stdout?.off("data", onData);
        server.stderr?.off("data", onError);
        try {
          const lines = buffer.split("\n").filter((l) => l.trim() !== "");
          const response = JSON.parse(lines[0]) as Record<string, unknown>;
          resolve(response);
        } catch (_e) {
          reject(new Error(`Failed to parse JSON response: ${buffer}`));
        }
      }
    };

    const onError = (_data: Buffer) => {
      // MCP servers log to stderr, we can ignore this during normal tests
    };

    server.stdout?.on("data", onData);
    server.stderr?.on("data", onError);

    server.stdin?.write(`${JSON.stringify(message)}\n`);
  });
}

describe("MCP Server E2E (Stdio)", () => {
  it("completes the initialize handshake", async () => {
    const server = createServer();

    try {
      const response = await sendJsonRpc(server, {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      });

      expect(response.id).toBe(1);
      const result = response.result as Record<string, unknown>;
      expect(result.protocolVersion).toBeDefined();
      expect(result.capabilities).toBeDefined();
    } finally {
      server.kill();
    }
  });

  it("responds to tools/list and includes core tools", async () => {
    const server = createServer();

    try {
      // 1. Initialize first (most servers require this)
      await sendJsonRpc(server, {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      });

      // 2. List tools
      const response = await sendJsonRpc(server, {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      });

      expect(response.id).toBe(2);
      const result = response.result as { tools: Array<{ name: string }> };
      const names = result.tools.map((t) => t.name);
      expect(names).toContain("list");
      expect(names).toContain("read");
      expect(names).toContain("search");
      expect(names).toContain("related");
    } finally {
      server.kill();
    }
  });

  it("handles tool calls (read tool example)", async () => {
    const server = createServer();

    try {
      await sendJsonRpc(server, {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      });

      const response = await sendJsonRpc(server, {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "read",
          arguments: {
            path: "tools/ripgrep",
          },
        },
      });

      expect(response.id).toBe(3);
      const result = response.result as { content: Array<{ text: string }> };
      expect(result.content[0].text).toContain("# ripgrep");
    } finally {
      server.kill();
    }
  });
});
