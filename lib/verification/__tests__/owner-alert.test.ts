/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { sendOwnerAlert } from "@/lib/verification/owner-alert";

describe("sendOwnerAlert", () => {
  it("sends a link and no card details", async () => {
    const send = vi.fn(async () => ({ data: { id: "e1" }, error: null }));
    await sendOwnerAlert({ emails: { send } }, "owner@example.com", "https://m4w.example/admin/verifications");

    const message = (send.mock.calls[0] as unknown[])[0] as { from: string; to: string; subject: string; text: string };
    expect(message.from).toBe("Meet4Weed <no-reply@tekguyz.com>");
    expect(message.to).toBe("owner@example.com");
    expect(message.text).toContain("https://m4w.example/admin/verifications");
    // Spec §11: mailing a card photo or its details would put them in an inbox for good.
    expect(JSON.stringify(message)).not.toMatch(/patient|P000|attachment/i);
  });

  it("throws when Resend refuses, so the caller can log it", async () => {
    const send = vi.fn(async () => ({ data: null, error: { message: "domain not verified" } }));
    await expect(sendOwnerAlert({ emails: { send } }, "o@example.com", "https://x")).rejects.toThrow();
  });
});
