import type { MetadataRoute } from "next";

import { getNostraEnvironment } from "@/lib/system/environment";

export default function robots(): MetadataRoute.Robots {
  const environment =
    getNostraEnvironment();

  if (!environment.isProduction) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
  };
}
