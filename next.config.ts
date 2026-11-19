import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // EXIF's Node adapter loads fs/zlib dynamically; keep it native on the server.
  serverExternalPackages: ["exifr"],
};

export default nextConfig;
