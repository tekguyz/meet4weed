// Takes the showcase screenshots from the live demo (DEMO-STANDARD.md >
// Showcase screenshots). Run it again after a screen in the set changes a lot.
//
//   npm run showcase
//   npm run showcase -- http://127.0.0.1:3000
//
// It opens the landing page and presses "Try the demo", in one fresh browser,
// so the data is the demo's invented cast. Each screen in light and dark,
// desktop 1440x900, English, demo banner and dev badge hidden. The PNGs go to
// `showcase/`, named for what they show and the theme. They change only when
// someone runs this; nothing else re-takes them.
//
// It drives the Edge or Chrome already on the laptop (playwright-core), so no
// browser is downloaded. Each run starts one demo visitor; the 7-day cleanup
// deletes it. The door allows 5 visitors an hour per IP.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

function fail(message) {
  console.error(`showcase: ${message}`);
  process.exit(1);
}

const site = (process.argv[2] ?? "https://meet4weed.vercel.app").replace(/\/$/, "");

const OUT = "showcase";
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const LOOK = { locale: "en-US", reducedMotion: "reduce" };

// Dark is the app's default, but each theme is set by the browser's colour
// scheme so the two runs are the same on any laptop.
const THEMES = ["light", "dark"];

const SESH = /^\/seshes\/[0-9a-f-]{36}$/;
const MEMBER = /^\/m\/[^/]+$/;

/**
 * The set. `open` is a path, or a list of link patterns to follow from
 * `/seshes`: at each page, the first link whose address matches. The demo
 * cast is fixed (supabase/demo-cast.sql), so "the first one" is the same
 * every run. `settle` waits for the map's tiles, which "networkidle" misses.
 */
const SHOTS = [
  { name: "seshes-desktop", open: "/seshes" },
  { name: "map-desktop", open: "/seshes?view=map", settle: 4000 },
  { name: "sesh-desktop", open: [SESH] },
  { name: "member-desktop", open: [SESH, MEMBER] },
];

// The demo banner has no hook of its own, only its label. `nextjs-portal` is
// the Next.js dev badge, for when the site is `next dev`.
const HIDE = "aside[aria-label='Demo'], nextjs-portal { display: none !important; }";

async function launch() {
  for (const channel of ["msedge", "chrome"]) {
    try {
      return await chromium.launch({ channel });
    } catch {
      // Not on this laptop: try the next one.
    }
  }
  fail("needs Microsoft Edge or Google Chrome installed.");
}

/** Presses "Try the demo"; returns the visitor's signed-in cookies. */
async function startDemo(browser) {
  const context = await browser.newContext({ ...DESKTOP, ...LOOK });
  const page = await context.newPage();
  await page.goto(site);
  await page.getByRole("button", { name: "Try the demo" }).first().click();
  await page.waitForURL((url) => url.pathname !== "/", { timeout: 60_000 });
  const landed = new URL(page.url()).pathname;
  if (landed !== "/seshes") fail(`the demo landed on ${landed}, not /seshes. Is the demo full or off?`);
  const session = await context.storageState();
  await context.close();
  return session;
}

/** The address of the first link on the page that matches. */
async function firstLink(page, pattern) {
  const hrefs = await page.locator("a[href]").evaluateAll((els) => els.map((el) => el.getAttribute("href")));
  const href = hrefs.find((h) => h && pattern.test(h));
  if (!href) fail(`no link matching ${pattern} on ${page.url()}. Did the demo's cast change?`);
  return href;
}

async function shoot(browser, session, shot, theme) {
  const context = await browser.newContext({ ...DESKTOP, ...LOOK, colorScheme: theme, storageState: session });
  const page = await context.newPage();
  if (typeof shot.open === "string") {
    await page.goto(site + shot.open);
  } else {
    await page.goto(site + "/seshes");
    for (const link of shot.open) await page.goto(new URL(await firstLink(page, link), site).href);
  }
  await page.waitForLoadState("networkidle");
  if (shot.settle) await page.waitForTimeout(shot.settle);
  await page.addStyleTag({ content: HIDE });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/${shot.name}-${theme}.png` });
  await context.close();
  console.log(`showcase: ${OUT}/${shot.name}-${theme}.png`);
}

mkdirSync(OUT, { recursive: true });
const browser = await launch();
try {
  const session = await startDemo(browser);
  for (const shot of SHOTS) for (const theme of THEMES) await shoot(browser, session, shot, theme);
} finally {
  await browser.close();
}
