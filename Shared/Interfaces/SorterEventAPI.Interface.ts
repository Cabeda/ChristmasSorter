import Member from "./Member.interface";
import type { ExclusionPair } from "./ExclusionPair.interface";

export interface SorterEvent {
  name: string;
  giftPrice: string | number;
  currency?: string;
  participants: Array<Member>;
  date: string;
  exclusions?: Array<ExclusionPair>;
}
