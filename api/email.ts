import { VercelRequest, VercelResponse } from "@vercel/node";
import { SorterEvent } from "../Shared/Interfaces/SorterEventAPI.interface";
import { EmailList } from "../Shared/Interfaces/EmailList.interface";
import { sortEventMembers } from "../Shared/business/Sorter";
import {
  createTransport,
  getTestMessageUrl,
  SendMailOptions,
} from "nodemailer";
import { Address } from "nodemailer/lib/mailer";

function generateBody(
  event: SorterEvent,
  recipient: EmailList
): SendMailOptions {
  const currency = event.currency ? event.currency : "€";

  const address: Address = {
    name: recipient.from.name,
    address: recipient.from.email,
  };

  const msg: SendMailOptions = {
    from: "jecabeda@gmail.com",
    to: address,
    subject: event.name,
    text: `Hi there ${recipient.from.name}!

    You were invited to a Gift Exchange at ${event.date} named ${event.name}. The limit of the gift is ${event.giftPrice}${currency}, and you are to give a gift to ${recipient.to.name}.
    
    Best regards and happy gift Exchange!!!
          `,
  };

  return msg;
}

export default function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  const body = request.body as SorterEvent;

  // create reusable transporter object using the default SMTP transport
  const transporter = createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    auth: {
      user: "andreanne57@ethereal.email",
      pass: "nGRx52fgkJ7h8sTexr",
    },
  });

  const emails = sortEventMembers(body.members).map((member) =>
    generateBody(body, member)
  );

  for (const email of emails) {
    // send mail with defined transport object
    transporter
      .sendMail(email)
      .then((info) => {
        console.log("Message sent: %s", info.messageId);
        // Preview only available when sending through an Ethereal account
        console.log("Preview URL: %s", getTestMessageUrl(info));
      })
      .catch((error) => {
        console.error(error);
        response.status(500).send("Error sending email");
      });
  }
  response.status(200).send("All emails sent with success");
}
