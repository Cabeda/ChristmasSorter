import { describe, expect, it } from "vitest";
import { ValidationError } from "./errors";
import { MAX_PARTICIPANTS, validateEvent } from "./validation";

function baseEvent(): Record<string, unknown> {
  return {
    name: "Amigo Secreto",
    date: "2026-12-25",
    giftPrice: "5",
    currency: "euro",
    participants: [
      { name: "A", email: "a@example.com" },
      { name: "B", email: "b@example.com" },
    ],
  };
}

function expectValidation(fn: () => unknown, message: string): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as Error).message).toBe(message);
    return;
  }
  throw new Error("Expected validateEvent to throw");
}

describe("validateEvent", () => {
  it("normalizes a valid event", () => {
    const event = validateEvent(baseEvent());
    expect(event).toEqual({
      name: "Amigo Secreto",
      date: "2026-12-25T00:00:00.000Z",
      giftPrice: "5",
      currency: "euro",
      participants: [
        { name: "A", email: "a@example.com" },
        { name: "B", email: "b@example.com" },
      ],
      exclusions: [],
      deduped: 0,
    });
  });

  it("defaults the currency to euro", () => {
    const body = baseEvent();
    delete body.currency;
    expect(validateEvent(body).currency).toBe("euro");
  });

  it("accepts a numeric gift price", () => {
    const body = baseEvent();
    body.giftPrice = 12.5;
    expect(validateEvent(body).giftPrice).toBe("12.5");
  });

  it("rejects a body that is not an object", () => {
    for (const body of [null, [], "text", 42]) {
      expectValidation(() => validateEvent(body), "Request body must be an object.");
    }
  });

  it("validates the event name", () => {
    expectValidation(
      () => validateEvent({ ...baseEvent(), name: 1 }),
      "Event name must be a string.",
    );
    expectValidation(() => validateEvent({ ...baseEvent(), name: "  " }), "Event name is required.");
    expectValidation(
      () => validateEvent({ ...baseEvent(), name: "x".repeat(201) }),
      "Event name is too long (max 200).",
    );
  });

  it("validates the date", () => {
    expectValidation(
      () => validateEvent({ ...baseEvent(), date: 20261225 }),
      "Event date must be an ISO date string.",
    );
    expectValidation(
      () => validateEvent({ ...baseEvent(), date: "not-a-date" }),
      "Event date is invalid.",
    );
  });

  it("validates the gift price", () => {
    expectValidation(
      () => validateEvent({ ...baseEvent(), giftPrice: true }),
      "Gift price must be a number.",
    );
    expectValidation(
      () => validateEvent({ ...baseEvent(), giftPrice: "  " }),
      "Gift price must be a number.",
    );
    expectValidation(
      () => validateEvent({ ...baseEvent(), giftPrice: "abc" }),
      "Gift price must be a number.",
    );
    expectValidation(
      () => validateEvent({ ...baseEvent(), giftPrice: "-1" }),
      "Gift price cannot be negative.",
    );
    expectValidation(
      () => validateEvent({ ...baseEvent(), giftPrice: "1000001" }),
      "Gift price cannot exceed 1000000.",
    );
  });

  it("validates the currency", () => {
    expectValidation(
      () => validateEvent({ ...baseEvent(), currency: 1 }),
      "Currency must be a string.",
    );
    expectValidation(
      () => validateEvent({ ...baseEvent(), currency: "  " }),
      "Currency is required.",
    );
    expectValidation(
      () => validateEvent({ ...baseEvent(), currency: "x".repeat(13) }),
      "Currency is too long (max 12).",
    );
  });

  it("validates the participant list", () => {
    expectValidation(
      () => validateEvent({ ...baseEvent(), participants: "nope" }),
      "Participants must be an array.",
    );
    expectValidation(
      () => validateEvent({ ...baseEvent(), participants: [{ name: "A", email: "a@example.com" }] }),
      "At least two participants are required.",
    );
    const tooMany = Array.from({ length: MAX_PARTICIPANTS + 1 }, (_, index) => ({
      name: `P${index}`,
      email: `p${index}@example.com`,
    }));
    expectValidation(
      () => validateEvent({ ...baseEvent(), participants: tooMany }),
      `At most ${MAX_PARTICIPANTS} participants are allowed.`,
    );
  });

  it("validates each participant", () => {
    expectValidation(
      () =>
        validateEvent({
          ...baseEvent(),
          participants: ["nope", { name: "B", email: "b@example.com" }],
        }),
      "Each participant must be an object.",
    );
    expectValidation(
      () =>
        validateEvent({
          ...baseEvent(),
          participants: [{ name: 1, email: "a@example.com" }, { name: "B", email: "b@example.com" }],
        }),
      "Participant name must be a string.",
    );
    expectValidation(
      () =>
        validateEvent({
          ...baseEvent(),
          participants: [{ name: "A", email: "a@example.com" }, { name: "B", email: 2 }],
        }),
      "Participant email must be a string.",
    );
    expectValidation(
      () =>
        validateEvent({
          ...baseEvent(),
          participants: [{ name: "A", email: "nope" }, { name: "B", email: "b@example.com" }],
        }),
      "Participant email is invalid: nope",
    );
  });

  it("deduplicates participants by email, case-insensitively", () => {
    const event = validateEvent({
      ...baseEvent(),
      participants: [
        { name: "A", email: "A@example.com" },
        { name: "A again", email: "a@example.com" },
        { name: "B", email: "b@example.com" },
      ],
    });
    expect(event.participants).toHaveLength(2);
    expect(event.deduped).toBe(1);
    expect(event.participants[0]!.name).toBe("A");
  });

  it("rejects duplicates that leave fewer than two participants", () => {
    expectValidation(
      () =>
        validateEvent({
          ...baseEvent(),
          participants: [
            { name: "A", email: "a@example.com" },
            { name: "A again", email: "a@example.com" },
          ],
        }),
      "At least two participants with distinct emails are required.",
    );
  });

  it("validates the exclusions shape", () => {
    expectValidation(
      () => validateEvent({ ...baseEvent(), exclusions: "nope" }),
      "Exclusions must be an array of email pairs.",
    );
    expectValidation(
      () => validateEvent({ ...baseEvent(), exclusions: ["nope"] }),
      "Each exclusion must be a pair of emails.",
    );
    expectValidation(
      () => validateEvent({ ...baseEvent(), exclusions: [["a@example.com"]] }),
      "Each exclusion must be a pair of emails.",
    );
    expectValidation(
      () => validateEvent({ ...baseEvent(), exclusions: [["a@example.com", "b@example.com", "c@example.com"]] }),
      "Each exclusion must be a pair of emails.",
    );
  });

  it("validates exclusion emails", () => {
    expectValidation(
      () => validateEvent({ ...baseEvent(), exclusions: [[1, "b@example.com"]] }),
      "Exclusion email must be a string.",
    );
    expectValidation(
      () => validateEvent({ ...baseEvent(), exclusions: [["  ", "b@example.com"]] }),
      "Exclusion email is required.",
    );
    expectValidation(
      () => validateEvent({ ...baseEvent(), exclusions: [["x".repeat(255), "b@example.com"]] }),
      "Exclusion email is too long (max 254).",
    );
    expectValidation(
      () => validateEvent({ ...baseEvent(), exclusions: [["a@example.com", "a@example.com"]] }),
      "An exclusion cannot pair a participant with themselves.",
    );
    expectValidation(
      () => validateEvent({ ...baseEvent(), exclusions: [["nobody@example.com", "a@example.com"]] }),
      "An exclusion references an email that is not a participant.",
    );
    expectValidation(
      () => validateEvent({ ...baseEvent(), exclusions: [["a@example.com", "nobody@example.com"]] }),
      "An exclusion references an email that is not a participant.",
    );
  });

  it("normalizes and deduplicates exclusions in both orders", () => {
    const event = validateEvent({
      ...baseEvent(),
      exclusions: [
        ["a@example.com", "b@example.com"],
        ["B@example.com", "A@example.com"],
      ],
    });
    expect(event.exclusions).toEqual([["a@example.com", "b@example.com"]]);
  });
});
