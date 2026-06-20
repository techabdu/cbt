import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// CSP connect-src must list an *origin* (or a path ending in "/"). A bare path
// such as "http://localhost:8000/api" triggers CSP exact-path matching, which
// blocks requests to "/api/auth/login" and friends. NEXT_PUBLIC_API_URL keeps
// the /api suffix (it doubles as the API client base URL), so derive the bare
// origin from it for the connect-src allowlist.
const apiOrigin = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) return "";
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
})();

const nextConfig: NextConfig = {
  async headers() {
    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-XSS-Protection", value: "1; mode=block" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];

    if (isProd) {
      securityHeaders.push(
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self'",
            ("connect-src 'self' " + apiOrigin).trim(),
            "frame-ancestors 'none'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join("; "),
        }
      );
    }

    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
