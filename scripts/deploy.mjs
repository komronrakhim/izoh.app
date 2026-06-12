import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const args = new Set(process.argv.slice(2));

const run = (command, commandArgs) =>
  new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, commandArgs, {
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

      rejectRun(new Error(`${command} ${commandArgs.join(" ")} exited with code ${code}.`));
    });
  });

const ensureRequiredEnv = () => {
  const requiredEnv = ["DATABASE_URL"];

  const missingEnv = requiredEnv.filter((key) => !process.env[key]);

  if (missingEnv.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnv.join(", ")}.`);
  }
};

const applyMigrations = async (skipMigration = false) => {
  if (skipMigration) {
    console.log("Skipping migration step by flag.");
    return;
  }

  await run(npmCommand, ["run", "db:migrate:deploy"]);
};

const runVerify = async () => {
  if (!args.has("--verify")) {
    return;
  }

  await run(npmCommand, ["run", "typecheck"]);
  await run(npmCommand, ["run", "test"]);
};

const main = async () => {
  ensureRequiredEnv();
  const skipDb = args.has("--skip-db");

  console.log("Preparing deployment environment");
  await run(npmCommand, ["run", "db:generate"]);

  if (!skipDb) {
    await applyMigrations(args.has("--skip-migrations"));
  } else {
    console.log("Skipping database migration step by flag.");
  }

  await runVerify();
  console.log("Deployment preparation finished.");
};

main().catch((error) => {
  console.error(`\nDeployment preparation failed: ${error.message}`);
  process.exit(1);
});
