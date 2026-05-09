import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  transpilePackages: ["@founder-gps/shared-types"],
  turbopack: {
    root: path.join(webDir, "../..")
  }
};

export default nextConfig;
