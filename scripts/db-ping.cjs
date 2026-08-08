/* Connection check for the MongoDB cluster.
 *
 * "It connected" is a weaker claim than it sounds. An Atlas user can connect
 * and still be unable to write; a cluster can accept writes and still refuse
 * transactions. §5.12 makes transactions mandatory for contact release and
 * fee capture, so this proves all three — connect, write, transact — rather
 * than pinging and declaring success.
 *
 * Exits non-zero on any failure, and prints what to do about it.
 *
 *   node scripts/db-ping.cjs
 */
const { MongoClient, ServerApiVersion } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");

const files = loadEnv();
const uri = requireEnv("MONGODB_URI");
const dbName = process.env.MONGODB_DB || "nikahcanada";

/** Never print the password, not even into a local terminal that ends up in a
 *  screenshot or a support ticket. */
function redact(u) {
  return u.replace(/\/\/([^:@/]*):([^@/]*)@/, (_, user) => `//${user}:••••••••@`);
}

/* Placeholder detection, because the failure it produces otherwise is an
 * authentication error that reads like the password is wrong. */
for (const marker of ["<db_username>", "<db_password>", "USERNAME", "PASSWORD", "<", ">"]) {
  if (uri.includes(marker)) {
    console.error(
      `\nMONGODB_URI still contains a placeholder (${marker}).\n\n` +
        `  ${redact(uri)}\n\n` +
        `Atlas → Database Access → the database user's name goes where the\n` +
        `placeholder is. Edit .env.local.\n`
    );
    process.exit(1);
  }
}

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

const CHECK = "__connectionCheck";

(async () => {
  console.log(`env      ${files.length ? files.join(", ") : "none found — using process env"}`);
  console.log(`uri      ${redact(uri)}`);
  console.log(`database ${dbName}\n`);

  await client.connect();
  const db = client.db(dbName);

  /* 1. reachable */
  await db.command({ ping: 1 });
  console.log("pass  ping");

  /* 2. what we are actually talking to */
  const hello = await db.admin().command({ hello: 1 });
  const isReplicaSet = Boolean(hello.setName);
  console.log(`      server ${hello.maxWireVersion ? `wire ${hello.maxWireVersion}` : "?"}` +
    `  topology ${isReplicaSet ? `replica set "${hello.setName}"` : "standalone"}`);

  /* 3. writable — an Atlas user scoped to `read` connects perfectly happily */
  const col = db.collection(CHECK);
  const { insertedId } = await col.insertOne({ at: new Date(), by: "scripts/db-ping.cjs" });
  await col.deleteOne({ _id: insertedId });
  console.log("pass  write + delete");

  /* 4. transactions — §5.12 depends on these, and they need a replica set */
  if (!isReplicaSet) {
    console.error(
      "\nFAIL  this deployment is not a replica set, so multi-document\n" +
        "      transactions are unavailable. Contact release and fee capture\n" +
        "      (APP-PLAN §5.12) cannot be made atomic on it.\n"
    );
    process.exit(1);
  }
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      await col.insertOne({ at: new Date(), tx: true }, { session });
      await col.deleteMany({ tx: true }, { session });
    });
    console.log("pass  transaction");
  } finally {
    await session.endSession();
  }

  /* 5. what is already there */
  const names = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter((n) => n !== CHECK)
    .sort();
  console.log(`\ncollections in ${dbName}: ${names.length ? names.join(", ") : "(none yet)"}`);

  await db.collection(CHECK).drop().catch(() => {});
  console.log("\nMongoDB is set up and usable.");
})()
  .catch((err) => {
    const msg = String(err && err.message);
    console.error(`\nFAIL  ${msg}\n`);

    if (/bad auth|Authentication failed/i.test(msg)) {
      console.error(
        "The cluster is reachable but rejected the credentials.\n" +
          "  · Atlas → Database Access — check the user exists and the password matches.\n" +
          "  · A password containing @ : / ? # [ ] % must be percent-encoded in the URI.\n"
      );
    } else if (/ENOTFOUND|querySrv|getaddrinfo/i.test(msg)) {
      console.error("The SRV hostname did not resolve. Check the cluster address, and DNS.\n");
    } else if (/timed out|ServerSelection/i.test(msg)) {
      console.error(
        "Could not reach any server before the timeout — almost always the IP\n" +
          "allowlist. Atlas → Network Access → add this machine's address.\n"
      );
    } else if (/not authorized/i.test(msg)) {
      console.error(
        "Connected, but the database user lacks the privilege for that operation.\n" +
          "Atlas → Database Access → grant readWrite on the application database.\n"
      );
    }
    process.exitCode = 1;
  })
  .finally(() => client.close());
