import { LoadingScreen } from "@/components/fallback/fallback-screens";

/** Inside the Frame: the header and tabs stay put while the page loads. */
export default function Loading() {
  return <LoadingScreen framed />;
}
