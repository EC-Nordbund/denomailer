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
  mimeContent?: Content[];
  html?: string;
  inReplyTo?: string;
  replyTo?: mailString;
  references?: string;
  priority?: "high" | "normal" | "low";
  attachments?: attachment[];
}

interface baseAttachment {
  contentType: string;
  filename: string;
}

type attachment = (
  | textAttachment
  | base64Attachment
  | arrayBufferLikeAttachment
) &
  baseAttachment;

type textAttachment = { encoding: "text"; content: string };
type base64Attachment = { encoding: "base64"; content: string };
type arrayBufferLikeAttachment = {
  content: ArrayBufferLike | Uint8Array;
  encoding: "binary";
};

interface Content {
  mimeType: string;
  content: string;
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
