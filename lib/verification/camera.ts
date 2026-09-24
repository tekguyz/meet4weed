/**
 * Is this a device with no camera — a laptop, usually? Checked before the
 * flow starts, so the member is sent to their phone before typing anything.
 *
 * Only a list that names devices but no camera counts. Some browsers list
 * nothing until the camera is allowed, and a wrong "no camera" would turn a
 * real phone away. When this cannot tell, the camera step finds out for sure.
 */
export function noCameraFound(devices: readonly Pick<MediaDeviceInfo, "kind">[]): boolean {
  return devices.length > 0 && !devices.some((device) => device.kind === "videoinput");
}
