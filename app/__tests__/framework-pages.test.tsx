import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import RootError from "@/app/error";
import FrameError from "@/app/(frame)/error";
import GlobalError from "@/app/global-error";

vi.mock("@/app/fonts", () => ({ fontClasses: "fonts" }));

/** What a member must never see: the raw text of whatever threw. In
 *  development Next forwards a server error's message to the client, and a
 *  client component's error always carries its own. */
const LEAK = "relation public.profiles: permission denied for service_role";

function thrown() {
  return Object.assign(new Error(LEAK), { digest: "4217" });
}

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe.each([
  ["app/error.tsx", RootError],
  ["app/(frame)/error.tsx", FrameError],
])("%s", (_file, ErrorPage) => {
  it("offers a retry and a way back, and never the error's own text", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErrorPage error={thrown()} retry={() => {}} reset={() => {}} />);

    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Meet4Weed" })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(LEAK);
  });
});

/** global-error replaces the root layout when that layout itself throws, so
 *  it brings its own document, styles and fonts. */
describe("app/global-error.tsx", () => {
  it("renders its own document, with no error text in it", () => {
    const html = renderToStaticMarkup(<GlobalError error={thrown()} retry={() => {}} reset={() => {}} />);

    expect(html).toMatch(/^<html[^>]*>/);
    expect(html).toContain("<body");
    expect(html).toContain("Something went wrong");
    expect(html).toContain("Try again");
    expect(html).not.toContain(LEAK);
  });

  it("does not lean on the root layout for styles or theme", () => {
    const source = read("app/global-error.tsx");

    expect(source).not.toMatch(/from ["']\.\/layout["']/);
    expect(source).toMatch(/import ["']\.\/globals\.css["']/);
    expect(source).toContain("bootTheme");
  });
});

/** Colours come from token classes only (CLAUDE.md, Styling). */
describe("framework pages", () => {
  it.each([
    "app/not-found.tsx",
    "app/error.tsx",
    "app/global-error.tsx",
    "app/loading.tsx",
    "app/(frame)/not-found.tsx",
    "app/(frame)/error.tsx",
    "app/(frame)/loading.tsx",
    "components/fallback/fallback-screens.tsx",
  ])("%s writes no colour value", (file) => {
    expect(read(file)).not.toMatch(/oklch\(|#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });
});
