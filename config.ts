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
  from: string;
  date?: string;
  subject: string;
  content: string;
  html?: string;
}

export type email = `${string}@${string}.${string}`;
export type emailWithName = `${string} <${email}>`;
export type wrapedMail = `<${email}>`;

export interface mailObject {
  mail: email;
  name?: string;
}

export type mail = email | emailWithName | mailObject | wrapedMail;
export type mailListObject = Omit<Record<string, email>, "name" | "mail">;
export type mailList = mailListObject | mail[] | mail;

export type { ConnectConfig, ConnectConfigWithAuthentication, SendConfig };
