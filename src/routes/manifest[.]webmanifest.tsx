import { createFileRoute } from "@tanstack/react-router";
import talkoraLogo from "@/assets/talkora-logo.png.asset.json";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

// Dynamic web app manifest — icon URLs carry the asset_id as a version
// query param so installed PWAs and browser caches refresh whenever the
// logo is re-uploaded (asset_id changes => new URL => fresh fetch).
export const Route = createFileRoute("/manifest.webmanifest")({
  server: {
    handlers: {
      GET: () => {
        const v = talkoraLogo.asset_id;
        const iconUrl = `${talkoraLogo.url}?v=${v}`;

        const manifest = {
          name: `${APP_NAME} — ${APP_TAGLINE}`,
          short_name: APP_NAME,
          description:
            "Talkora — voice rooms, chats and calls in a safe, verified 18+ community.",
          start_url: `/?v=${v}`,
          scope: "/",
          display: "standalone",
          orientation: "portrait",
          background_color: "#1a1224",
          theme_color: "#1a1224",
          lang: "en",
          dir: "ltr",
          version: v,
          icons: [
            { src: iconUrl, sizes: "192x192", type: talkoraLogo.content_type, purpose: "any" },
            { src: iconUrl, sizes: "512x512", type: talkoraLogo.content_type, purpose: "any" },
            { src: iconUrl, sizes: "192x192", type: talkoraLogo.content_type, purpose: "maskable" },
            { src: iconUrl, sizes: "512x512", type: talkoraLogo.content_type, purpose: "maskable" },
            { src: iconUrl, sizes: "any", type: talkoraLogo.content_type, purpose: "any" },
          ],
        };

        return new Response(JSON.stringify(manifest, null, 2), {
          headers: {
            "Content-Type": "application/manifest+json; charset=utf-8",
            // Allow CDN/browser to cache, but revalidate so a new asset_id propagates fast.
            "Cache-Control": "public, max-age=300, must-revalidate",
          },
        });
      },
    },
  },
});
