import { describe, expect, it } from "vitest";
import { invitationEmail, passwordResetEmail } from "./email-templates";

describe("invitationEmail", () => {
  it("includes the link and escapes HTML in names", () => {
    const msg = invitationEmail({
      to: "a@b.com",
      firstName: "<Ann>",
      companyName: "Will & Co",
      signUpUrl: "http://localhost:3000/signup?token=abc",
      expiresInDays: 7,
    });
    expect(msg.subject).toBe("You're invited to Will & Co on SaaS Core");
    expect(msg.text).toContain("http://localhost:3000/signup?token=abc");
    expect(msg.html).toContain("Will &amp; Co");
    expect(msg.html).toContain("&lt;Ann&gt;");
    expect(msg.html).not.toContain("<Ann>");
  });
});

describe("passwordResetEmail", () => {
  it("includes the reset link", () => {
    const msg = passwordResetEmail({
      to: "a@b.com",
      firstName: "Ann",
      companyName: "Canva",
      resetUrl: "http://localhost:3000/reset-password?token=abc",
      expiresInMinutes: 60,
    });
    expect(msg.text).toContain("http://localhost:3000/reset-password?token=abc");
  });
});
