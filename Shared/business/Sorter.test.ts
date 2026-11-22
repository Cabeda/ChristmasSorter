import { describe, expect, it } from "vitest";
import type Member from "../Interfaces/Member.interface";
import {
  InfeasibleAssignmentError,
  InvalidParticipantsError,
  sortEventMembers,
  type SortOptions,
} from "./Sorter";

function makeParticipants(count: number): Member[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `P${index}`,
    email: `p${index}@example.com`,
  }));
}

function assertValid(
  people: Member[],
  result: ReturnType<typeof sortEventMembers>,
  exclusions: Array<[string, string]> = [],
): void {
  expect(result).toHaveLength(people.length);
  expect(new Set(result.map((entry) => entry.from.email)).size).toBe(people.length);
  expect(new Set(result.map((entry) => entry.to.email)).size).toBe(people.length);

  const excluded = new Set(
    exclusions.flatMap(([first, second]) => [`${first}|${second}`, `${second}|${first}`]),
  );
  for (const { from, to } of result) {
    expect(from.email).not.toBe(to.email);
    expect(excluded.has(`${from.email}|${to.email}`)).toBe(false);
  }
}

describe("sortEventMembers", () => {
  it("returns an empty list for no participants", () => {
    expect(sortEventMembers([])).toEqual([]);
  });

  it("throws for a single participant", () => {
    expect(() => sortEventMembers(makeParticipants(1), { seed: 1 })).toThrow(
      InfeasibleAssignmentError,
    );
  });

  it("rejects duplicate emails regardless of case", () => {
    const people: Member[] = [
      { name: "A", email: "a@example.com" },
      { name: "B", email: "A@example.com" },
    ];
    expect(() => sortEventMembers(people, { seed: 1 })).toThrow(InvalidParticipantsError);
  });

  it("rejects an exclusion pairing someone with themselves", () => {
    expect(() =>
      sortEventMembers(makeParticipants(3), {
        seed: 1,
        exclusions: [["p0@example.com", "p0@example.com"]],
      }),
    ).toThrow(InvalidParticipantsError);
  });

  it("rejects an exclusion whose first email is unknown", () => {
    expect(() =>
      sortEventMembers(makeParticipants(3), {
        seed: 1,
        exclusions: [["nobody@example.com", "p0@example.com"]],
      }),
    ).toThrow(InvalidParticipantsError);
  });

  it("rejects an exclusion whose second email is unknown", () => {
    expect(() =>
      sortEventMembers(makeParticipants(3), {
        seed: 1,
        exclusions: [["p0@example.com", "nobody@example.com"]],
      }),
    ).toThrow(InvalidParticipantsError);
  });

  it("produces a bijection without self-assignment for many sizes and seeds", () => {
    for (let count = 2; count <= 30; count += 1) {
      for (let seed = 1; seed <= 10; seed += 1) {
        assertValid(makeParticipants(count), sortEventMembers(makeParticipants(count), { seed }));
      }
    }
  });

  it("handles a large group", () => {
    assertValid(makeParticipants(60), sortEventMembers(makeParticipants(60), { seed: 1 }));
  });

  it("is deterministic for the same seed", () => {
    const people = makeParticipants(8);
    expect(sortEventMembers(people, { seed: 99 })).toEqual(
      sortEventMembers(people, { seed: 99 }),
    );
  });

  it("uses a random seed when none is given", () => {
    const result = sortEventMembers(makeParticipants(6));
    assertValid(makeParticipants(6), result);
  });

  it("honours exclusions", () => {
    const exclusions: Array<[string, string]> = [
      ["p0@example.com", "p1@example.com"],
      ["p2@example.com", "p3@example.com"],
    ];
    for (let seed = 1; seed <= 50; seed += 1) {
      const people = makeParticipants(8);
      assertValid(people, sortEventMembers(people, { seed, exclusions }), exclusions);
    }
  });

  it("uses the exact solver when random attempts are disabled", () => {
    const people = makeParticipants(6);
    const exclusions: Array<[string, string]> = [
      ["p0@example.com", "p1@example.com"],
      ["p1@example.com", "p2@example.com"],
    ];
    assertValid(
      people,
      sortEventMembers(people, { seed: 3, exclusions, maxAttempts: 0 }),
      exclusions,
    );
  });

  it("throws when the only derangement is excluded", () => {
    expect(() =>
      sortEventMembers(makeParticipants(2), {
        seed: 1,
        exclusions: [["p0@example.com", "p1@example.com"]],
      }),
    ).toThrow(InfeasibleAssignmentError);
  });

  it("throws when a participant has nobody left to give to", () => {
    expect(() =>
      sortEventMembers(makeParticipants(3), {
        seed: 1,
        maxAttempts: 0,
        exclusions: [
          ["p0@example.com", "p1@example.com"],
          ["p0@example.com", "p2@example.com"],
        ],
      }),
    ).toThrow(InfeasibleAssignmentError);
  });

  it("backtracks when a greedy choice blocks a later giver", () => {
    // 0 and 1 can only give to 2, so the exact solver must exhaust and fail.
    const exclusions: Array<[string, string]> = [
      ["p0@example.com", "p1@example.com"],
      ["p0@example.com", "p3@example.com"],
      ["p1@example.com", "p0@example.com"],
      ["p1@example.com", "p3@example.com"],
    ];
    expect(() =>
      sortEventMembers(makeParticipants(4), {
        seed: 1,
        maxAttempts: 0,
        exclusions,
      }),
    ).toThrow(InfeasibleAssignmentError);
  });

  it("returns one entry per participant with the original objects", () => {
    const people = makeParticipants(5);
    const options: SortOptions = { seed: 7 };
    const result = sortEventMembers(people, options);
    for (const entry of result) {
      expect(people).toContain(entry.from);
      expect(people).toContain(entry.to);
    }
  });
});
