import { VercelRequest, VercelResponse } from "@vercel/node";
import { SorterEvent } from "../Shared/Interfaces/SorterEventAPI.interface";
import { EmailList } from "../Shared/Interfaces/EmailList.interface";
import { sortEventMembers } from "../Shared/business/Sorter";
import { createTransport, SendMailOptions } from "nodemailer";
import { Address } from "nodemailer/lib/mailer";
import { Languages } from "../Shared/Interfaces/Languages.enum";

function get_messages(
  language: Languages = Languages.PT,
  fromName: string,
  toName: string,
  date: string,
  eventName: string,
  giftPrice: number,
  currency: string = "€",
  email: string
): string {
  switch (language) {
    case Languages.EN:
      return `Hi there ${fromName}!

      You were invited to a Secret Santa at ${new Date(
        date
      ).toDateString()} named ${eventName}. The limit of the gift is ${giftPrice}${currency}, and you are to give a gift to ${toName} (${email}).
      
      Best regards and happy gift Exchange!!!
            `;
    case Languages.PT:
    default:
      return `Olá ${fromName}!

Foi convidado para um evento de amigo secreto a ${new Date(
        date
      ).toDateString()}, ${eventName}. O limite da prenda é de ${giftPrice}€, e tem de oferecer a ${toName} (${email}).
      
Boa sorte!!! 
            `;
  }
}

function generateBody(
  event: SorterEvent,
  recipient: EmailList
): SendMailOptions {
  const currency = undefined;

  const address: Address = {
    name: recipient.from.name,
    address: recipient.from.email,
  };

  const msg: SendMailOptions = {
    from: process.env.MAIL_ADDRESS,
    to: address,
    subject: event.name,
    text: get_messages(
      Languages.PT,
      recipient.from.name,
      recipient.to.name,
      new Date(event.date).toDateString(),
      event.name,
      event.giftPrice,
      currency,
      recipient.to.email
    ),
  };
  return msg;
}

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse
) {
  const body = _req.body as SorterEvent;

  // create reusable transporter object using the default SMTP transport
  const transporter = createTransport({
    host: "smtp.gmail.com",
    port: 587,
    auth: {
      user: process.env.MAIL_ADDRESS,
      pass: process.env.MAIL_PASSWORD,
    },
  });

  const emails = sortEventMembers(body.participants).map((member) =>
    generateBody(body, member)
  );

  for (const email of emails) {
    try {
      // send mail with defined transport object
      let info = await transporter.sendMail(email);
      console.log("Message sent: %s", info.messageId);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error sending email");
    }
  }
  res.status(200).send("All emails sent with success");
}
