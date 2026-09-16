import { describe, expect, it } from "vitest";
import { handleSchema, profileInputSchema } from "@/lib/profiles/schema";

describe("handleSchema", () => {
  it("accepts a plain lowercase handle", () => {
    expect(handleSchema.parse("ryder_420")).toBe("ryder_420");
  });

  it("lowercases what the user typed, so Ryder and ryder cannot both exist", () => {
    expect(handleSchema.parse("Ryder")).toBe("ryder");
  });

  it("rejects a handle that is too short", () => {
    expect(() => handleSchema.parse("ab")).toThrow();
  });

  it("rejects punctuation that would break a URL", () => {
    expect(() => handleSchema.parse("ryder.420")).toThrow();
  });

  it("rejects the reserved member_ prefix the signup trigger uses", () => {
    expect(() => handleSchema.parse("member_abc123")).toThrow();
  });
});

describe("profileInputSchema", () => {
  it("accepts a filled-in profile", () => {
    const parsed = profileInputSchema.parse({
      handle: "ryder",
      displayName: "Ryder",
      bio: "Indica after 8pm.",
      city: "Wilton Manors",
      strainPrefs: ["indica", "hybrid"],
      methodPrefs: ["flower"],
      vibeTags: ["vinyl", "board games"],
    });
    expect(parsed.strainPrefs).toEqual(["indica", "hybrid"]);
  });

  it("defaults the optional list fields to empty", () => {
    const parsed = profileInputSchema.parse({ handle: "ryder" });
    expect(parsed.strainPrefs).toEqual([]);
    expect(parsed.vibeTags).toEqual([]);
  });

  it("rejects a bio longer than the column allows", () => {
    expect(() => profileInputSchema.parse({ handle: "ryder", bio: "x".repeat(281) })).toThrow();
  });

  it("rejects a display name longer than the column allows", () => {
    expect(() =>
      profileInputSchema.parse({ handle: "ryder", displayName: "x".repeat(41) }),
    ).toThrow();
  });

  it("rejects more vibe tags than the column allows", () => {
    const nine = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
    expect(() => profileInputSchema.parse({ handle: "ryder", vibeTags: nine })).toThrow();
  });

  it("rejects a strain type the database enum does not have", () => {
    expect(() => profileInputSchema.parse({ handle: "ryder", strainPrefs: ["sublingual"] })).toThrow();
  });
});
