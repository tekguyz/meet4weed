/** Single source for values that appear in copy, metadata and email subjects.
 *  Hard-coding the product name in a dozen files is how a rename goes wrong. */
export const APP_NAME = "Meet4Weed";
/** Also the login page's one line on what the app is and who it is for (#68). */
export const APP_TAGLINE =
  "A private place for Florida medical cannabis patients, 21 and over, to find seshes near them.";

/** Where the app lives. Nominatim's usage policy wants a way to reach whoever
 *  is calling and accepts a website, so this goes in the User-Agent — never
 *  the owner's email address. */
export const APP_URL = "https://meet4weed.vercel.app";
