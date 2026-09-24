import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "@/components/member/avatar";

const MEMBER = "7c1d2e3f-0000-4000-8000-000000000001";

function markup(props: Partial<Parameters<typeof Avatar>[0]> = {}) {
  const { container } = render(
    <Avatar seed={null} memberId={MEMBER} handle="ryder" displayName={null} {...props} />,
  );
  return container.innerHTML;
}

describe("Avatar (issue #69)", () => {
  it("draws the same mark for a null seed as for a seed equal to the member id", () => {
    expect(markup({ seed: null })).toBe(markup({ seed: MEMBER }));
  });

  it("draws the same mark every time for the same seed", () => {
    expect(markup({ seed: "abc" })).toBe(markup({ seed: "abc" }));
  });

  it("draws different marks for different seeds", () => {
    const looks = new Set(Array.from({ length: 20 }, (_, i) => markup({ seed: `seed-${i}` })));
    expect(looks.size).toBeGreaterThan(5);
  });

  it("puts the handle's first letter on the mark when there is no display name", () => {
    const { container } = render(
      <Avatar seed={null} memberId={MEMBER} handle="ryder" displayName={null} />,
    );
    expect(container).toHaveTextContent(/^R$/);
  });

  it("uses the first letters of the first two words of the display name", () => {
    const { container } = render(
      <Avatar seed={null} memberId={MEMBER} handle="ryder" displayName="mary jane watson" />,
    );
    expect(container).toHaveTextContent(/^MJ$/);
  });

  it("is decorative: the handle always sits beside it", () => {
    const { container } = render(
      <Avatar seed={null} memberId={MEMBER} handle="ryder" displayName={null} />,
    );
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("paints with token classes only — no hex, no oklch()", () => {
    for (let i = 0; i < 20; i++) {
      const html = markup({ seed: `seed-${i}` });
      expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(html).not.toMatch(/oklch\(|rgb\(|hsl\(/i);
    }
  });
});
