import { NotFoundScreen } from "@/components/fallback/fallback-screens";

export const metadata = { title: "Page not found" };

/** Any URL that matches no route, and notFound() outside the Frame. */
export default function NotFound() {
  return <NotFoundScreen />;
}
