import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

function isHarmlessDependencyWarning(warning: { code?: string; id?: string; message?: string }) {
  const id = warning.id ?? "";
  const message = warning.message ?? "";
  const isDependencyWarning = id.includes("node_modules") || message.includes("node_modules/");

  if (warning.code === "EMPTY_BUNDLE" || message.startsWith("Generated an empty chunk:")) {
    return true;
  }

  if (!isDependencyWarning) return false;

  return (
    warning.code === "MODULE_LEVEL_DIRECTIVE" ||
    warning.code === "UNUSED_EXTERNAL_IMPORT" ||
    message.includes("Module level directives cause errors when bundled") ||
    message.includes("are imported from external module") ||
    message.includes("is imported from external module")
  );
}

export default defineConfig({
  cloudflare: false,
  vite: {
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          if (isHarmlessDependencyWarning(warning)) return;

          warn(warning);
        },
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;

            if (id.includes("react-dom") || id.includes("node_modules/react/")) {
              return "vendor-react";
            }

            if (id.includes("@tanstack/react-router") || id.includes("@tanstack/router-core")) {
              return "vendor-router";
            }

            if (id.includes("@tanstack/react-query") || id.includes("@tanstack/query-core")) {
              return "vendor-query";
            }

            if (id.includes("@supabase/")) {
              return "vendor-supabase";
            }

            if (id.includes("recharts") || id.includes("victory-vendor") || id.includes("d3-")) {
              return "vendor-charts";
            }

            if (id.includes("framer-motion") || id.includes("motion-")) {
              return "vendor-motion";
            }

            if (id.includes("@radix-ui") || id.includes("cmdk") || id.includes("vaul")) {
              return "vendor-ui";
            }

            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
          },
        },
      },
    },
  },
  plugins: [
    nitro({
      preset: "vercel",
      rollupConfig: {
        onwarn(warning, warn) {
          if (isHarmlessDependencyWarning(warning)) return;

          warn(warning);
        },
      },
      vercel: {
        functions: {
          runtime: "nodejs22.x",
        },
      },
    }),
  ],
});
