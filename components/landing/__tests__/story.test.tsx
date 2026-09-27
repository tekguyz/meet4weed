import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Story } from "@/components/landing/story";

/** Issue #97. As each step reaches the middle of the screen, the map moves on:
 *  the three checks fill in, then the pin drops. */
describe("the landing story", () => {
  // Where each step's top sits on screen; a test moves them to "scroll".
  let tops: number[];
  // Animation frames run later, as in a browser; scrollTo runs them.
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    frames = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => frames.push(cb));
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  });

  afterEach(() => vi.restoreAllMocks());

  function renderStory() {
    const view = render(
      <Story checks={["Card", "Person", "Host"]}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} data-story-step ref={(el) => {
            if (el) el.getBoundingClientRect = () => ({ top: tops[i] }) as DOMRect;
          }} />
        ))}
      </Story>,
    );
    const layers = () => ({
      pin: view.container.querySelector(".landing-pin")!.getAttribute("data-on"),
      checks: [...view.container.querySelectorAll(".landing-check")].map((el) => el.getAttribute("data-on")),
    });
    return { layers };
  }

  function scrollTo(next: number[]) {
    tops = next;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      for (const frame of frames.splice(0)) frame(0);
    });
  }

  it("starts with nothing checked and no pin", () => {
    tops = [900, 1300, 1700, 2100];
    const { layers } = renderStory();

    expect(layers()).toEqual({ pin: "false", checks: ["false", "false", "false"] });
  });

  it("fills in each check as its step reaches mid-screen", () => {
    tops = [900, 1300, 1700, 2100];
    const { layers } = renderStory();

    scrollTo([300, 700, 1100, 1500]);

    expect(layers()).toEqual({ pin: "false", checks: ["true", "false", "false"] });
  });

  it("drops the pin only after the last check", () => {
    tops = [900, 1300, 1700, 2100];
    const { layers } = renderStory();

    scrollTo([-600, -200, 200, 600]);
    expect(layers()).toEqual({ pin: "false", checks: ["true", "true", "true"] });

    scrollTo([-900, -500, -100, 300]);
    expect(layers()).toEqual({ pin: "true", checks: ["true", "true", "true"] });
  });

  it("names the checks in the legend", () => {
    tops = [900, 1300, 1700, 2100];
    const { container } = render(<Story checks={["Card", "Person", "Host"]}>{null}</Story>);

    expect(container.querySelector("ol")).toHaveTextContent("CardPersonHost");
  });
});
