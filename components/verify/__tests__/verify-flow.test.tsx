import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ cardProblems: [] as string[] }));

vi.mock("@/components/verify/camera-capture", () => ({
  CameraCapture: ({ onCapture }: { onCapture: (c: HTMLCanvasElement) => void }) => (
    <button type="button" onClick={() => onCapture(document.createElement("canvas"))}>
      mock shutter
    </button>
  ),
}));
vi.mock("@/lib/verification/face-detector", () => ({ countFaces: async () => 1 }));
vi.mock("@/lib/verification/prechecks", async (original) => ({
  ...(await original<typeof import("@/lib/verification/prechecks")>()),
  checkCardPhoto: () => mocks.cardProblems,
  checkFacePhoto: () => [],
}));
vi.mock("@/lib/verification/resize", () => ({
  toJpeg: async () => new Blob(["jpeg"], { type: "image/jpeg" }),
  drawScaled: () => document.createElement("canvas"),
  fitWithin: (w: number, h: number) => ({ width: w, height: h }),
}));
vi.mock("@/app/(frame)/verify/actions", () => ({
  issueFaceChallenge: async () => ({ ok: true, challenge: "Raise your eyebrows", token: "t0ken" }),
}));

import { VerifyFlow } from "@/components/verify/verify-flow";
import { useVerifyFlow } from "@/lib/verification/flow-store";
import { RETENTION_STATEMENT } from "@/lib/verification/messages";

beforeEach(() => {
  useVerifyFlow.getState().reset();
  mocks.cardProblems = [];
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
  })) as never;
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

async function reachCardStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Start" }));
  await user.type(screen.getByLabelText("Patient ID"), "P000-TEST-0001");
  await user.type(screen.getByLabelText("Card expiry date"), "2027-06-30");
  await user.click(screen.getByRole("button", { name: "Next" }));
}

describe("VerifyFlow", () => {
  /** A laptop with no camera is told before typing anything, not after. */
  it("sends a member with no camera to their phone before they start", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { enumerateDevices: async () => [{ kind: "audioinput" }, { kind: "audiooutput" }] },
    });
    try {
      render(<VerifyFlow today="2026-09-17" />);

      expect(await screen.findByText(/open this page on your phone/i)).toBeInTheDocument();
      expect(screen.getByText(`${window.location.origin}/verify`)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Start" })).not.toBeInTheDocument();
    } finally {
      Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
    }
  });

  it("states the retention promise before the camera opens", () => {
    render(<VerifyFlow today="2026-09-17" />);
    expect(screen.getByText(RETENTION_STATEMENT)).toBeInTheDocument();
  });

  it("upper-cases the patient ID as it is typed", async () => {
    const user = userEvent.setup();
    render(<VerifyFlow today="2026-09-17" />);
    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.type(screen.getByLabelText("Patient ID"), "p000-test-0001");
    expect(screen.getByLabelText("Patient ID")).toHaveValue("P000-TEST-0001");
  });

  it("refuses an expiry date that has already passed", async () => {
    const user = userEvent.setup();
    render(<VerifyFlow today="2026-09-17" />);
    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.type(screen.getByLabelText("Patient ID"), "P000-TEST-0001");
    await user.type(screen.getByLabelText("Card expiry date"), "2026-09-16");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/passed/);
  });

  it("shows the photo it took, with Use it and Retake", async () => {
    const user = userEvent.setup();
    render(<VerifyFlow today="2026-09-17" />);
    await reachCardStep(user);

    await user.click(screen.getByRole("button", { name: "mock shutter" }));
    expect(screen.getByRole("img", { name: "The photo you took" })).toHaveAttribute("src", "blob:preview");
    expect(screen.queryByRole("button", { name: "mock shutter" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Retake" }));
    expect(screen.queryByRole("img", { name: "The photo you took" })).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
    await user.click(screen.getByRole("button", { name: "mock shutter" }));
    await user.click(screen.getByRole("button", { name: "Use it" }));
    expect(screen.getByRole("heading", { name: "Photo of you holding the card" })).toBeInTheDocument();
  });

  it("names the pre-check problem, and offers the photo anyway after three failures", async () => {
    mocks.cardProblems = ["glare"];
    const user = userEvent.setup();
    render(<VerifyFlow today="2026-09-17" />);
    await reachCardStep(user);

    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByRole("button", { name: "mock shutter" }));
      expect(screen.getByRole("alert")).toHaveTextContent(/glare/);
      expect(screen.queryByRole("button", { name: /Use it/ })).toBeNull();
      await user.click(screen.getByRole("button", { name: "Retake" }));
    }

    await user.click(screen.getByRole("button", { name: "mock shutter" }));
    expect(screen.getByRole("button", { name: "Use it anyway" })).toBeInTheDocument();
  });

  it("shows the server's challenge on the face step and sends everything in one POST", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<VerifyFlow today="2026-09-17" />);
    await reachCardStep(user);

    await user.click(screen.getByRole("button", { name: "mock shutter" }));
    await user.click(screen.getByRole("button", { name: "Use it" }));
    expect(await screen.findByText("Raise your eyebrows")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "mock shutter" }));
    await user.click(screen.getByRole("button", { name: "Use it" }));
    await user.click(screen.getByRole("button", { name: "Send for review" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/verification");
    const body = init.body as FormData;
    expect(body.get("patientId")).toBe("P000-TEST-0001");
    expect(body.get("cardExpiresOn")).toBe("2027-06-30");
    expect(body.get("challengeToken")).toBe("t0ken");
    expect(body.get("card")).toBeInstanceOf(Blob);
    expect(body.get("face")).toBeInstanceOf(Blob);
    expect(await screen.findByText(/A person on our team will check it/)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("explains a refused submission in plain language", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, error: "member_limit" }), { status: 429 })));
    useVerifyFlow.setState({
      step: "review",
      patientId: "P000-TEST-0001",
      cardExpiresOn: "2027-06-30",
      card: { blob: new Blob(["c"]), url: "blob:c" },
      face: { blob: new Blob(["f"]), url: "blob:f" },
      challenge: { text: "x", token: "t" },
    });
    const user = userEvent.setup();
    render(<VerifyFlow today="2026-09-17" />);
    await user.click(screen.getByRole("button", { name: "Send for review" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You have tried 3 times today");
    vi.unstubAllGlobals();
  });
});
