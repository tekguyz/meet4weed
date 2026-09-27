import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { metadata as rootMetadata } from "@/app/layout";
import LandingPage, { metadata } from "@/app/landing/page";

// The root layout is imported only for its metadata. Its fonts and styles are
// build-time Next features that vitest cannot load.
vi.mock("@/app/fonts", () => ({ fontClasses: "" }));
vi.mock("@/app/globals.css", () => ({}));
vi.mock("@/components/service-worker", () => ({ ServiceWorker: () => null }));
vi.mock("@/app/demo-actions", () => ({ enterDemo: vi.fn() }));

/** Issue #97. What a signed-out stranger gets on `/`. The proxy serves this
 *  route there; lib/supabase/__tests__/session.test.ts proves who sees it. */
describe("the landing page", () => {
  it("has one top heading", () => {
    render(<LandingPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("says who the app is for", () => {
    render(<LandingPage />);

    const main = screen.getByRole("main");
    expect(main).toHaveTextContent(/Florida/);
    expect(main).toHaveTextContent(/OMMU/);
    expect(main).toHaveTextContent(/21 and over/);
  });

  it("opens the sign-up form from every Sign up", () => {
    render(<LandingPage />);

    const signUps = screen.getAllByRole("link", { name: /^sign up$/i });
    expect(signUps.length).toBeGreaterThan(0);
    for (const link of signUps) expect(link).toHaveAttribute("href", "/login?mode=sign-up");
  });

  it("offers Sign in, to /login", () => {
    render(<LandingPage />);

    const signIns = screen.getAllByRole("link", { name: /^sign in$/i });
    expect(signIns.length).toBeGreaterThan(0);
    for (const link of signIns) expect(link).toHaveAttribute("href", "/login");
  });

  it("links the fine print from the footer", () => {
    render(<LandingPage />);

    const footer = within(screen.getByRole("contentinfo"));
    expect(footer.getByRole("link", { name: "Help" })).toHaveAttribute("href", "/help");
    expect(footer.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(footer.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(footer.getByRole("link", { name: "Community rules" })).toHaveAttribute("href", "/rules");
  });

  it("credits TEKGUYZ with a link to tekguyz.com", () => {
    render(<LandingPage />);

    const credit = within(screen.getByRole("contentinfo")).getByRole("link", { name: /tekguyz/i });
    expect(credit.getAttribute("href")).toMatch(/^https:\/\/tekguyz\.com\/?$/);
  });

  /** PRODUCT.md: never imply a sale; nothing invented. */
  it("uses no sale words and gives no member count", () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/\b(buy|shop|cart|checkout|price|deal|deliver|dispensar|order|discount)\w*/i);
    expect(text).not.toMatch(/\$\s?\d/);
    expect(text).not.toMatch(/\d[\d,.]*\s*k?\+?\s*(members|patients|people|users|hosts)/i);
  });
});

describe("search", () => {
  it("indexes the landing page, with / as its one address", () => {
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
    expect(metadata.alternates?.canonical).toBe("/");
  });

  it("gives the link preview its own title and description, and keeps the shared image", () => {
    expect(metadata.title).toBeTruthy();
    expect(metadata.description).toBeTruthy();
    // Next builds og: and twitter: tags from these, with app/opengraph-image.png.
    // An openGraph or twitter block here would replace that and drop the image.
    expect(metadata.openGraph).toBeUndefined();
    expect(metadata.twitter).toBeUndefined();
  });

  it("keeps every other page out of search by default", () => {
    expect(rootMetadata.robots).toMatchObject({ index: false });
  });
});

/** Colours come from token classes only (CLAUDE.md, Styling). */
it.each(["app/landing/page.tsx", "components/landing/story.tsx", "components/landing/landing-map.tsx"])(
  "%s writes no colour value",
  (file) => {
    expect(readFileSync(resolve(process.cwd(), file), "utf8")).not.toMatch(/oklch\(|#[0-9a-fA-F]{3,8}\b|rgb\(/);
  },
);

/** Issue #39. The demo door fills the slot #97 left under Sign up. */
describe("the landing page's demo door", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is a form button under Sign up when the flag is on, never a link", () => {
    vi.stubEnv("DEMO_MODE_ENABLED", "true");
    render(<LandingPage />);

    expect(screen.getByRole("button", { name: /^try the demo$/i })).toHaveAttribute("type", "submit");
    expect(screen.queryByRole("link", { name: /demo/i })).toBeNull();
  });

  it("is not there when the flag is off", () => {
    vi.stubEnv("DEMO_MODE_ENABLED", "");
    render(<LandingPage />);

    expect(screen.queryByRole("button", { name: /demo/i })).toBeNull();
  });
});
