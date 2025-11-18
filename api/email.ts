import { VercelRequest, VercelResponse } from "@vercel/node";
import { SorterEvent } from "../Shared/Interfaces/SorterEventAPI.interface";
import { EmailList } from "../Shared/Interfaces/EmailList.interface";
import { sortEventMembers } from "../Shared/business/Sorter";
import { createTransport, SendMailOptions } from "nodemailer";
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
    from: process.env.MAIL_ADDRESS,
    to: address,
    subject: event.name,
    text: `Olá ${recipient.from.name}!

    Você foi convidado para um Amigo Secreto em ${new Date(event.date).toDateString()} com o nome ${
      event.name
    }. O limite do presente é de ${
      event.giftPrice
    }${currency}, e você deverá dar um presente para ${recipient.to.name} (${recipient.to.email}).

    Boas festas e boas trocas de presentes!!!
          `,
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
      res.status(500).send("Erro ao enviar e-mail");
    }
  }
  res.status(200).send("Todos os e-mails enviados com sucesso");
}
