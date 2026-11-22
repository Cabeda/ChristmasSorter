import type Member from "../Interfaces/Member.interface";
import type { EmailList } from "../Interfaces/EmailList.interface";
import type { ExclusionPair } from "../Interfaces/ExclusionPair.interface";
import { mulberry32, randomSeed, type Rng } from "./rng.js";

export interface SortOptions {
  /** 32-bit seed. Omit for a fresh CSPRNG seed. */
  seed?: number;
  /** Pairs of emails that must never be drawn for each other. */
  exclusions?: ReadonlyArray<ExclusionPair>;
  /** Random attempts before the exact solver runs. Set 0 to force the solver. */
  maxAttempts?: number;
}

/** The draw is impossible for the given participants and exclusions. */
export class InfeasibleAssignmentError extends Error {
  constructor(
    message = "No valid Secret Santa draw exists for these participants and exclusions.",
  ) {
    super(message);
    this.name = "InfeasibleAssignmentError";
  }
}

/** The participant list is malformed (duplicate emails, bad exclusions). */
export class InvalidParticipantsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidParticipantsError";
  }
}

const pairKey = (a: string, b: string): string =>
  a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;

function shuffleInPlace<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const temporary = items[i]!;
    items[i] = items[j]!;
    items[j] = temporary;
  }
  return items;
}

function normalizeExclusions(
  participants: Array<Member>,
  exclusions: ReadonlyArray<ExclusionPair>,
): Set<string> {
  const emails = new Set(participants.map((participant) => participant.email.toLowerCase()));
  const excluded = new Set<string>();

  for (const [first, second] of exclusions) {
    const left = first.trim().toLowerCase();
    const right = second.trim().toLowerCase();
    if (left === right) {
      throw new InvalidParticipantsError(
        "An exclusion cannot pair a participant with themselves.",
      );
    }
    if (!emails.has(left) || !emails.has(right)) {
      throw new InvalidParticipantsError(
        "An exclusion references an email that is not a participant.",
      );
    }
    excluded.add(pairKey(left, right));
  }

  return excluded;
}

function isAllowed(from: Member, to: Member, excluded: Set<string>): boolean {
  return (
    from.email !== to.email &&
    !excluded.has(pairKey(from.email.toLowerCase(), to.email.toLowerCase()))
  );
}

function permutationIsValid(
  permutation: Array<number>,
  participants: Array<Member>,
  excluded: Set<string>,
): boolean {
  for (let index = 0; index < permutation.length; index += 1) {
    if (!isAllowed(participants[index]!, participants[permutation[index]!]!, excluded)) {
      return false;
    }
  }
  return true;
}

/**
 * Exact solver used when random attempts keep failing. It assigns receivers
 * to givers with backtracking, always taking the giver with the fewest options
 * first (MRV) so heavily constrained draws stay cheap.
 */
function exactAssignment(
  participants: Array<Member>,
  excluded: Set<string>,
  rng: Rng,
): Array<number> | null {
  const options = participants.map((from) =>
    participants
      .map((to, index) => (isAllowed(from, to, excluded) ? index : -1))
      .filter((index) => index >= 0),
  );

  if (options.some((list) => list.length === 0)) return null;

  const givers = participants
    .map((_, index) => index)
    .sort((a, b) => options[a]!.length - options[b]!.length);
  const used = new Array<boolean>(participants.length).fill(false);
  const assignment = new Array<number>(participants.length).fill(-1);

  const search = (position: number): boolean => {
    if (position === givers.length) return true;

    const giver = givers[position]!;
    for (const receiver of shuffleInPlace([...options[giver]!], rng)) {
      if (used[receiver]) continue;
      used[receiver] = true;
      assignment[giver] = receiver;
      if (search(position + 1)) return true;
      used[receiver] = false;
      assignment[giver] = -1;
    }
    return false;
  };

  return search(0) ? assignment : null;
}

/**
 * Draw a Secret Santa assignment: every participant gives to exactly one other
 * participant, receives from exactly one other participant, and never gives to
 * themselves or to an excluded person.
 *
 * @param participants Participants, with unique emails.
 * @param options Seed, exclusion pairs, and attempt budget.
 * @returns One `{ from, to }` entry per participant.
 * @throws {InfeasibleAssignmentError} When no valid draw exists.
 * @throws {InvalidParticipantsError} On duplicate emails or malformed exclusions.
 */
export function sortEventMembers(
  participants: Array<Member>,
  options: SortOptions = {},
): Array<EmailList> {
  if (participants.length === 0) return [];
  if (participants.length < 2) {
    throw new InfeasibleAssignmentError("At least two participants are required.");
  }

  const seen = new Set<string>();
  for (const participant of participants) {
    const email = participant.email.trim().toLowerCase();
    if (seen.has(email)) {
      throw new InvalidParticipantsError(`Duplicate participant email: ${participant.email}`);
    }
    seen.add(email);
  }

  const excluded = normalizeExclusions(participants, options.exclusions ?? []);
  const rng = mulberry32(options.seed ?? randomSeed());
  const attempts = options.maxAttempts ?? Math.max(200, participants.length * 50);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const permutation = shuffleInPlace(
      participants.map((_, index) => index),
      rng,
    );
    if (permutationIsValid(permutation, participants, excluded)) {
      return participants.map((from, index) => ({
        from,
        to: participants[permutation[index]!]!,
      }));
    }
  }

  const exact = exactAssignment(participants, excluded, rng);
  if (exact === null) {
    throw new InfeasibleAssignmentError();
  }

  return participants.map((from, index) => ({
    from,
    to: participants[exact[index]!]!,
  }));
}
