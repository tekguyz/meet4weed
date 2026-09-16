/** Only same-origin paths, so a crafted `?next=` cannot bounce a freshly
 *  signed-in member to another site. `//host` and `/\host` are both read by
 *  browsers as a protocol-relative URL, so both are refused. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
