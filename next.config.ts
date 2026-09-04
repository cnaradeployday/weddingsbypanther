import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // potrace's CJS internals (optional Jimp/get-pixels-style type checks)
  // break when bundled by Turbopack — instanceof checks against an import
  // that doesn't interop cleanly. Left as a plain runtime require instead,
  // same as sharp already is by default.
  serverExternalPackages: ["potrace"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fqomygvhtdocfnisasrb.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
