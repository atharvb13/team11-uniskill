import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: [
        "src/utils/validation.js",
        "src/utils/session.js",
        "src/utils/onboardingLocal.js",
      ],
      exclude: ["src/**/*.test.js"],
    },
  },
});
