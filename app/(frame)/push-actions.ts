"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DeviceSubscription, forgetDevice, saveDevice } from "@/lib/notify/push-subscriptions";

/**
 * Saving and forgetting this device's push subscription (#56). The member is
 * read from their own session first; only then does the admin client write,
 * and only for them. A member cannot do either through the Data API — see
 * supabase/migrations/…_push_subscriptions.sql.
 *
 * The answer is a bare yes or no. Nothing read from the table is returned:
 * "are notifications on?" is the device's question, not the server's.
 */

async function memberId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function saveThisDevice(subscription: unknown): Promise<{ ok: boolean }> {
  const device = DeviceSubscription.safeParse(subscription);
  if (!device.success) return { ok: false };
  const id = await memberId();
  if (!id) return { ok: false };
  try {
    await saveDevice(createAdminClient(), id, device.data, (await headers()).get("user-agent"));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

const endpoint = z.url().max(1024);

export async function forgetThisDevice(value: unknown): Promise<{ ok: boolean }> {
  const parsed = endpoint.safeParse(value);
  if (!parsed.success) return { ok: false };
  const id = await memberId();
  if (!id) return { ok: false };
  try {
    await forgetDevice(createAdminClient(), id, parsed.data);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
