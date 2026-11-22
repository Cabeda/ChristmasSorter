import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTransport } from "nodemailer";
import {
  createTransporter,
  escapeHtml,
  generateBody,
  sendAssignmentEmails,
  type EventDetails,
  type Recipient,
} from "./mail";

vi.mock("nodemailer", () => ({
  createTransport: vi.fn(() => ({ mocked: true })),
}));

const event: EventDetails = {
  name: "Amigo <Secreto>",
  date: "2026-12-25T00:00:00.000Z",
  giftPrice: "5",
  currency: "euro",
};

const recipient: Recipient = {
  from: { name: "Ana <b>", email: "ana@example.com" },
  to: { name: 'Bia "B"', email: "bia@example.com" },
};

beforeEach(() => {
  process.env.MAIL_ADDRESS = "sender@example.com";
  process.env.MAIL_PASSWORD = "secret";
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_SECURE;
  vi.mocked(createTransport).mockClear();
});

afterEach(() => {
  delete process.env.MAIL_ADDRESS;
  delete process.env.MAIL_PASSWORD;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_SECURE;
});

describe("escapeHtml", () => {
  it("escapes every HTML metacharacter", () => {
    expect(escapeHtml(`<&>"'`)).toBe("&lt;&amp;&gt;&quot;&#39;");
  });

  it("leaves plain text unchanged", () => {
    expect(escapeHtml("Ana Silva 123")).toBe("Ana Silva 123");
  });
});

describe("generateBody", () => {
  it("renders the price with a symbol, not the currency code", () => {
    const message = generateBody(event, recipient);
    expect(message.text).toContain("Orçamento: 5€");
    expect(message.text).not.toContain("5euro");
  });

  it("escapes user-provided names and emails in HTML", () => {
    const message = generateBody(event, recipient);
    const html = String(message.html);
    expect(html).toContain("&lt;Secreto&gt;");
    expect(html).toContain("Ana &lt;b&gt;");
    expect(html).toContain("Bia &quot;B&quot;");
    expect(html).not.toContain("<Secreto>");
    expect(html).not.toContain("Ana <b>");
  });

  it("shows the organizer's address in the footer", () => {
    expect(String(generateBody(event, recipient).html)).toContain("sender@example.com");
  });

  it("strips newlines from the subject", () => {
    const message = generateBody({ ...event, name: "Amigo\r\nSecreto" }, recipient);
    expect(message.subject).toBe("Amigo Secreto — Amigo Secreto");
  });

  it("tolerates a missing sender address", () => {
    delete process.env.MAIL_ADDRESS;
    expect(generateBody(event, recipient).from).toBe("");
  });
});

describe("createTransporter", () => {
  it("uses Gmail by default", () => {
    createTransporter();
    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: "sender@example.com", pass: "secret" },
    });
  });

  it("honours SMTP overrides", () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "2525";
    process.env.SMTP_SECURE = "true";
    createTransporter();
    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 2525,
      secure: true,
      auth: { user: "sender@example.com", pass: "secret" },
    });
  });
});

describe("sendAssignmentEmails", () => {
  it("counts successful sends", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    const transporter = { sendMail } as unknown as Parameters<typeof sendAssignmentEmails>[0];
    const result = await sendAssignmentEmails(transporter, event, [recipient, recipient]);
    expect(result).toEqual({ sent: 2, failed: [] });
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it("collects failures with an Error reason", async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error("boom"));
    const transporter = { sendMail } as unknown as Parameters<typeof sendAssignmentEmails>[0];
    const result = await sendAssignmentEmails(transporter, event, [recipient]);
    expect(result).toEqual({
      sent: 0,
      failed: [{ email: "ana@example.com", reason: "boom" }],
    });
  });

  it("collects failures with a non-Error reason", async () => {
    const sendMail = vi.fn().mockRejectedValue("boom");
    const transporter = { sendMail } as unknown as Parameters<typeof sendAssignmentEmails>[0];
    const result = await sendAssignmentEmails(transporter, event, [recipient]);
    expect(result.failed).toEqual([{ email: "ana@example.com", reason: "boom" }]);
  });

  it("handles an empty draw", async () => {
    const sendMail = vi.fn();
    const transporter = { sendMail } as unknown as Parameters<typeof sendAssignmentEmails>[0];
    await expect(sendAssignmentEmails(transporter, event, [])).resolves.toEqual({
      sent: 0,
      failed: [],
    });
  });
});
