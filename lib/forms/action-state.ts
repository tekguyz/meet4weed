/** What a server action hands back to a form.
 *
 *  Lifted out of app/onboarding/actions.ts in Plan 03 (issue #3) so the sesh
 *  actions share one shape instead of each redeclaring it. There is nothing
 *  server-side in here — it is a type, erased at build — so client components
 *  import it directly and it needs no `server-only`.
 *
 *  The admin decision form keeps its own `DecideState`. That one carries a
 *  message and nothing else, and widening it would change admin behaviour.
 */
export type ActionState = {
  ok: boolean;
  message: string;
  /** Keyed by the form field name, so a form can show the message under the
   *  field that caused it rather than only at the top. */
  fieldErrors?: Record<string, string>;
};
