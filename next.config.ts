import type { NextConfig } from "next";

export const REFERRER_POLICY = "strict-origin-when-cross-origin";

const nextConfig: NextConfig = {
  // Testing the camera on a real phone needs the dev server on this computer's
  // network address (camera access needs HTTPS off localhost). Next.js blocks
  // dev resources requested from an unlisted origin, so the address is allowed
  // here when .env.local names it. Unset everywhere else, including production.
  allowedDevOrigins: process.env.DEV_LAN_HOST ? [process.env.DEV_LAN_HOST] : [],

  // Next.js sets no Referrer-Policy of its own, and the default browser
  // behaviour sends the whole URL to any same-scheme site. An invite link
  // carries its token in the path, so one click through to an external site
  // would hand that token away. `strict-origin-when-cross-origin` sends the
  // origin only, and only to a cross-origin destination. Applied to every
  // path so no route can be forgotten.
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "Referrer-Policy", value: REFERRER_POLICY }] }];
  },
};

export default nextConfig;
