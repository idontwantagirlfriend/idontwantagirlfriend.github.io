import { createHash } from "node:crypto";

const [username, password] = process.argv.slice(2);

if (!username || !password) {
  console.error("Usage: node scripts/hash-password.mjs <username> <password>");
  console.error('Prints sha256("<username>:<password>") for VITE_SHA256_PASSWORD in .env');
  process.exit(1);
}

console.log(createHash("sha256").update(`${username}:${password}`).digest("hex"));
