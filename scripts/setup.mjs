import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(rootDir, ".env");
const envExamplePath = resolve(rootDir, ".env.example");
const nodeModulesPath = resolve(rootDir, "node_modules");
const args = new Set(process.argv.slice(2));

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const log = (message) => {
  console.log(`\n${message}`);
};

const run = (command, commandArgs, options = {}) =>
  new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, commandArgs, {
      cwd: rootDir,
      env: {
        ...process.env,
        ...options.env
      },
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

const parseEnvKeys = (content) => {
  const keys = new Set();

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);

    if (match) {
      keys.add(match[1]);
    }
  }

  return keys;
};

const readTextIfExists = async (path) => {
  if (!existsSync(path)) {
    return undefined;
  }

  return readFile(path, "utf8");
};

const ensureEnvFile = async () => {
  const exampleContent = await readFile(envExamplePath, "utf8");
  const exampleKeys = parseEnvKeys(exampleContent);
  let envContent = await readTextIfExists(envPath);

  if (!envContent) {
    envContent = exampleContent;
    await writeFile(envPath, envContent);
    console.log("Created .env from .env.example.");
    return;
  }

  const envKeys = parseEnvKeys(envContent);
  const missingLines = [];

  for (const line of exampleContent.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);

    if (match && exampleKeys.has(match[1]) && !envKeys.has(match[1])) {
      missingLines.push(line);
    }
  }

  if (missingLines.length > 0) {
    envContent = `${envContent.trimEnd()}\n\n# Added by npm run setup\n${missingLines.join("\n")}\n`;
  }

  if (missingLines.length > 0) {
    await writeFile(envPath, envContent);
    console.log("Updated .env with missing local keys.");
  } else {
    console.log(".env is ready.");
  }
};

const main = async () => {
  const skipInstall = args.has("--skip-install");
  const skipDb = args.has("--skip-db");
  const verify = args.has("--verify");

  await mkdir(resolve(rootDir, ".tmp"), {
    recursive: true
  });

  log("Preparing environment");
  await ensureEnvFile();

  if (!existsSync(nodeModulesPath) && !skipInstall) {
    log("Installing dependencies");
    await run(npmCommand, ["install"]);
  }

  log("Generating Prisma client");
  await run(npmCommand, ["run", "db:generate"]);

  if (!skipDb) {
    log("Syncing database schema");
    await run(npmCommand, ["run", "db:push"]);
  }

  if (verify) {
    log("Running verification");
    await run(npmCommand, ["run", "typecheck"]);
    await run(npmCommand, ["test"]);
  }

  log("Izoh is ready");
  console.log("Run npm run dev:all to start the API and Mini App.");
};

main().catch((error) => {
  console.error(`\nSetup failed: ${error.message}`);
  console.error("Check .env and make sure PostgreSQL is running before trying again.");
  process.exit(1);
});
