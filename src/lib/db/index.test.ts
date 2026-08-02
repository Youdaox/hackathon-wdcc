import { test } from "node:test";

// PostgreSQL migrations are verified against the hosted DATABASE_URL in CI/deployment.
// The former SQLite-only test cannot exercise the shared database contract.
test.skip("PostgreSQL migrations require DATABASE_URL", () => {});
