import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// En desarrollo, las llamadas a la API se reenvían al servidor de Python.
const API = process.env.VITE_API_PROXY ?? "http://127.0.0.1:8000";
const rutasApi = [
  "/analisis", "/lotes", "/decisiones", "/configuracion", "/perilla",
  "/simular", "/resumen", "/variables", "/metricas", "/exportar.csv", "/salud",
];

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icono.svg"],
      manifest: {
        name: "VinoScore",
        short_name: "VinoScore",
        description: "Estima si un caldo de vino blanco es prometedor.",
        lang: "es-MX",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#141516",
        theme_color: "#141516",
        icons: [
          { src: "icono-192.png", sizes: "192x192", type: "image/png" },
          { src: "icono-512.png", sizes: "512x512", type: "image/png" },
          { src: "icono-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // La API nunca se sirve desde el caché del service worker.
        navigateFallbackDenylist: [new RegExp(`^(${rutasApi.join("|")})`)],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: Object.fromEntries(rutasApi.map((r) => [r, { target: API, changeOrigin: true }])),
  },
});
