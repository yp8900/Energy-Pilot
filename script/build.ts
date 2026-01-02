import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, writeFile } from "fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "bacstack",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memoizee",
  "memorystore",
  "modbus-serial",
  "mssql",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "openid-client",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  // Create production package.json for dist folder
  const distPackageJson = {
    "name": "encharge-bacnet-enhanced",
    "version": "1.0.0",
    "description": "EnCharge Energy Management System with Enhanced BACnet IP + Modbus Integration",
    "main": "index.cjs",
    "type": "commonjs",
    "license": "MIT",
    "scripts": {
      "start": "node index.cjs",
      "test": "node test-enhanced-bacnet.js"
    },
    "dependencies": {
      "sqlite3": "^5.1.7"
    },
    "engines": {
      "node": ">=18.0.0"
    },
    "keywords": [
      "bacnet",
      "modbus", 
      "energy-management",
      "building-automation",
      "protocol-integration",
      "loytec",
      "liob-585"
    ]
  };

  await writeFile("dist/package.json", JSON.stringify(distPackageJson, null, 2));
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
