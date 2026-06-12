import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const serviceName = (process.env.RAILWAY_SERVICE_NAME ?? "").toLowerCase();

const shouldRunApiPredeploy = serviceName.includes("backend") || serviceName.includes("api");

const run = (script) =>
  new Promise((resolveRun, rejectRun) => {
    const child = spawn(npmCommand, ["run", script], {
      cwd: rootDir,
      env: process.env,
      shell: false,
      stdio: "inherit"
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }

      rejectRun(new Error(`${script} exited with code ${code ?? 1}.`));
    });
  });

if (shouldRunApiPredeploy) {
  await run("predeploy:api");
} else {
  console.log(`Skipping API predeploy for ${process.env.RAILWAY_SERVICE_NAME ?? "service"}.`);
}
