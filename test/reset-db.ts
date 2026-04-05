import { env, applyD1Migrations } from "cloudflare:test";

export async function resetDatabase() {
  await env.DB.exec("DROP TABLE IF EXISTS episodes");
  await env.DB.exec("DROP TABLE IF EXISTS podcasts");
  await env.DB.exec("DROP TABLE IF EXISTS bookmarks");
  await env.DB.exec("DROP TABLE IF EXISTS backup_progress");
  await env.DB.exec("DROP TABLE IF EXISTS d1_migrations");
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
}
