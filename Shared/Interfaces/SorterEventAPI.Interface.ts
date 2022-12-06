import { Languages } from "./Languages.enum";
import Member from "./Member.interface";

export interface SorterEvent {
  name: string;
  giftPrice: number;
  currency?: string;
  participants: Array<Member>;
  date: string;
  languages: Languages;
}
