import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OfflinePage from "@/app/offline/page";
import { config } from "@/proxy";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("the offline screen (#51, ADR 0001)", () => {
  it("says the member is offline and offers a way back", () => {
    render(<OfflinePage />);
    expect(screen.getByRole("heading", { name: "You are offline" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /try again/i })).toHaveAttribute("href", "/");
  });

  /** The service worker caches this page once and shows it for every page
   *  with no signal. Anything it read from the database would be frozen in
   *  device storage — the exact leak ADR 0001 exists to stop. */
  it("reads nothing from the database", () => {
    const source = read("app/offline/page.tsx");
    expect(source).not.toMatch(/supabase|cookies|headers|fetch\(/);
  });

  // The worker fetches it at install, and a visitor on /login installs the
  // worker too. A redirect would cache the sign-in page as the offline page.
  it("is open to a signed-out visitor", () => {
    const prefixes = read("lib/supabase/session.ts").match(/const PUBLIC_PREFIXES = \[([^\]]*)\]/)![1];
    expect(prefixes).toContain('"/offline"');
  });
});

describe("the files that make the app installable", () => {
  const gated = (path: string) => config.matcher.some((m) => new RegExp(`^${m}$`).test(path));

  it("skip the sign-in proxy, so a signed-out browser gets them and not /login", () => {
    expect(gated("/sw.js")).toBe(false);
    expect(gated("/manifest.webmanifest")).toBe(false);
    expect(gated("/seshes")).toBe(true);
  });
});
