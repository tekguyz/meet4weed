import { APP_NAME } from "@/lib/env";

/** The landing page's own lines (#97). The sign-in page's brand panel reuses
 *  them, so one edit reaches both and the panel never grows copy of its own. */

/** The three checks. `label` names each one in the map's legend. */
export const CHECKS = [
  {
    label: "Card",
    title: "Your card and face, captured live",
    body: "You photograph your card from Florida’s Office of Medical Marijuana Use (OMMU), then a photo of you holding it while you follow a prompt picked at random. An old photo will not match the prompt.",
  },
  {
    label: "Person",
    title: "A person approves every member",
    body: "Software reads the card to help, but it never approves anyone. A person looks at both photos and decides.",
  },
  {
    label: "Host",
    title: "The host approves every guest",
    body: "Until then, a sesh shows only a shaded circle about half a mile across, never the house. The host decides who comes in.",
  },
] as const;

export const PROMISES = [
  {
    title: "Never a sale",
    body: `${APP_NAME} is a place to meet. Nothing is sold through it, ever.`,
  },
  {
    title: "Your photos are deleted",
    body: "Card and face photos are deleted when the reviewer decides, and within 7 days at most.",
  },
  {
    title: "Your lock screen stays quiet",
    body: "A push notification names no member and no sesh.",
  },
] as const;
