import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { buildSeed, type Database } from "../seed";

/**
 * Store em arquivo JSON — padrão no desenvolvimento local e no preview, quando
 * não há `DATABASE_URL`. Escrita atômica (tmp + rename) e fila por processo.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "elo.json");

let cache: Database | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<Database> {
  if (cache) return cache;

  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    cache = JSON.parse(raw) as Database;
    return cache;
  } catch {
    const seed = buildSeed();
    cache = seed;
    await persist(seed);
    return seed;
  }
}

async function persist(database: Database) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(database, null, 2), "utf8");
  await fs.rename(tmp, DATA_FILE);
}

export async function readDb(): Promise<Database> {
  const database = await load();
  return structuredClone(database);
}

export async function updateDb(mutator: (database: Database) => Database | void): Promise<Database> {
  const run = async () => {
    const database = await load();
    const draft = structuredClone(database);
    const result = mutator(draft);
    const next = result ?? draft;
    cache = next;
    await persist(next);
    return structuredClone(next);
  };

  queue = queue.then(run, run);
  return queue as Promise<Database>;
}

export async function resetDb(): Promise<Database> {
  const seed = buildSeed();
  cache = seed;
  await persist(seed);
  return structuredClone(seed);
}
