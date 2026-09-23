import pkg from "@/package.json";

/** The About line on Me (issue #65). One number a member can quote when they
 *  report a problem. Read at build time; only `version` is used. */
export const APP_VERSION: string = pkg.version;
