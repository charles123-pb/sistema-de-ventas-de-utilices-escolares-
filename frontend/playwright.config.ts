import { defineConfig, devices } from "@playwright/test";
import { env } from "node:process";
const apiPort = env.E2E_API_PORT || "8082";
const webPort = env.E2E_WEB_PORT || "5174";
const baseURL = `http://127.0.0.1:${webPort}`;
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  use: { baseURL, ...devices["Desktop Firefox"], trace: "off" },
  projects: [{ name: "firefox" }],
  webServer: [
    {
      command:
        "go test -v ./internal/handlers -run ^TestBrowserServer$ -timeout 10m",
      cwd: "../backend",
      env: { UV_E2E: "1", UV_E2E_PORT: apiPort, UV_E2E_ORIGIN: baseURL },
      url: `http://127.0.0.1:${apiPort}/api/health`,
      timeout: 180000,
      reuseExistingServer: false,
    },
    {
      command: `npm run dev -- --port ${webPort} --strictPort`,
      env: { VITE_API_TARGET: `http://127.0.0.1:${apiPort}`, VITE_DEMO: "0" },
      url: baseURL,
      timeout: 30000,
      reuseExistingServer: false,
    },
  ],
});
