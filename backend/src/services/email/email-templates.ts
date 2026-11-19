import type { EmailMessage } from "./email";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f4;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1c1c1a">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px">
<p style="margin:0 0 24px;font-weight:600;font-size:18px">SaaS Core</p>
${bodyHtml}
</div></body></html>`;
}

export function invitationEmail(input: {
  to: string;
  firstName: string;
  companyName: string;
  signUpUrl: string;
  expiresInDays: number;
  invitedBy?: string;
}): EmailMessage {
  const { to, firstName, companyName, signUpUrl, expiresInDays, invitedBy } = input;
  const subject = invitedBy
    ? `${invitedBy} invited you to ${companyName} on SaaS Core`
    : `You're invited to ${companyName} on SaaS Core`;
  const who = invitedBy ? `${invitedBy} has invited you` : "You've been invited";
  const text = [
    `Hi ${firstName},`,
    "",
    `${who} to join ${companyName} on SaaS Core.`,
    "Set your password to activate your account:",
    signUpUrl,
    "",
    `This link expires in ${expiresInDays} days. If you weren't expecting this invitation, you can ignore this email.`,
  ].join("\n");
  const html = layout(`
<p>Hi ${escapeHtml(firstName)},</p>
<p>${escapeHtml(who)} to join <strong>${escapeHtml(companyName)}</strong> on SaaS Core.</p>
<p style="margin:28px 0"><a href="${escapeHtml(signUpUrl)}" style="background:#1c1c1a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block">Set your password</a></p>
<p style="color:#6b6b66;font-size:14px">This link expires in ${expiresInDays} days. If you weren't expecting this invitation, you can ignore this email.</p>`);
  return { to, subject, text, html };
}

export function passwordResetEmail(input: {
  to: string;
  firstName: string;
  companyName: string;
  resetUrl: string;
  expiresInMinutes: number;
}): EmailMessage {
  const { to, firstName, companyName, resetUrl, expiresInMinutes } = input;
  const subject = "Reset your SaaS Core password";
  const text = [
    `Hi ${firstName},`,
    "",
    `Someone asked to reset your password for ${companyName} on SaaS Core. To choose a new password, open:`,
    resetUrl,
    "",
    `This link expires in ${expiresInMinutes} minutes. If you didn't ask for this, you can ignore this email.`,
  ].join("\n");
  const html = layout(`
<p>Hi ${escapeHtml(firstName)},</p>
<p>Someone asked to reset your password for <strong>${escapeHtml(companyName)}</strong> on SaaS Core.</p>
<p style="margin:28px 0"><a href="${escapeHtml(resetUrl)}" style="background:#1c1c1a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block">Choose a new password</a></p>
<p style="color:#6b6b66;font-size:14px">This link expires in ${expiresInMinutes} minutes. If you didn't ask for this, you can ignore this email.</p>`);
  return { to, subject, text, html };
}
