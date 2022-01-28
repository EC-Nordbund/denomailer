interface ConnectConfig {
  hostname: string;
  port?: number;
}

interface ConnectConfigWithAuthentication extends ConnectConfig {
  username: string;
  password: string;
}

interface SendConfig {
  to: mailList;
  cc?: mailList;
  bcc?: mailList;
  from: string;
  date?: string;
  subject: string;
  content?: string;
  html?: string;
  replyTo?: mailString;
}

export type mailString = email | emailWithName | wrapedMail;
export type email = `${string}@${string}.${string}`;
export type emailWithName = `${string} <${email}>`;
export type wrapedMail = `<${email}>`;

export interface mailObject {
  mail: email;
  name?: string;
}

export type mail = mailString | mailObject;
export type mailListObject = Omit<Record<string, email>, "name" | "mail">;
export type mailList = mailListObject | mail[] | mail;

export type { ConnectConfig, ConnectConfigWithAuthentication, SendConfig };
