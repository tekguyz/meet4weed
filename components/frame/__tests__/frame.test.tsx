import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Frame } from "@/components/frame/frame";

let pathname = "/seshes";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const unreadCount = vi.fn(async () => 0);
vi.mock("@/app/(frame)/notifications/actions", () => ({ unreadCount: () => unreadCount() }));

function mainNav() {
  return screen.getByRole("navigation", { name: "Main" });
}

describe("Frame", () => {
  beforeEach(() => {
    pathname = "/seshes";
  });

  it("renders exactly the tabs it is given, in order", () => {
    render(<Frame tabs={["seshes", "mine", "me"]}>page</Frame>);

    const links = within(mainNav()).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Seshes", "My seshes", "Me"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/seshes", "/seshes/mine", "/me"]);
  });

  it("hides a tab it is not given rather than greying it", () => {
    render(<Frame tabs={["me"]}>page</Frame>);

    expect(within(mainNav()).getAllByRole("link")).toHaveLength(1);
    expect(within(mainNav()).queryByText("Seshes")).not.toBeInTheDocument();
    expect(within(mainNav()).queryByText("New")).not.toBeInTheDocument();
  });

  it.each([
    ["/seshes", "Seshes"],
    ["/seshes/0b8e5c1e-0000-4000-8000-000000000000", "Seshes"],
    ["/seshes/mine", "My seshes"],
    ["/seshes/new", "New"],
    ["/me", "Me"],
  ])("marks the tab for %s as the current page", (path, label) => {
    pathname = path;
    render(<Frame tabs={["seshes", "mine", "new", "me"]}>page</Frame>);

    const current = within(mainNav())
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual([label]);
  });

  it("marks no tab on a page that is not one", () => {
    pathname = "/verify";
    render(<Frame tabs={["me"]}>page</Frame>);

    expect(within(mainNav()).getByRole("link")).not.toHaveAttribute("aria-current");
  });

  it("puts the page in the main landmark, behind a skip link", () => {
    render(<Frame tabs={["me"]}>the page body</Frame>);

    const main = screen.getByRole("main");
    expect(main).toHaveTextContent("the page body");
    expect(main).toHaveAttribute("id", "content");
    expect(screen.getAllByRole("link")[0]).toHaveTextContent("Skip to content");
    expect(screen.getAllByRole("link")[0]).toHaveAttribute("href", "#content");
  });

  it("names the page in the header", () => {
    pathname = "/seshes/mine";
    render(<Frame tabs={["seshes", "mine", "me"]}>page</Frame>);

    expect(within(screen.getByRole("banner")).getByText("My seshes", { selector: "p" })).toBeInTheDocument();
  });

  it("offers a way back up from a page under a tab", () => {
    pathname = "/seshes/abc/edit";
    render(<Frame tabs={["seshes", "mine", "me"]}>page</Frame>);

    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/seshes/abc");
  });

  it("has no back link on a tab itself", () => {
    render(<Frame tabs={["seshes", "mine", "me"]}>page</Frame>);

    expect(screen.queryByRole("link", { name: "Back" })).not.toBeInTheDocument();
  });

  // Issue #69.
  it("draws the member's avatar on the Me tab, which keeps its name", () => {
    render(
      <Frame tabs={["seshes", "me"]} avatar={{ seed: "abc", memberId: "m-1", handle: "ryder", displayName: null }}>
        page
      </Frame>,
    );

    const me = within(mainNav()).getByRole("link", { name: "Me" });
    expect(me.querySelector("[data-avatar]")).not.toBeNull();
    const seshes = within(mainNav()).getByRole("link", { name: "Seshes" });
    expect(seshes.querySelector("[data-avatar]")).toBeNull();
  });

  // Issue #52.
  describe("bell", () => {
    it("shows the unread count it is given, and links to the feed", async () => {
      unreadCount.mockResolvedValue(3);
      render(<Frame tabs={["me"]} unread={3}>page</Frame>);

      const bell = screen.getByRole("link", { name: "Notifications, 3 unread" });
      expect(bell).toHaveAttribute("href", "/notifications");
      expect(bell).toHaveTextContent("3");
      await act(async () => {});
    });

    it("draws no number when nothing is unread", async () => {
      unreadCount.mockResolvedValue(0);
      render(<Frame tabs={["me"]} unread={0}>page</Frame>);
      await act(async () => {});

      const bell = screen.getByRole("link", { name: "Notifications" });
      expect(bell.querySelector("[data-count]")).toBeNull();
    });

    it("hides the bell when it is given none, and keeps the slot", () => {
      render(<Frame tabs={["me"]}>page</Frame>);

      expect(screen.queryByRole("link", { name: /Notifications/ })).not.toBeInTheDocument();
      expect(document.querySelector('[data-slot="bell"]')).not.toBeNull();
    });

    it("re-reads the count when the feed marks rows read", async () => {
      unreadCount.mockResolvedValue(2);
      render(<Frame tabs={["me"]} unread={2}>page</Frame>);
      await act(async () => {});

      unreadCount.mockResolvedValue(0);
      await act(async () => {
        fireEvent(window, new Event("m4w:notifications-seen"));
      });

      expect(screen.getByRole("link", { name: "Notifications" })).toBeInTheDocument();
    });
  });
});
