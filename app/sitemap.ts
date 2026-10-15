import type { MetadataRoute } from "next";
import { SITE_URL } from "./site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/about", "/privacy", "/terms"].map((path) => ({ url: `${SITE_URL}${path}` }));
}
