import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
let isShuttingDown = false;
const processes = [];

const isPortAvailable = (port, host) =>
  new Promise((resolveCheck) => {
    const server = createServer();

    server.once("error", () => {
      resolveCheck(false);
    });
    server.once("listening", () => {
      server.close(() => resolveCheck(true));
    });
    server.listen({
      host,
      port
    });
  });

const findAvailablePort = async (preferredPort, host) => {
  let port = preferredPort;

  while (!(await isPortAvailable(port, host))) {
    port += 1;
  }

  return port;
};

const spawnProcess = ({ args, env, name }) => {
  const child = spawn(npmCommand, args, {
    cwd: rootDir,
    env: {
      ...process.env,
      NODE_ENV: "development",
      ...env
    },
    shell: false,
    stdio: "inherit"
  });

  child.on("exit", (code, signal) => {
    if (isShuttingDown) {
      return;
    }

    console.error(`${name} stopped${signal ? ` by ${signal}` : ` with code ${code}`}.`);
    shutdown(code ?? 1);
  });

  processes.push(child);
};

const shutdown = (code = 0) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  for (const child of processes) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => process.exit(code), 250);
};

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const main = async () => {
  const apiPort = await findAvailablePort(Number(process.env.PORT ?? 3000), "0.0.0.0");
  const appPort = await findAvailablePort(Number(process.env.VITE_PORT ?? 5173), "0.0.0.0");
  const apiProxyTarget = `http://localhost:${apiPort}`;

  console.log(`Starting API on ${apiProxyTarget}`);
  console.log(`Starting Mini App on http://localhost:${appPort}`);
  console.log("Starting Notification Dispatcher");
  console.log("Starting Organization Deletion Worker");

  spawnProcess({
    args: ["run", "dev:api"],
    env: {
      PORT: String(apiPort)
    },
    name: "API"
  });
  spawnProcess({
    args: ["run", "dev:web", "--", "--port", String(appPort)],
    env: {
      VITE_API_PROXY_TARGET: apiProxyTarget
    },
    name: "Mini App"
  });
  spawnProcess({
    args: ["run", "dev:notification-dispatcher"],
    env: {},
    name: "Notification Dispatcher"
  });
  spawnProcess({
    args: ["run", "dev:organization-deletion-worker"],
    env: {},
    name: "Organization Deletion Worker"
  });
};

main().catch((error) => {
  console.error(`Failed to start dev servers: ${error.message}`);
  shutdown(1);
});
