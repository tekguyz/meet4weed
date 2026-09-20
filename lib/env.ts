/** Single source for values that appear in copy, metadata and email subjects.
 *  Hard-coding the product name in a dozen files is how a rename goes wrong. */
export const APP_NAME = "Meet4Weed";
export const APP_TAGLINE = "A private circle for verified Florida patients.";

/** Where the app lives. Nominatim's usage policy wants a way to reach whoever
 *  is calling and accepts a website, so this goes in the User-Agent — never
 *  the owner's email address. */
export const APP_URL = "https://meet4weed.vercel.app";
