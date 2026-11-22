import { z } from "zod";
import { toDateInputValue } from "../../Shared/business/date";

/** One participant as the form keeps it, before the server validates it. */
export interface ParticipantInput {
  name: string;
  email: string;
}

/** Values the inputs hold. The date stays a string until the schema coerces it. */
export interface FormInputs {
  eventName: string;
  participants: ParticipantInput[];
  eventDate: string;
  price: string;
  currency: string;
}

/** Values handed to the send function: the schema has coerced the date. */
export interface FormOutput extends Omit<FormInputs, "eventDate"> {
  eventDate: Date;
}

const MemberSchema = z.object({
  name: z.string().nonempty("Nome é obrigatório"),
  email: z.string().email("Insira um e-mail válido"),
});

export const Schema = z.object({
  eventName: z.string().nonempty("Nome do evento é obrigatório"),
  participants: z.array(MemberSchema).min(2, "Adicione pelo menos 2 participantes"),
  eventDate: z.coerce.date({ error: "Data inválida" }),
  price: z.string().nonempty("Preço é obrigatório"),
  currency: z.string().nonempty("Moeda é obrigatória"),
});

/** A pristine form, one participant per row. */
export const DEFAULT_VALUES: FormInputs = {
  eventName: "Amigo Secreto",
  eventDate: toDateInputValue(new Date()),
  price: "5",
  currency: "euro",
  participants: [
    { name: "", email: "" },
    { name: "", email: "" },
  ],
};
