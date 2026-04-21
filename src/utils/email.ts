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

// Canonicalize an email address for storage and lookup. Trims surrounding
// whitespace and lowercases the whole string.
//
// RFC 5321 says the local part ("alice" in alice@example.com) is technically
// case-sensitive, but no real-world mail server or user treats it that way.
// Leaving case as the user typed it lets "Bob@example.com" and
// "bob@example.com" create two separate account rows — a footgun both
// for the user (they can't find their own key) and for us (duplicate
// Stripe customers, doubled mail volume, inflated MRR metrics).
//
// Applied at every public entry point that accepts an email: the /api/keys
// creation endpoint, the reset- and billing-portal request endpoints, and
// the Stripe webhook's email-extraction path. Tokens are minted AFTER
// normalization, so the email baked into a signed token is already in
// canonical form — downstream token-verify call sites don't need to
// re-normalize.
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
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
        `A billing receipt for your subscription will arrive separately from Stripe.`,
        ``,
        `To manage your subscription at any time (update your card, view invoices, or cancel), visit https://chronoshieldapi.com and click "Manage my subscription" — we'll email you a secure one-time link that opens the Stripe customer portal.`,
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

// ─── Cancellation-scheduled email: fires when user clicks Cancel ───
// Sent from the Stripe webhook on customer.subscription.updated when
// cancel_at_period_end transitions false → true (i.e. the user just
// clicked Cancel in the Stripe Portal). This is the ONLY cancellation-
// related email we send — deliberately not re-sent on
// customer.subscription.deleted at period-end (that downgrade is silent)
// because two emails for one cancellation decision is noisy.
//
// Intent: reassure immediately. A user who clicks Cancel and hears
// nothing for 30 days wonders if the product is broken. The message has
// to land the same day, spell out exactly when Pro ends, and make crystal
// clear the API key keeps working afterward (just at free-tier limits).
//
// Tone matches sendWelcomeProEmail — warm thank-you, no retention guilt,
// no aggressive win-back offer. Honest feedback ask at the end.
export async function sendCancellationScheduledEmail(
  toEmail: string,
  periodEnd: Date
): Promise<boolean> {
  const mailer = getTransporter();
  if (!mailer) return false;

  // Formatted for a US/English audience — "April 30, 2026" reads far
  // better in an email body than an ISO timestamp. If we ever localize
  // we can branch on the user's locale from their DB record; for now,
  // a single format is fine.
  const formattedDate = periodEnd.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  try {
    await mailer.sendMail({
      from: `"ChronoShield Team" <${config.smtpFromSupport}>`,
      to: toEmail,
      replyTo: "support@chronoshieldapi.com",
      subject: "Your ChronoShield Pro cancellation is scheduled",
      text: [
        `Hi,`,
        ``,
        `We've received your cancellation request — thanks for letting us know. Here's exactly what happens next so there are no surprises:`,
        ``,
        `  • Your Pro access continues through ${formattedDate}. You keep the full 100,000 requests/month until then.`,
        `  • On ${formattedDate}, your API key automatically reverts to the free tier (1,000 requests/month). Same x-api-key header, lower monthly ceiling.`,
        `  • You don't need to do anything. No final confirmation step, no card charge on that date.`,
        `  • Any usage above the free-tier limit will return 429 until your monthly quota resets on the first of each month.`,
        ``,
        `Changed your mind?`,
        `You can resubscribe anytime by visiting https://chronoshieldapi.com and entering the same email address. Your existing key stays the same — no reset required.`,
        ``,
        `And if something about the service didn't work for you, I'd genuinely appreciate hearing why — just reply to this email. Honest feedback (even harsh feedback) is one of the most useful things you can send us.`,
        ``,
        `Thanks for trying ChronoShield Pro.`,
        ``,
        `— The ChronoShield Team`,
        `https://chronoshieldapi.com`,
      ].join("\n"),
    });
    return true;
  } catch (err: any) {
    console.error(
      "[sendCancellationScheduledEmail] SMTP send failed:",
      err?.response || err?.message || err
    );
    return false;
  }
}

// ─── Refund confirmation email ───
// Sent from the Stripe webhook on charge.refunded, after
// downgradeToFreeByStripeCustomerId has persisted the tier change.
//
// Rationale for sending this at all (given Stripe has its own refund
// receipt): Stripe's automatic receipt is unreliable in the specific
// edge case where a subscription has already been cancelled-immediately
// before the refund is issued. We observed during launch testing that
// in that sequence (cancel → cancel-immediately → refund) Stripe
// silently skips the customer-facing receipt, leaving the user without
// any acknowledgment that their refund went through.
//
// In the normal case (active subscription → refund) this fires ALONGSIDE
// Stripe's automatic receipt. The content is deliberately service-
// focused ("your key is now on free tier") rather than financial
// ("$X refunded to card ending 4242") so the two emails complement
// each other rather than duplicate — Stripe handles the money receipt,
// we handle the tier-state ack.
export async function sendRefundConfirmedEmail(toEmail: string): Promise<boolean> {
  const mailer = getTransporter();
  if (!mailer) return false;

  try {
    await mailer.sendMail({
      from: `"ChronoShield Team" <${config.smtpFromSupport}>`,
      to: toEmail,
      replyTo: "support@chronoshieldapi.com",
      subject: "Your ChronoShield refund has been processed",
      text: [
        `Hi,`,
        ``,
        `Your refund has been processed and your ChronoShield Pro subscription has been closed. Here's what it means for your account:`,
        ``,
        `  • Your API key still works — it's now on the free tier (1,000 requests/month).`,
        `  • The same x-api-key header keeps working. No code changes needed on your end.`,
        `  • Any usage above the free-tier limit will return 429 until your monthly quota resets on the 1st of each month.`,
        `  • Stripe will send a separate receipt with the financial details of the refund.`,
        ``,
        `If you ever want to come back, just visit https://chronoshieldapi.com and subscribe again with the same email — your existing key stays the same, no reset required.`,
        ``,
        `And if something about the service didn't work for you, I'd genuinely appreciate hearing why — just reply to this email. Honest feedback (even harsh feedback) is one of the most useful things you can send us.`,
        ``,
        `Thanks for giving ChronoShield a try.`,
        ``,
        `— The ChronoShield Team`,
        `https://chronoshieldapi.com`,
      ].join("\n"),
    });
    return true;
  } catch (err: any) {
    console.error(
      "[sendRefundConfirmedEmail] SMTP send failed:",
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
