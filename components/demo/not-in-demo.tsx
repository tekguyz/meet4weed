import { Banner } from "@/components/ui/banner";
import { NOT_IN_THE_DEMO } from "@/lib/demo/door";

/**
 * What a visitor sees in place of something the demo does not allow (#39).
 * The feature is still there to look at in the list; pressing into it says
 * why it stops, so a refusal reads as a demo boundary rather than a bug. The
 * database or the action refuses it too — this is only the sentence.
 */
export function NotInDemo() {
  return <Banner>{NOT_IN_THE_DEMO}</Banner>;
}
