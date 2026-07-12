import { spawn } from "node:child_process";
import { EOL } from "node:os";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const processes = [
  { name: "api", color: "\x1b[36m", args: ["run", "dev:api"] },
  { name: "worker", color: "\x1b[35m", args: ["run", "dev:worker"] },
  { name: "web", color: "\x1b[32m", args: ["run", "dev:web"] },
  { name: "agency", color: "\x1b[33m", args: ["run", "dev:agency"] }
];

const reset = "\x1b[0m";
const children = new Map();
let shuttingDown = false;

function prefixOutput(name, color, stream, output) {
  const text = output.toString();
  const lines = text.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    if (!line && index === lines.length - 1) {
      continue;
    }

    stream.write(`${color}[${name}]${reset} ${line}${EOL}`);
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children.values()) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => {
    for (const child of children.values()) {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }

    process.exit(exitCode);
  }, 1500).unref();
}

for (const processConfig of processes) {
  const child = spawn(npmCommand, processConfig.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"]
  });

  children.set(processConfig.name, child);

  child.stdout.on("data", (chunk) => prefixOutput(processConfig.name, processConfig.color, process.stdout, chunk));
  child.stderr.on("data", (chunk) => prefixOutput(processConfig.name, processConfig.color, process.stderr, chunk));

  child.on("exit", (code, signal) => {
    children.delete(processConfig.name);

    if (!shuttingDown && code !== 0) {
      const reason = signal ? `signal ${signal}` : `exit code ${code}`;
      console.error(`${processConfig.color}[${processConfig.name}]${reset} stopped with ${reason}`);
      shutdown(code ?? 1);
    }
  });
}

console.log("PropertyFlow dev stack started: api, worker, web, agency.");
console.log("Web: http://localhost:3000 | Agency: http://localhost:3002 | API: http://localhost:3001/docs");
console.log("Press Ctrl+C to stop all dev processes.");

process.once("SIGINT", () => shutdown(0));
process.once("SIGTERM", () => shutdown(0));
