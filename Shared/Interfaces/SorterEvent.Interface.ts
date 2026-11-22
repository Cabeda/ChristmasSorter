import Member from "./Member.interface";
import type { ExclusionPair } from "./ExclusionPair.interface";

export default interface SorterEvent {
  name: string;
  participants: Array<Member>;
  giftPrice: string;
  date: Date;
  currency: string;
  exclusions?: Array<ExclusionPair>;
}
