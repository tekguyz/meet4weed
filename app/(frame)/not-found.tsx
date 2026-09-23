import { NotFoundScreen } from "@/components/fallback/fallback-screens";

export const metadata = { title: "Page not found" };

/** notFound() from a signed-in page — a cancelled sesh — keeps the Frame. */
export default function NotFound() {
  return <NotFoundScreen />;
}
