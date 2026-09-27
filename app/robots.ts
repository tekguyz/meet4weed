import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/env";

/** Crawling is allowed everywhere, so a crawler can read the noindex that the
 *  root layout sets on every page but the landing page (#97). A disallow would
 *  hide that noindex, and a blocked URL can still be listed from links. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
