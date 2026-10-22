/** Postgres (PGlite) acessível por TCP — usado só para testar o caminho Neon localmente. */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const db = new PGlite();
const server = new PGLiteSocketServer({ db, port: 55432, host: "0.0.0.0" });
await server.start();
console.log("PGlite ouvindo em 0.0.0.0:55432");
await new Promise(() => {});
