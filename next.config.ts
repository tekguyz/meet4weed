import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Testing the camera on a real phone needs the dev server on this computer's
  // network address (camera access needs HTTPS off localhost). Next.js blocks
  // dev resources requested from an unlisted origin, so the address is allowed
  // here when .env.local names it. Unset everywhere else, including production.
  allowedDevOrigins: process.env.DEV_LAN_HOST ? [process.env.DEV_LAN_HOST] : [],
};

export default nextConfig;
