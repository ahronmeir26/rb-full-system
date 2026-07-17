import fs from "node:fs/promises";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const sql = await fs.readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");

function connectionConfig(value) {
  const schemeEnd = value.indexOf("://");
  const credentialsEnd = value.lastIndexOf("@");
  if (schemeEnd < 0 || credentialsEnd < 0) throw new Error("DATABASE_URL is not a valid PostgreSQL URI.");

  const credentials = value.slice(schemeEnd + 3, credentialsEnd);
  const separator = credentials.indexOf(":");
  if (separator < 0) throw new Error("DATABASE_URL does not contain a database password.");

  const server = new URL(`postgresql://${value.slice(credentialsEnd + 1)}`);
  const rawPassword = credentials.slice(separator + 1);
  let password = rawPassword;
  try {
    password = decodeURIComponent(rawPassword);
  } catch {
    // Supabase passwords may be pasted without URL encoding. pg accepts the raw
    // password when connection fields are supplied separately.
  }

  return {
    host: server.hostname,
    port: Number(server.port || 5432),
    database: server.pathname.replace(/^\//, "") || "postgres",
    user: decodeURIComponent(credentials.slice(0, separator)),
    password,
    ssl: { rejectUnauthorized: false },
  };
}

const client = new pg.Client(connectionConfig(connectionString));

await client.connect();
try {
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log("Supabase schema applied successfully.");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
