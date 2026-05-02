// Lightweight Resend wrapper. Uses raw fetch instead of the SDK to avoid an
// extra dependency — Resend's API is small and stable. If RESEND_API_KEY is
// missing (e.g. local dev without setup), sendEmail logs and returns false
// so callers don't crash.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Default sender address. Override per-call if a specific org needs branded
// from-line. Domain MUST be verified in Resend before any sends will succeed.
const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL || "Represent <invites@representvote.com>";

interface SendEmailOpts {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export async function sendEmail(opts: SendEmailOpts): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY not set; skipping send to ${opts.to}`);
    return false;
  }

  try {
    const resp = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: opts.from || DEFAULT_FROM,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        reply_to: opts.replyTo,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.error(`[email] Resend send failed (${resp.status}) to=${opts.to}: ${body}`);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error(`[email] Resend send threw to=${opts.to}: ${err?.message || err}`);
    return false;
  }
}

// Builds the org-invite email. Token-bearing URL points at the web portal,
// which handles Google sign-in then auto-accepts via /api/invites/:token/accept.
export function buildOrgInviteEmail(args: {
  inviteeFirstName?: string | null;
  orgName: string;
  inviterName: string;
  inviteUrl: string;
  expiresInDays: number;
}) {
  const greeting = args.inviteeFirstName ? `Hi ${args.inviteeFirstName},` : `Hi,`;
  const subject = `You're invited to join ${args.orgName} on Represent`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.5; color: #1a1a1a; max-width: 540px; margin: 32px auto; padding: 0 24px;">
  <h1 style="font-size: 22px; margin: 0 0 16px;">${escapeHtml(greeting)}</h1>
  <p>${escapeHtml(args.inviterName)} has invited you to join <strong>${escapeHtml(args.orgName)}</strong> on Represent — a platform for verified organizational voting and member engagement.</p>
  <p style="margin: 28px 0;">
    <a href="${escapeAttr(args.inviteUrl)}" style="display: inline-block; background: #EABA58; color: #040707; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">Accept invitation</a>
  </p>
  <p style="color: #555; font-size: 14px;">This invitation expires in ${args.expiresInDays} days. If the button doesn't work, paste this link into your browser:</p>
  <p style="color: #555; font-size: 13px; word-break: break-all;"><a href="${escapeAttr(args.inviteUrl)}" style="color: #555;">${escapeHtml(args.inviteUrl)}</a></p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
  <p style="color: #888; font-size: 12px;">If you weren't expecting this invitation, you can safely ignore this email.</p>
</body>
</html>`.trim();

  const text = [
    greeting,
    "",
    `${args.inviterName} has invited you to join ${args.orgName} on Represent.`,
    "",
    `Accept invitation: ${args.inviteUrl}`,
    "",
    `This invitation expires in ${args.expiresInDays} days.`,
    "",
    `If you weren't expecting this invitation, you can safely ignore this email.`,
  ].join("\n");

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
