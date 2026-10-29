import nodemailer, { type Transporter } from "nodemailer";
import {
  EmailConfig,
  getEmailConfig,
  validateEmailConfig,
  resolveActualRecipient,
} from "./config";
import { maskEmail } from "./errors";

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
  jobId?: string;
  jobType?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  actualRecipient?: string;
  intendedRecipient?: string;
  isRedirected?: boolean;
}

export interface EmailTransport {
  send(options: SendEmailOptions): Promise<SendEmailResult>;
  verify(): Promise<boolean>;
  getMode(): string;
}

/**
 * Dev / Console Email Transport:
 * Logs dispatch metadata safely without contacting any real SMTP server.
 */
export class ConsoleEmailTransport implements EmailTransport {
  getMode(): string {
    return "console";
  }

  async verify(): Promise<boolean> {
    return true;
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    const { actualRecipient, isRedirected, intendedRecipient } = resolveActualRecipient(options.to);
    const maskedActual = maskEmail(actualRecipient);
    const maskedIntended = maskEmail(intendedRecipient);

    console.log(
      isRedirected
        ? `[DEV EMAIL SINK (REDIRECTED)] Job: ${options.jobId || "direct"} | Type: ${
            options.jobType || "UNKNOWN"
          } | Intended: ${maskedIntended} -> Actual: ${maskedActual} | Subject: "${options.subject}"`
        : `[DEV EMAIL SINK] Job: ${options.jobId || "direct"} | Type: ${
            options.jobType || "UNKNOWN"
          } | To: ${maskedActual} | Subject: "${options.subject}"`,
    );

    return {
      success: true,
      messageId: `simulated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      simulated: true,
      actualRecipient,
      intendedRecipient,
      isRedirected,
    };
  }
}

/**
 * Production Gmail SMTP Transport:
 * Communicates with smtp.gmail.com:587 via STARTTLS using Google App Password.
 * Supports transparent global test recipient redirection in local/test environments.
 */
export class SmtpEmailTransport implements EmailTransport {
  private transporter: Transporter;
  private config: EmailConfig;

  constructor(config: EmailConfig, transporter?: Transporter) {
    this.config = config;
    const validation = validateEmailConfig(config);
    if (!validation.valid) {
      throw new Error(
        `Invalid SMTP configuration: ${validation.errors.join(", ")}`,
      );
    }

    this.transporter =
      transporter ||
      nodemailer.createTransport({
        pool: true,
        maxConnections: 1,
        maxMessages: 50,
        rateDelta: 60_000,
        rateLimit: 12,
        host: config.host,
        port: config.port,
        secure: config.secure, // false for 587 (STARTTLS)
        auth: {
          user: config.user,
          pass: config.password,
        },
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
      });
  }

  getMode(): string {
    return "smtp";
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (err) {
      console.error("[SMTP VERIFY FAILED]", err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    const { actualRecipient, isRedirected, intendedRecipient } = resolveActualRecipient(options.to);
    const maskedActual = maskEmail(actualRecipient);
    const maskedIntended = maskEmail(intendedRecipient);

    let subject = options.subject;
    let html = options.html;
    let text = options.text;

    if (isRedirected && actualRecipient.toLowerCase() !== intendedRecipient.toLowerCase()) {
      subject = `[DEV/TEST -> ${intendedRecipient}] ${options.subject}`;
      text = `[DEV/TEST EMAIL REDIRECTION]\nIntended Recipient: ${intendedRecipient}\nActual Recipient: ${actualRecipient}\n----------------------------------------\n\n${options.text}`;
      html =
        `<div style="background:#fef3c7;border:1px solid #f59e0b;padding:10px 14px;margin-bottom:18px;border-radius:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#92400e;line-height:1.5;">
          <strong style="display:block;margin-bottom:4px;color:#b45309;">⚠️ [DEV/TEST EMAIL REDIRECTION]</strong>
          <span>Email này được hệ thống chuyển hướng tự động trong môi trường Demo/Test:</span><br/>
          • <strong>Người nhận dự kiến (Intended):</strong> <code>${intendedRecipient}</code><br/>
          • <strong>Người nhận thực tế (Actual):</strong> <code>${actualRecipient}</code>
        </div>` + options.html;
    }

    const info = await this.transporter.sendMail({
      from: this.config.from,
      to: actualRecipient,
      subject,
      text,
      html,
      headers: isRedirected
        ? {
            "X-Intended-Recipient": intendedRecipient,
            "X-Redirected-To": actualRecipient,
          }
        : undefined,
    });

    console.log(
      isRedirected
        ? `[SMTP DISPATCH SUCCESS (REDIRECTED)] Job: ${options.jobId || "direct"} | Intended: ${maskedIntended} -> Actual: ${maskedActual} | MessageId: ${
            info.messageId
          }`
        : `[SMTP DISPATCH SUCCESS] Job: ${options.jobId || "direct"} | To: ${maskedActual} | MessageId: ${
            info.messageId
          }`,
    );

    return {
      success: true,
      messageId: info.messageId,
      simulated: false,
      actualRecipient,
      intendedRecipient,
      isRedirected,
    };
  }
}

/**
 * Factory to create the appropriate transport based on configuration.
 */
export function createEmailTransport(
  config: EmailConfig = getEmailConfig(),
): EmailTransport {
  if (config.deliveryMode === "smtp") {
    return new SmtpEmailTransport(config);
  }
  return new ConsoleEmailTransport();
}
