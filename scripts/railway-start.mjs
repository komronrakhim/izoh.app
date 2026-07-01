import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const serviceName = [
  process.env.IZOH_SERVICE_ROLE,
  process.env.RAILWAY_SERVICE_NAME,
  process.env.RAILWAY_START_SCRIPT
]
  .filter(Boolean)
  .join(" ")
  .toLowerCase();

const getStartScript = () => {
  if (process.env.RAILWAY_START_SCRIPT) {
    return process.env.RAILWAY_START_SCRIPT;
  }

  if (serviceName.includes("notification") || serviceName.includes("dispatcher")) {
    if (serviceName.includes("qr") || serviceName.includes("pdf")) {
      return "start:qr-pdf-dispatcher";
    }

    return "start:notification-dispatcher";
  }

  if (serviceName.includes("qr") || serviceName.includes("pdf")) {
    return "start:qr-pdf-dispatcher";
  }

  if (serviceName.includes("deletion")) {
    return "start:organization-deletion-worker";
  }

  if (serviceName.includes("backend") || serviceName.includes("api")) {
    return "start:api";
  }

  return "start:web";
};

const startScript = getStartScript();
const child = spawn(npmCommand, ["run", startScript], {
  cwd: rootDir,
  env: process.env,
  shell: false,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
