import { describe, expect, it } from "vitest";
import { noCameraFound } from "@/lib/verification/camera";

/** Answers one question before the flow starts: is this a laptop with no
 *  camera? A wrong "yes" would turn a real phone away, so only a clear list
 *  with no camera in it counts. */
describe("noCameraFound", () => {
  it("says yes when the device lists a microphone and a speaker but no camera", () => {
    expect(noCameraFound([{ kind: "audioinput" }, { kind: "audiooutput" }])).toBe(true);
  });

  it("says no when there is a camera", () => {
    expect(noCameraFound([{ kind: "audioinput" }, { kind: "videoinput" }])).toBe(false);
  });

  /** Some browsers hide every device until the camera is allowed. An empty
   *  list is "cannot tell", and the camera step finds out for sure. */
  it("says no when the browser lists nothing at all", () => {
    expect(noCameraFound([])).toBe(false);
  });
});
