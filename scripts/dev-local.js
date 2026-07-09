import { spawn } from "node:child_process";

const commands = [
  { name: "api", command: "node", args: ["server/index.js"] },
  { name: "web", command: "npx", args: ["vite"] },
];

const children = commands.map(({ name, command, args }) => {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] salio con codigo ${code}`);
    }
  });

  return child;
});

function stop() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(0);
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
