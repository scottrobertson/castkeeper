import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, "migrations"));

  return {
    plugins: [
      cloudflareTest({
        main: "./src/index.tsx",
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          d1Databases: { DB: "DB" },
          bindings: {
            TEST_MIGRATIONS: migrations,
            EMAIL: "test@example.com",
            PASS: "test-password",
          },
        },
      }),
    ],
    test: {
      include: ["test/**/*.test.{ts,tsx}"],
    },
  };
});
