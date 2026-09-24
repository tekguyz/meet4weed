"use client";

import { useCallback, useEffect, useState } from "react";
import { issueFaceChallenge } from "@/app/(frame)/verify/actions";
import { CameraCapture } from "@/components/verify/camera-capture";
import { PhoneHandOff } from "@/components/verify/phone-hand-off";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { noCameraFound } from "@/lib/verification/camera";
import { countFaces } from "@/lib/verification/face-detector";
import { useVerifyFlow, type Shot } from "@/lib/verification/flow-store";
import { PRECHECK_TEXT, RETENTION_STATEMENT, SUBMISSION_TEXT } from "@/lib/verification/messages";
import { checkCardPhoto, checkFacePhoto, type PrecheckProblem } from "@/lib/verification/prechecks";
import { toJpeg } from "@/lib/verification/resize";
import type { SubmissionError } from "@/lib/verification/submit";

const ANYWAY_AFTER = 3;
// Both hands are busy on the face step: one holds the phone, one the card.
const FACE_TIMER_SECONDS = 3;

/** One job per screen (spec §7): intro, typed details, card, face, review. */
export function VerifyFlow({ today }: { today: string }) {
  const flow = useVerifyFlow();

  switch (flow.step) {
    case "intro":
      return <Intro />;
    case "details":
      return <Details today={today} />;
    case "card":
      return <Capture kind="card" />;
    case "face":
      return <Capture kind="face" />;
    case "review":
      return <Review />;
    case "sent":
      return (
        <Banner tone="success">
          Sent. A person on our team will check it and you will see the result here. Your photos are deleted as soon as
          they decide.
        </Banner>
      );
  }
}

function Intro() {
  const go = useVerifyFlow((s) => s.go);
  const [cameraless, setCameraless] = useState(false);

  // Ask before any typing. When the browser cannot tell, Start stays and the
  // camera step catches a missing camera instead.
  useEffect(() => {
    let live = true;
    navigator.mediaDevices
      ?.enumerateDevices?.()
      .then((devices) => live && setCameraless(noCameraFound(devices)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (cameraless) return <PhoneHandOff />;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">
        You will type two things from your card, take a photo of the card, then take one photo of yourself holding it.
      </p>
      <p className="text-sm text-ink">{RETENTION_STATEMENT}</p>
      <Button type="button" onClick={() => go("details")}>Start</Button>
    </div>
  );
}

function Details({ today }: { today: string }) {
  const { patientId, cardExpiresOn, setDetails, go } = useVerifyFlow();
  const [id, setId] = useState(patientId);
  const [expiry, setExpiry] = useState(cardExpiresOn);
  const [message, setMessage] = useState<string | null>(null);

  function next(event: React.FormEvent) {
    event.preventDefault();
    if (!id.trim()) return setMessage("Type the patient ID printed on your card.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return setMessage("Choose the expiry date printed on your card.");
    if (expiry < today) return setMessage("That date has passed. Renew your card with the state first.");
    setDetails(id.trim(), expiry);
    go("card");
  }

  return (
    <form onSubmit={next} className="flex flex-col gap-4">
      <Input
        label="Patient ID"
        value={id}
        onChange={(e) => setId(e.target.value.toUpperCase())}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        required
      />
      <Input label="Card expiry date" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} required />
      <Button type="submit">Next</Button>
      {message ? <p role="alert" className="text-sm text-danger">{message}</p> : null}
    </form>
  );
}

function Capture({ kind }: { kind: "card" | "face" }) {
  const { failures, failedCheck, setShot, go, challenge, setChallenge } = useVerifyFlow();
  // The photo just taken, shown back to the member before it is used (phone-test finding 2).
  const [pending, setPending] = useState<{ shot: Shot; problems: PrecheckProblem[] } | null>(null);

  // The challenge is fetched when the face step opens, not earlier (spec §4.1 step 5).
  useEffect(() => {
    if (kind !== "face" || challenge) return;
    let live = true;
    void issueFaceChallenge().then((r) => {
      if (live && r.ok) setChallenge({ text: r.challenge, token: r.token });
    });
    return () => {
      live = false;
    };
  }, [kind, challenge, setChallenge]);

  // The same checks guide the live viewfinder and gate the full-size photo.
  const runChecks = useCallback(
    async (canvas: HTMLCanvasElement, live: boolean) => {
      const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
      return kind === "card" ? checkCardPhoto(pixels) : checkFacePhoto(pixels, await countFaces(canvas, { quiet: live }));
    },
    [kind],
  );
  const liveCheck = useCallback((frame: HTMLCanvasElement) => runChecks(frame, true), [runChecks]);

  async function checked(canvas: HTMLCanvasElement) {
    const problems = await runChecks(canvas, false);
    if (problems.length) failedCheck(kind);
    const blob = await toJpeg(canvas);
    setPending({ shot: { blob, url: URL.createObjectURL(blob) }, problems });
  }

  function accept() {
    if (!pending) return;
    setShot(kind, pending.shot);
    setPending(null);
    go(kind === "card" ? "face" : "review");
  }

  function retake() {
    if (pending) URL.revokeObjectURL(pending.shot.url);
    setPending(null);
  }

  const heading = kind === "card" ? "Photo of your card" : "Photo of you holding the card";
  const failedTooOften = failures[kind] >= ANYWAY_AFTER;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl">{heading}</h2>
      {kind === "card" ? (
        <p className="text-sm text-ink-muted">Put the card on a dark surface and fit it inside the frame.</p>
      ) : challenge ? (
        <p className="text-sm text-ink">
          Hold the card beside your face, and: <strong className="text-primary">{challenge.text}</strong>. Tap the
          photo, and it is taken 3 seconds later.
        </p>
      ) : (
        <p className="text-sm text-ink-muted">Getting your pose…</p>
      )}

      {kind === "card" || challenge ? (
        // Hidden, not unmounted, while previewing: Retake then needs no camera restart.
        <div hidden={pending !== null}>
          <CameraCapture
            facing={kind === "card" ? "environment" : "user"}
            guide={kind}
            timerSeconds={kind === "face" ? FACE_TIMER_SECONDS : undefined}
            check={liveCheck}
            active={pending === null}
            onCapture={checked}
          />
        </div>
      ) : null}

      {pending ? (
        <div className="flex flex-col gap-4">
          <img src={pending.shot.url} alt="The photo you took" className="mx-auto max-h-[60dvh] rounded-card" />
          {pending.problems.length > 0 ? (
            <p role="alert" className="text-sm text-danger">
              {pending.problems.map((p) => PRECHECK_TEXT[p]).join(" ")}
            </p>
          ) : null}
          {pending.problems.length === 0 ? (
            <Button type="button" onClick={accept}>Use it</Button>
          ) : failedTooOften ? (
            <Button type="button" variant="quiet" onClick={accept}>Use it anyway</Button>
          ) : null}
          <Button type="button" variant={pending.problems.length === 0 ? "quiet" : "primary"} onClick={retake}>
            Retake
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Review() {
  const { patientId, cardExpiresOn, card, face, challenge, go, setChallenge } = useVerifyFlow();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function send() {
    if (!card || !face || !challenge) return;
    setSending(true);
    setMessage(null);
    const body = new FormData();
    body.set("patientId", patientId);
    body.set("cardExpiresOn", cardExpiresOn);
    body.set("challengeToken", challenge.token);
    body.set("card", card.blob, "card.jpg");
    body.set("face", face.blob, "face.jpg");

    try {
      const response = await fetch("/api/verification", { method: "POST", body });
      const result = (await response.json()) as { ok: true } | { ok: false; error: SubmissionError };
      if (result.ok) return go("sent");
      if (result.error === "challenge_expired") {
        setChallenge(null);
        return go("face");
      }
      setMessage(SUBMISSION_TEXT[result.error]);
    } catch {
      setMessage("You seem to be offline. Nothing was sent. Try again when you are connected.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl">Check and send</h2>
      <div className="grid grid-cols-2 gap-2">
        {card ? <img src={card.url} alt="Your card" className="rounded-control" /> : null}
        {face ? <img src={face.url} alt="You holding your card" className="rounded-control" /> : null}
      </div>
      <p className="text-sm text-ink-muted">Patient ID {patientId} · expires {cardExpiresOn}</p>
      <Button type="button" onClick={send} disabled={sending}>{sending ? "Sending…" : "Send for review"}</Button>
      <Button type="button" variant="quiet" onClick={() => go("card")}>Retake photos</Button>
      {message ? <p role="alert" className="text-sm text-danger">{message}</p> : null}
    </div>
  );
}
