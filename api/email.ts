import { VercelRequest, VercelResponse } from "@vercel/node";
import type { SorterEvent } from "../Shared/Interfaces/SorterEventAPI.Interface";
import type { EmailList } from "../Shared/Interfaces/EmailList.interface";
import { sortEventMembers } from "../Shared/business/Sorter.js";
import { createTransport, SendMailOptions } from "nodemailer";

function generateBody(
  event: SorterEvent,
  recipient: EmailList
): SendMailOptions {
  const currency = event.currency ? event.currency : "€";
  const eventDate = new Date(event.date);
  const formattedDate = eventDate.toLocaleDateString("pt-pt", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const textBody = [
    `Olá ${recipient.from.name},`,
    "",
    `Você foi sorteado para o Amigo Secreto "${event.name}" em ${formattedDate}.`,
    `Orçamento: ${event.giftPrice}${currency}`,
    `Presente para: ${recipient.to.name} (${recipient.to.email})`,
    "",
    "Boas festas e boas trocas de presentes!",
  ].join("\n");

  const htmlBody = `
    <p>Olá <strong>${recipient.from.name}</strong>,</p>
    <p>Você foi sorteado para o <strong>Amigo Secreto</strong> <em>${event.name}</em> no dia <strong>${formattedDate}</strong>.</p>
    <ul>
      <li><strong>Orçamento:</strong> ${event.giftPrice}${currency}</li>
      <li><strong>Presente para:</strong> ${recipient.to.name} (${recipient.to.email})</li>
    </ul>
    <p>Boas festas e boas trocas de presentes!</p>
    <hr />
    <p style="font-size:0.9em;color:#666;">Enviado por ${process.env.MAIL_ADDRESS}</p>
  `;

  const msg: SendMailOptions = {
    from: process.env.MAIL_ADDRESS,
    to: recipient.from.email,
    subject: `${event.name} — Amigo Secreto`,
    text: textBody,
    html: htmlBody,
  };

  return msg;
}

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse
) {
  // Parse body safely (some clients may send raw JSON strings)
  let body: SorterEvent;
  try {
    body = typeof _req.body === "string" ? JSON.parse(_req.body) : (_req.body as SorterEvent);
  } catch (err) {
    console.error("Invalid JSON body", err);
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  if (!body || !Array.isArray(body.participants) || body.participants.length === 0) {
    return res.status(400).json({ error: "Invalid payload: participants array is required" });
  }

  if (!process.env.MAIL_ADDRESS || !process.env.MAIL_PASSWORD) {
    console.error("Mail credentials not configured");
    return res.status(500).json({ error: "Mail credentials not configured on server" });
  }

  // create reusable transporter object using the default SMTP transport
  const transporter = createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.MAIL_ADDRESS,
      pass: process.env.MAIL_PASSWORD,
    },
  });

  try {
    // verify connection configuration before attempting to send
    await transporter.verify();
  } catch (err) {
    console.error("SMTP verify failed", err);
    return res.status(500).json({ error: "SMTP configuration invalid" });
  }

  const emails = sortEventMembers(body.participants).map((member) =>
    generateBody(body, member)
  );

  // send emails in parallel and collect results
  const results = await Promise.allSettled(
    emails.map((email) => transporter.sendMail(email))
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.status === "rejected")
    .map(({ r, i }) => ({ index: i, reason: (r as PromiseRejectedResult).reason?.toString() }));

  if (failed.length > 0) {
    console.error("Some emails failed to send", failed);
  }

  return res.status(200).json({ success: failed.length === 0, sent, failedCount: failed.length, failures: failed });
}
