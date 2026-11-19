import nodemailer, { type Transporter } from "nodemailer";
import { invitationEmail, passwordResetEmail } from "./email-templates";

export type EmailMessage = { to: string; subject: string; text: string; html: string };

/** Delivers a rendered message. SMTP in the app; a fake in tests. */
export interface EmailTransport {
  send(message: EmailMessage & { from: string }): Promise<void>;
}

export type SmtpConfig = { host: string; port: number; user?: string; password?: string };

/** SMTP delivery (Mailpit locally). */
export class SmtpTransport implements EmailTransport {
  private readonly transporter: Transporter;

  constructor(config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: config.user ? { user: config.user, pass: config.password } : undefined,
    });
  }

  async send(message: EmailMessage & { from: string }): Promise<void> {
    await this.transporter.sendMail(message);
  }
}

/**
 * Every email the app sends. Each method renders a template and delivers it;
 * callers say what to send, not how. Throws if delivery fails.
 */
export class EmailService {
  constructor(
    private readonly transport: EmailTransport,
    private readonly from: string,
  ) {}

  async sendInvitation(input: {
    to: string;
    firstName: string;
    companyName: string;
    signUpUrl: string;
    expiresInDays: number;
    /** The company admin who sent it; omitted when a platform admin did. */
    invitedBy?: string;
  }): Promise<void> {
    await this.deliver(invitationEmail(input));
  }

  async sendPasswordReset(input: {
    to: string;
    firstName: string;
    companyName: string;
    resetUrl: string;
    expiresInMinutes: number;
  }): Promise<void> {
    await this.deliver(passwordResetEmail(input));
  }

  private async deliver(message: EmailMessage): Promise<void> {
    await this.transport.send({ from: this.from, ...message });
  }
}
