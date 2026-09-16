"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

function apply(theme: Theme) {
  const root = document.documentElement;
  const wantsLight =
    theme === "light" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: light)").matches);
  root.classList.toggle("light", wantsLight);
}

export function ThemeToggle() {
  // Starts as "system" on the server and on first client render, so the markup
  // matches. The effect then reads the real stored choice.
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") setTheme(stored);
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    try {
      if (next === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {
      // Private mode blocks writes. The class still applies for this session.
    }
    apply(next);
  }

  const options: Theme[] = ["dark", "light", "system"];

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className="inline-flex gap-1 rounded-control bg-surface-2 p-1"
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={theme === option}
          onClick={() => choose(option)}
          className={
            theme === option
              ? "rounded-control bg-primary px-3 py-1.5 text-sm font-semibold capitalize text-on-primary"
              : "rounded-control px-3 py-1.5 text-sm capitalize text-ink-muted hover:text-ink"
          }
        >
          {option}
        </button>
      ))}
    </div>
  );
}
