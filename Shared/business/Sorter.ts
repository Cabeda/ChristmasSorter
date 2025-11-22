import type Member from "../Interfaces/Member.interface";
import type { EmailList } from "../Interfaces/EmailList.interface";

/**
 * Fisher–Yates shuffle
 * @param array Array to be shuffled
 */
function shuffle<T>(array: T[]) {
  let currentIndex = array.length,
    temporaryValue: T,
    randomIndex: number;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element. indices are in-range here so assert non-null
    temporaryValue = array[currentIndex] as T;
    array[currentIndex] = array[randomIndex] as T;
    array[randomIndex] = temporaryValue;
  }

  return array;
}

export function sortEventMembers(participants: Array<Member>): Array<EmailList> {
  if (participants.length === 0) return [];

  const arr = shuffle(participants);

  const sendingList: Array<EmailList> = [];

  for (let i = 0; i < arr.length; i++) {
    const from = arr[i]!;
    const to = i === arr.length - 1 ? arr[0]! : arr[i + 1]!;
    const email: EmailList = { from, to };
    sendingList.push(email);
  }

  return sendingList;
}
