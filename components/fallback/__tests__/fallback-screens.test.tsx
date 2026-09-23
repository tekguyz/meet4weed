import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErrorScreen, LoadingScreen, NotFoundScreen } from "@/components/fallback/fallback-screens";

/** The framework pages in the app's own look (issue #63). Every one of them
 *  leaves a way back into the app, so no URL is a dead end. */
describe("NotFoundScreen", () => {
  it("says the page is not there, in plain words", () => {
    render(<NotFoundScreen />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Page not found");
  });

  it("has a way back into the app", () => {
    render(<NotFoundScreen />);

    expect(screen.getByRole("link", { name: "Back to Meet4Weed" })).toHaveAttribute("href", "/");
  });
});

describe("ErrorScreen", () => {
  it("says something went wrong", () => {
    render(<ErrorScreen onRetry={() => {}} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Something went wrong");
  });

  it("retries when asked", async () => {
    const onRetry = vi.fn();
    render(<ErrorScreen onRetry={onRetry} />);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  /** A plain link, not a client navigation: after an error the router itself
   *  may be what broke, and a full load starts clean. */
  it("has a way back into the app that reloads it", () => {
    render(<ErrorScreen onRetry={() => {}} />);

    expect(screen.getByRole("link", { name: "Back to Meet4Weed" })).toHaveAttribute("href", "/");
  });
});

describe("LoadingScreen", () => {
  it("tells a screen reader the page is loading", () => {
    render(<LoadingScreen />);

    expect(screen.getByText("Loading")).toBeInTheDocument();
    expect(screen.getByText("Loading").closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");
  });
});

/** DESIGN.md, Layout: 24px top padding under the Frame's header, 40px without. */
describe("placement", () => {
  it.each([
    ["NotFoundScreen", (framed?: boolean) => <NotFoundScreen framed={framed} />],
    ["ErrorScreen", (framed?: boolean) => <ErrorScreen onRetry={() => {}} framed={framed} />],
    ["LoadingScreen", (framed?: boolean) => <LoadingScreen framed={framed} />],
  ])("%s pads 24px in the Frame and 40px outside it", (_name, make) => {
    const { container, rerender } = render(make(true));
    expect(container.firstElementChild).toHaveClass("py-6");

    rerender(make());
    expect(container.firstElementChild).toHaveClass("py-10");
  });
});
