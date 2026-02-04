#!/usr/bin/env node

import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8")
);

const HELP = `
Usage: klaude <command> [options]

Commands:
  start       Start the Klaude server

Options:
  -p, --port <port>   Port to listen on (default: 3001)
  -h, --help          Show this help message
  -v, --version       Show version number

Examples:
  klaude start
  klaude start -p 8080
`;

function parseArgs(args) {
  const parsed = { command: null, port: 3001 };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "-h" || arg === "--help") {
      console.log(HELP.trim());
      process.exit(0);
    }

    if (arg === "-v" || arg === "--version") {
      console.log(packageJson.version);
      process.exit(0);
    }

    if (arg === "-p" || arg === "--port") {
      const port = parseInt(args[++i], 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        console.error(`Error: Invalid port number "${args[i]}"`);
        process.exit(1);
      }
      parsed.port = port;
      continue;
    }

    if (!arg.startsWith("-") && !parsed.command) {
      parsed.command = arg;
    }
  }

  return parsed;
}

function ensureDataDir() {
  const klaudeDir = path.join(os.homedir(), ".klaude");
  if (!fs.existsSync(klaudeDir)) {
    fs.mkdirSync(klaudeDir, { recursive: true });
  }
  return klaudeDir;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.command) {
    console.log(HELP.trim());
    process.exit(1);
  }

  if (args.command !== "start") {
    console.error(`Error: Unknown command "${args.command}"`);
    console.log(HELP.trim());
    process.exit(1);
  }

  // Set up environment
  const klaudeDir = ensureDataDir();

  // Point to the static frontend files (out/ directory next to bin/)
  process.env.KLAUDE_STATIC_DIR =
    process.env.KLAUDE_STATIC_DIR || path.join(__dirname, "..", "out");

  // Default database location
  process.env.DATABASE_PATH =
    process.env.DATABASE_PATH || path.join(klaudeDir, "klaude.db");

  // Set port
  process.env.PORT = String(args.port);

  // Import and start the backend server
  await import("../backend/dist/index.js");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
