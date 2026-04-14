import nodemailer from "nodemailer";
import { config } from "../config/env";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!config.smtpHost || !config.smtpUser) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });
  }
  return transporter;
}

function sanitizeForEmail(str: string): string {
  return str.replace(/[\r\n]/g, " ").trim();
}

export async function sendResetKeyEmail(
  toEmail: string,
  resetUrl: string
): Promise<boolean> {
  const mailer = getTransporter();
  if (!mailer) return false;

  try {
    await mailer.sendMail({
      from: `"ChronoShield API" <support@chronoshieldapi.com>`,
      to: toEmail,
      subject: "[ChronoShield] Reset your API key",
      text: [
        `We received a request to reset the API key for this email address.`,
        ``,
        `To issue a new key (and invalidate your existing one), click the link below:`,
        ``,
        resetUrl,
        ``,
        `This link expires in 1 hour.`,
        ``,
        `If you did not request this, you can safely ignore this email — your existing key remains active.`,
        ``,
        `— ChronoShield API`,
        `https://chronoshieldapi.com`,
      ].join("\n"),
    });
    return true;
  } catch {
    return false;
  }
}

export async function sendContactNotification(inquiry: {
  plan: string;
  name: string;
  email: string;
  company: string;
  message: string;
}): Promise<boolean> {
  const mailer = getTransporter();
  if (!mailer) return false;

  const safeName = sanitizeForEmail(inquiry.name);
  const safePlan = sanitizeForEmail(inquiry.plan);

  try {
    await mailer.sendMail({
      from: config.smtpFrom,
      to: config.contactNotifyEmail,
      subject: `[ChronoShield] New ${safePlan} inquiry from ${safeName}`,
      text: [
        `New enterprise contact inquiry received.`,
        ``,
        `Plan: ${inquiry.plan}`,
        `Name: ${inquiry.name}`,
        `Email: ${inquiry.email}`,
        `Company: ${inquiry.company || "(not provided)"}`,
        ``,
        `Message:`,
        inquiry.message,
      ].join("\n"),
    });
    return true;
  } catch {
    return false;
  }
}
