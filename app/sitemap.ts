import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/env";

/** The landing page is the one indexed page (#97). */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${APP_URL}/`, changeFrequency: "monthly", priority: 1 }];
}
