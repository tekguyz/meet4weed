import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";
import HelpPage from "@/app/(public)/help/page";
import PrivacyPage from "@/app/(public)/privacy/page";
import RulesPage from "@/app/(public)/rules/page";
import TermsPage from "@/app/(public)/terms/page";

/** Help, Terms, Privacy and Community rules (issue #68). The owner writes the
 *  copy. Until then every page ships its headings and placeholder text that
 *  says, on the page, that it is placeholder — so nobody mistakes it for the
 *  real terms. */
const PAGES: [string, ComponentType, string][] = [
  ["/help", HelpPage, "Help"],
  ["/terms", TermsPage, "Terms"],
  ["/privacy", PrivacyPage, "Privacy"],
  ["/rules", RulesPage, "Community rules"],
];

const CONTACT = "mailto:contact@tekguyz.com";

describe.each(PAGES)("%s", (_path, Page, title) => {
  it("has its title as the one top heading", () => {
    render(<Page />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
  });

  it("marks its placeholder copy as placeholder, on the page", () => {
    render(<Page />);

    expect(screen.getAllByText(/placeholder/i).length).toBeGreaterThan(0);
  });
});

describe("Help", () => {
  it.each([
    /how verification works/i,
    /why a card is rejected/i,
    /fuzzy circle/i,
    /card and face photos/i,
  ])("has a section: %s", (heading) => {
    render(<HelpPage />);

    expect(screen.getByRole("heading", { level: 2, name: heading })).toBeInTheDocument();
  });
});

describe("the contact link", () => {
  it.each([
    ["Help", HelpPage],
    ["Privacy", PrivacyPage],
  ])("is on %s", (_name, Page) => {
    render(<Page />);

    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toContain(CONTACT);
  });

  it.each([
    ["Terms", TermsPage],
    ["Community rules", RulesPage],
  ])("is not on %s", (_name, Page) => {
    render(<Page />);

    const hrefs = screen.queryAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).not.toContain(CONTACT);
  });

  /** "On Help and on Privacy, and nowhere else." Only the two page files may
   *  hold the address; a copy anywhere else is a second contact point. */
  it("appears in no other source file", () => {
    const hits: string[] = [];
    function walk(dir: string) {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (name === "__tests__" || name === "node_modules") continue;
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(tsx?|mdx?)$/.test(name) && readFileSync(path, "utf8").includes("contact@tekguyz.com")) {
          hits.push(relative(process.cwd(), path).replaceAll("\\", "/"));
        }
      }
    }
    for (const dir of ["app", "components", "lib"]) walk(resolve(process.cwd(), dir));

    expect(hits.sort()).toEqual(["app/(public)/help/page.tsx", "app/(public)/privacy/page.tsx"]);
  });
});

/** Colours come from token classes only (CLAUDE.md, Styling). */
it.each([
  "app/(public)/layout.tsx",
  "app/(public)/help/page.tsx",
  "app/(public)/terms/page.tsx",
  "app/(public)/privacy/page.tsx",
  "app/(public)/rules/page.tsx",
  "components/legal/legal-page.tsx",
])("%s writes no colour value", (file) => {
  expect(readFileSync(resolve(process.cwd(), file), "utf8")).not.toMatch(/oklch\(|#[0-9a-fA-F]{3,8}\b|rgb\(/);
});
