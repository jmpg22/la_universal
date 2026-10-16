import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // En desarrollo, permite abrir la tienda desde otros equipos de la red (192.168.x.x)
  // y desde túneles públicos (Cloudflare o ngrok). No afecta a la versión de producción.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "*.trycloudflare.com", "*.ngrok-free.app"],
  experimental: {
    serverActions: {
      // Permite subir fotos de productos de hasta ~4 MB desde el panel.
      bodySizeLimit: "5mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
