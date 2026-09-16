import { create } from "zustand";

/** Client-side state for the capture stepper (spec §2: zustand for the camera
 *  flow). Photos stay in memory as Blobs and are never written to storage on
 *  the phone. */

export type Step = "intro" | "details" | "card" | "face" | "review" | "sent";
export type Shot = { blob: Blob; url: string };

type State = {
  step: Step;
  patientId: string;
  cardExpiresOn: string;
  card: Shot | null;
  face: Shot | null;
  challenge: { text: string; token: string } | null;
  failures: { card: number; face: number };
  go: (step: Step) => void;
  setDetails: (patientId: string, cardExpiresOn: string) => void;
  setShot: (kind: "card" | "face", shot: Shot | null) => void;
  setChallenge: (challenge: { text: string; token: string } | null) => void;
  failedCheck: (kind: "card" | "face") => void;
  reset: () => void;
};

const initial = {
  step: "intro" as Step,
  patientId: "",
  cardExpiresOn: "",
  card: null,
  face: null,
  challenge: null,
  failures: { card: 0, face: 0 },
};

export const useVerifyFlow = create<State>((set) => ({
  ...initial,
  go: (step) => set({ step }),
  setDetails: (patientId, cardExpiresOn) => set({ patientId, cardExpiresOn }),
  setShot: (kind, shot) =>
    set((s) => {
      const old = s[kind];
      if (old && old.url !== shot?.url) URL.revokeObjectURL(old.url);
      return { [kind]: shot } as Pick<State, "card" | "face">;
    }),
  setChallenge: (challenge) => set({ challenge }),
  failedCheck: (kind) => set((s) => ({ failures: { ...s.failures, [kind]: s.failures[kind] + 1 } })),
  reset: () => set(initial),
}));
