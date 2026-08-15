import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: [
      ".agents/**",
      ".claude/**",
      ".opencode/**",
      ".vite-hooks/**",
      "AGENTS.md",
      "ROADMAP.md",
      "flake.lock",
      "flake.nix",
      "migrations/**",
      "skills-lock.json",
      "src/routeTree.gen.ts",
      "worker-configuration.d.ts",
    ],
  },
  lint: {
    ignorePatterns: [
      ".agents/**",
      ".claude/**",
      ".opencode/**",
      "AGENTS.md",
      "migrations/**",
      "src/routeTree.gen.ts",
      "worker-configuration.d.ts",
    ],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    options: { typeAware: true, typeCheck: true },
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: lazyPlugins(() => [
    tailwindcss(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart({ srcDirectory: "src" }),
    react(),
  ]),
});
