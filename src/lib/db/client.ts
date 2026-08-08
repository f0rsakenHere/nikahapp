/* The MongoDB connection. One client for the whole process.
 *
 * This is the only module that constructs a `MongoClient`. Everything else
 * goes through `getDb()` or, once they exist, the repositories in
 * `src/lib/repositories` (docs/APP-PLAN.md §4.3).
 *
 * Two things this file exists to get right:
 *
 * 1. **One client, cached on `globalThis`.** A `MongoClient` owns a
 *    connection pool. Next's dev server re-evaluates modules on every edit,
 *    and serverless re-evaluates them per cold start, so a module-level
 *    `new MongoClient()` leaks a pool each time and eventually exhausts the
 *    cluster's connection limit — which on a shared Atlas tier is a few
 *    hundred, reached faster than you would think. §4.2, "serverless caveat".
 *
 * 2. **Lazy.** The client is built on first use, not at import time, so
 *    importing anything from `src/lib/db` in a route that does not touch the
 *    database costs nothing and does not fail the build when the environment
 *    is missing.
 */
import { MongoClient, ServerApiVersion, type ClientSession, type Db } from "mongodb";

/* This module holds a credential and opens sockets. It must never be bundled
 * into a client component. Next would normally catch that with the
 * `server-only` package; this is the same guard without the dependency. */
if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/db/client.ts was imported into client code. Database access " +
      "belongs in a Server Component, a route handler or a server action."
  );
}

const options = {
  serverApi: {
    version: ServerApiVersion.v1,

    /* Atlas's copy-paste snippet sets `strict: true`. We do not, deliberately.
     *
     * Strict mode rejects any command or aggregation stage outside Stable API
     * v1 — which includes `$search` and `createSearchIndexes`. The plan uses
     * Atlas Search for matchmaker candidate search (§4.1), so strict mode
     * would work fine right up until the day that lands and then fail with an
     * error that reads like a permissions problem. Turn it back on if Atlas
     * Search is dropped. */
    strict: false,

    /* Deprecated server behaviour errors instead of warning, so we find out
     * during development rather than at the next major upgrade. */
    deprecationErrors: true,
  },

  /* Default is 30s. Long enough that a wrong password or a missing IP
   * allowlist entry looks like a hang instead of an error. */
  serverSelectionTimeoutMS: 10_000,

  /* Atlas shared tiers cap total connections per cluster, and a preview
   * deploy per pull request multiplies whatever we choose here. */
  maxPoolSize: 10,
};

type Cache = { client: MongoClient; promise: Promise<MongoClient> };

/* `globalThis` survives Next's module reload; a module-level `let` does not. */
const cache = globalThis as typeof globalThis & { __nikahMongo?: Cache };

function connect(): Promise<MongoClient> {
  if (cache.__nikahMongo) return cache.__nikahMongo.promise;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env.local and fill it in."
    );
  }
  if (uri.includes("<") || uri.includes("USERNAME") || uri.includes("PASSWORD")) {
    throw new Error(
      "MONGODB_URI still contains a placeholder. Replace the username and " +
        "password in .env.local with the real Atlas database user."
    );
  }

  const client = new MongoClient(uri, options);

  /* Cache the promise, not the resolved client: two concurrent requests
   * during a cold start would otherwise each start their own connection. On
   * failure, drop the cache so the next request retries instead of being
   * handed a permanently rejected promise. */
  const promise = client.connect().catch((err) => {
    cache.__nikahMongo = undefined;
    throw err;
  });

  cache.__nikahMongo = { client, promise };
  return promise;
}

/** The connected client. Prefer `getDb()` unless you need sessions or admin. */
export function getClient(): Promise<MongoClient> {
  return connect();
}

/** The application database. */
export async function getDb(): Promise<Db> {
  const client = await connect();
  return client.db(process.env.MONGODB_DB || "nikahcanada");
}

/** Starts a session for a multi-document transaction — §5.12 lists the four
 *  operations that require one. Everything else should not use this. */
export async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>
): Promise<T> {
  const client = await connect();
  const session = client.startSession();
  try {
    return await session.withTransaction(() => fn(session));
  } finally {
    await session.endSession();
  }
}
