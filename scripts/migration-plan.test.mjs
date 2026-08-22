import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import { isMigrationFile, migrationName, pendingMigrations } from "./migration-plan.mjs";

const PROJECT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

test("_migrations keys on basename, not path", () => {
  assert.equal(migrationName("/migrations/0002_todos.sql"), "0002_todos.sql");
  assert.equal(migrationName("migrations/auth/0001_auth.sql"), "0001_auth.sql");
  assert.equal(migrationName("0001_auth.sql"), "0001_auth.sql");
});

test("a file already applied from another directory does not re-apply", () => {
  // The auth-on path copies migrations/auth/0001_auth.sql into the globbed
  // directory; a database that already has it must not run it twice.
  assert.deepEqual(pendingMigrations(["/migrations/0001_auth.sql"], ["0001_auth.sql"]), []);
});

test("pending migrations are returned in name order", () => {
  assert.deepEqual(
    pendingMigrations(
      ["/migrations/0003_c.sql", "/migrations/0001_a.sql", "/migrations/0002_b.sql"],
      ["0001_a.sql"],
    ),
    [
      { name: "0002_b.sql", path: "/migrations/0002_b.sql" },
      { name: "0003_c.sql", path: "/migrations/0003_c.sql" },
    ],
  );
});

test("non-.sql entries are dropped (readdir also yields the auth/ directory)", () => {
  assert.equal(isMigrationFile("auth"), false);
  assert.deepEqual(pendingMigrations(["auth", "README.md"], []), []);
});

test("the checked-in migration set is ordered, unique, and non-empty", () => {
  const migrationsDir = join(PROJECT_ROOT, "migrations");
  const entries = readdirSync(migrationsDir);
  const plan = pendingMigrations(entries, []);

  assert.deepEqual(
    plan.map(({ name }) => name),
    ["0001_auth.sql", "0002_desk.sql"],
  );
  assert.equal(new Set(plan.map(({ name }) => name)).size, plan.length);
  for (const { name } of plan) {
    assert.ok(readFileSync(join(migrationsDir, name), "utf8").trim().length > 0);
  }
});
