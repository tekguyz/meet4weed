import { BlockedList } from "@/components/member/blocked-list";
import { getMyBlocks } from "@/lib/member/blocks";
import { SettingsColumn } from "../settings-column";

export const metadata = { title: "Blocked members" };

export default async function BlockedPage() {
  const blocks = await getMyBlocks();

  return (
    <SettingsColumn
      intro={
        blocks.length > 0 ? "They can’t see you, and you can’t see them. They were never told." : undefined
      }
    >
      <BlockedList blocks={blocks} />
    </SettingsColumn>
  );
}
