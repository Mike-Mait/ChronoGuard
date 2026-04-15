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
): Promise<{ ok: boolean; error?: string }> {
  const mailer = getTransporter();
  if (!mailer) {
    return {
      ok: false,
      error: "SMTP transporter not configured (missing SMTP_HOST or SMTP_USER)",
    };
  }

  try {
    const info = await mailer.sendMail({
      // Reset mail is a security/account communication, not a sales outreach
      // — send it from the support address so the sender matches user
      // expectation and replies route into the support queue. Falls back to
      // smtpFrom if SMTP_FROM_SUPPORT is unset so deploys aren't blocked.
      from: `"ChronoShield Support" <${config.smtpFromSupport}>`,
      to: toEmail,
      replyTo: "support@chronoshieldapi.com",
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
    return { ok: true, error: (info as any)?.messageId };
  } catch (err: any) {
    // Surface the real error so the caller can log it. Helps diagnose Resend
    // rejections (bad sender, quota exceeded, etc.) in production.
    return {
      ok: false,
      error: err?.response || err?.message || String(err),
    };
  }
}

// ─── Billing portal link email ───
// Sent when a Pro subscriber requests a subscription-management link via
// /api/billing/portal-request. Mirrors the reset-key flow: the email
// carries a signed HMAC token that, when clicked, opens a Stripe Customer
// Portal session for self-service billing (cancel, update card, view
// invoices). Sent from the support address so it matches the rest of the
// account-comms traffic the user has already received.
//
// Not sent to non-Pro accounts — the caller gates on tier before invoking
// this. The endpoint itself always returns the same generic response to
// avoid leaking which emails correspond to Pro subscribers.
export async function sendBillingPortalEmail(
  toEmail: string,
  portalUrl: string
): Promise<{ ok: boolean; error?: string }> {
  const mailer = getTransporter();
  if (!mailer) {
    return {
      ok: false,
      error: "SMTP transporter not configured (missing SMTP_HOST or SMTP_USER)",
    };
  }

  try {
    const info = await mailer.sendMail({
      from: `"ChronoShield Support" <${config.smtpFromSupport}>`,
      to: toEmail,
      replyTo: "support@chronoshieldapi.com",
      subject: "[ChronoShield] Manage your subscription",
      text: [
        `We received a request to manage the subscription for this email address.`,
        ``,
        `Click the link below to open a secure self-service portal where you can update your payment method, view invoices, or cancel your subscription:`,
        ``,
        portalUrl,
        ``,
        `This link expires in 1 hour.`,
        ``,
        `If you did not request this, you can safely ignore this email — no changes have been made to your account.`,
        ``,
        `— ChronoShield API`,
        `https://chronoshieldapi.com`,
      ].join("\n"),
    });
    return { ok: true, error: (info as any)?.messageId };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.response || err?.message || String(err),
    };
  }
}

// ─── Welcome email: free-tier signup ───
// Sent on NEW free-key issue only (not on re-fetch of an existing key).
// Fire-and-forget from the caller — a broken SMTP must never block key
// issuance. Deliberately does NOT include the raw API key: the UI modal
// already shows it with a "save this now" warning, and duplicating it in
// a long-lived inbox softens that urgency. Reset flow exists as recovery.
export async function sendWelcomeFreeEmail(toEmail: string): Promise<boolean> {
  const mailer = getTransporter();
  if (!mailer) return false;

  try {
    await mailer.sendMail({
      from: `"ChronoShield Team" <${config.smtpFromSupport}>`,
      to: toEmail,
      replyTo: "support@chronoshieldapi.com",
      subject: "Welcome to ChronoShield API",
      text: [
        `Hi,`,
        ``,
        `Thanks for signing up for a free ChronoShield API key — we genuinely appreciate you choosing ChronoShield to handle DST-aware datetime validation in your application.`,
        ``,
        `What the free tier includes:`,
        `  • 1,000 requests per month`,
        `  • Full access to validate, resolve, convert, and batch endpoints`,
        `  • DST gap and overlap detection across all IANA time zones`,
        ``,
        `Getting started:`,
        `  • API reference:  https://chronoshieldapi.com/docs`,
        `  • Interactive playground:  https://chronoshieldapi.com/docs/playground`,
        `  • Pass your key via the x-api-key header on every request`,
        ``,
        `Lost your key? You can reset it from the homepage using this email address — we'll send you a one-time link.`,
        ``,
        `If you have any questions, feedback, or run into anything unexpected, just reply to this email. A real person reads them.`,
        ``,
        `— The ChronoShield Team`,
        `https://chronoshieldapi.com`,
      ].join("\n"),
    });
    return true;
  } catch (err: any) {
    console.error(
      "[sendWelcomeFreeEmail] SMTP send failed:",
      err?.response || err?.message || err
    );
    return false;
  }
}

// ─── Welcome email: Pro upgrade ───
// Sent from the Stripe webhook after checkout.session.completed and after
// upgradeToProByEmail has persisted the tier change. Fire-and-forget for
// the same reason as the free-tier version — never 500 a Stripe webhook
// just because the mailer is grumpy. Stripe's own receipt email covers
// the billing/invoice side; this one is the human thank-you.
export async function sendWelcomeProEmail(toEmail: string): Promise<boolean> {
  const mailer = getTransporter();
  if (!mailer) return false;

  try {
    await mailer.sendMail({
      from: `"ChronoShield Team" <${config.smtpFromSupport}>`,
      to: toEmail,
      replyTo: "support@chronoshieldapi.com",
      subject: "Welcome to ChronoShield Pro",
      text: [
        `Hi,`,
        ``,
        `Thank you for upgrading to ChronoShield Pro. We truly appreciate your support — paying customers are what let us keep investing in the service, and it means a lot.`,
        ``,
        `Your plan now includes:`,
        `  • 100,000 requests per month`,
        `  • Priority support (reply to this email and you'll jump the queue)`,
        `  • Same API and same key — just with more room to scale`,
        ``,
        `A billing receipt for your subscription will arrive separately from Stripe. You can manage your subscription (update card, view invoices, cancel anytime) from any Stripe receipt's customer-portal link.`,
        ``,
        `If anything comes up — integration questions, feature requests, or something weird in the API — just reply here. You'll get a real person, not a ticketing bot.`,
        ``,
        `Thanks again for choosing ChronoShield.`,
        ``,
        `— The ChronoShield Team`,
        `https://chronoshieldapi.com`,
      ].join("\n"),
    });
    return true;
  } catch (err: any) {
    console.error(
      "[sendWelcomeProEmail] SMTP send failed:",
      err?.response || err?.message || err
    );
    return false;
  }
}

// ─── Cancellation / downgrade email: Pro → Free ───
// Sent from the Stripe webhook on customer.subscription.deleted, after
// downgradeToFreeByStripeCustomerId has persisted the tier change.
// Deliberately warm-toned (no "sorry to see you go" guilt-trip, no
// desperate win-back offer) — a genuine thank-you is better retention
// than a pushy retention email. Same API key keeps working at free-tier
// limits; we want that to be the clear, reassuring message.
export async function sendSubscriptionCancelledEmail(toEmail: string): Promise<boolean> {
  const mailer = getTransporter();
  if (!mailer) return false;

  try {
    await mailer.sendMail({
      from: `"ChronoShield Team" <${config.smtpFromSupport}>`,
      to: toEmail,
      replyTo: "support@chronoshieldapi.com",
      subject: "Your ChronoShield Pro subscription has been cancelled",
      text: [
        `Hi,`,
        ``,
        `Your ChronoShield Pro subscription has been cancelled as requested. Thank you for being a Pro customer — it genuinely meant a lot to have your support.`,
        ``,
        `A few things worth knowing:`,
        `  • Your API key still works — it's now on the free tier (1,000 requests/month).`,
        `  • No action needed from you. The same x-api-key header keeps working.`,
        `  • Any usage above the free-tier limit will return 429 until your monthly quota resets.`,
        ``,
        `If you ever want to come back, just visit https://chronoshieldapi.com and upgrade again with the same email — your key stays the same.`,
        ``,
        `And if something about the service didn't work for you, I'd genuinely love to hear why — just reply to this email. Honest feedback (even harsh feedback) is the most useful thing you can send us.`,
        ``,
        `Thanks again for giving ChronoShield a try.`,
        ``,
        `— The ChronoShield Team`,
        `https://chronoshieldapi.com`,
      ].join("\n"),
    });
    return true;
  } catch (err: any) {
    console.error(
      "[sendSubscriptionCancelledEmail] SMTP send failed:",
      err?.response || err?.message || err
    );
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
  } catch (err: any) {
    // Log the real SMTP error so quota/auth failures are visible in Railway
    // logs. Caller treats this as best-effort so we don't re-throw, but
    // silence here previously hid a dead sales@ inbox for days.
    console.error(
      "[sendContactNotification] SMTP send failed:",
      err?.response || err?.message || err
    );
    return false;
  }
}
