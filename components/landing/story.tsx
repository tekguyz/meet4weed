"use client";

import { useEffect, useRef, useState } from "react";
import { CheckLegend, LandingMap } from "./landing-map";

/**
 * The map beside the words (#97). On a phone the map and its legend pin to the
 * top while the headline and the steps scroll under them; from `md` they pin
 * beside the words.
 * Each `[data-story-step]` in `children` that has reached the reading line
 * moves the map on one step: the checks settle, then the pin drops.
 *
 * The map starts at step 0. Without JavaScript the page's <noscript> style
 * shows every layer. Under reduced motion the steps land without moving.
 */
/** `checks` names the checks for the legend, in the order the steps tell
 *  them. The step after the last check drops the pin. */
export function Story({ checks, children }: { checks: readonly string[]; children: React.ReactNode }) {
  const words = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const steps = Array.from(words.current?.querySelectorAll("[data-story-step]") ?? []);
    let frame = 0;

    function measure() {
      frame = 0;
      // A step counts once its top passes the middle of the screen, so on a
      // tall desktop the first check does not settle before anyone reads it.
      const line = window.innerHeight * 0.5;
      setStep(steps.filter((el) => el.getBoundingClientRect().top < line).length);
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(measure);
    }

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div data-story className="md:grid md:grid-cols-2 md:gap-12">
      <div className="sticky top-0 z-10 flex flex-col bg-bg md:top-8 md:self-start">
        <div className="h-[32svh] max-h-72 min-h-40 md:h-[min(72svh,36rem)] md:max-h-none">
          <LandingMap step={step} pinAt={checks.length + 1} />
        </div>
        <CheckLegend checks={checks} step={step} />
      </div>
      <div ref={words}>{children}</div>
    </div>
  );
}
