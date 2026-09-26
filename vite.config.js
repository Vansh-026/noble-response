import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

function n8nDevApiPlugin() {
  return {
    name: "n8n-dev-api-proxy",
    configureServer(server) {
      server.middlewares.use("/api/chat", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }

        let bodyText = "";
        req.on("data", (chunk) => {
          bodyText += chunk;
        });

        req.on("end", async () => {
          try {
            const headers = { "Content-Type": "application/json" };
            const primaryUrl = process.env.VITE_N8N_WEBHOOK_URL || "https://n8n-v3-tjln.onrender.com/webhook/mychatapp";
            const fallbackUrl = primaryUrl.includes("/webhook/")
              ? primaryUrl.replace("/webhook/", "/webhook-test/")
              : primaryUrl.replace("/webhook-test/", "/webhook/");

            let n8nRes = await fetch(primaryUrl, {
              method: "POST",
              headers,
              body: bodyText,
            });

            if (n8nRes.status === 404) {
              const altRes = await fetch(fallbackUrl, {
                method: "POST",
                headers,
                body: bodyText,
              });
              if (altRes.ok || altRes.status !== 404) {
                n8nRes = altRes;
              }
            }

            const responseText = await n8nRes.text();
            res.statusCode = n8nRes.status;
            res.setHeader("Content-Type", n8nRes.headers.get("content-type") || "application/json");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.end(responseText);
          } catch (err) {
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ message: "Failed to connect to n8n: " + err.message }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [
    n8nDevApiPlugin(),
    tailwindcss(),
    viteReact(),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@": path.resolve(process.cwd(), "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
