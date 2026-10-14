import { copyFileSync, existsSync } from "node:fs";

const dest = ".vercel/output/functions/__server.func/_libs";
const src = "node_modules/@electric-sql/pglite/dist";
if (!existsSync(dest)) {
  console.log("[pglite] no server bundle yet — skip");
  process.exit(0);
}
for (const name of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
  copyFileSync(`${src}/${name}`, `${dest}/${name}`);
}
console.log("[pglite] copied data and wasm next to the server bundle");
