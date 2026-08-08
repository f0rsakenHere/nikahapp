/* Minimal .env loader for the standalone `scripts/` tools.

   Next reads `.env.local` itself, but these scripts run under plain node and
   would otherwise see an empty `process.env` and report "MONGODB_URI is not
   set" when the variable is in fact perfectly well set — a confusing failure
   that costs ten minutes every time.

   Deliberately small: no export/quote-continuation/interpolation handling. If
   the env files grow beyond `KEY=value`, swap this for `dotenv`. */
const fs = require("fs");
const path = require("path");

const FILES = [".env.local", ".env"];

/** Loads .env.local then .env, without overwriting anything already set.
 *  Returns the list of files it actually read. */
function loadEnv(root = process.cwd()) {
  const read = [];

  for (const name of FILES) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    read.push(name);

    for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;

      const eq = line.indexOf("=");
      if (eq === -1) continue;

      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();

      // strip one matching pair of surrounding quotes
      if (value.length >= 2 && /^(".*"|'.*')$/s.test(value)) value = value.slice(1, -1);

      // first file wins, and a real environment variable beats both
      if (!(key in process.env)) process.env[key] = value;
    }
  }

  return read;
}

/** Reads a required variable, or exits with an instruction rather than a
 *  stack trace. Scripts in this repo fail loudly and say what to do. */
function requireEnv(key) {
  const value = process.env[key];
  if (value) return value;

  console.error(
    `\n${key} is not set.\n\n` +
      `  cp .env.example .env.local     # then fill in the values\n\n` +
      `Checked: ${FILES.join(", ")} in ${process.cwd()}\n`
  );
  process.exit(1);
}

module.exports = { loadEnv, requireEnv };
