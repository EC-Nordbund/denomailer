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
  onlySecure?: boolean
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
  transferEncoding?: string
}

export type mailString = string;
export type email = string;
export type emailWithName = string;
export type wrapedMail = string;

export interface mailObject {
  mail: string;
  name?: string;
}

export type mail = string | mailObject;
export type mailListObject = Omit<Record<string, email>, "name" | "mail">;
export type mailList = mailListObject | mail[] | mail;

export type { ConnectConfig, ConnectConfigWithAuthentication, SendConfig };

function isMail(mail: string) {
  return /[^<>()\[\]\\,;:\s@"]+@[a-zA-Z0-9]+\.([a-zA-Z0-9\-]+\.)*[a-zA-Z]{2,}$/.test(mail)
}

function isSingleMail(mail:string) {
  return /^(([^<>()\[\]\\,;:\s@"]+@[a-zA-Z0-9\-]+\.([a-zA-Z0-9\-]+\.)*[a-zA-Z]{2,})|(<[^<>()\[\]\\,;:\s@"]+@[a-zA-Z0-9]+\.([a-zA-Z0-9\-]+\.)*[a-zA-Z]{2,}>)|([^<>]+ <[^<>()\[\]\\,;:\s@"]+@[a-zA-Z0-9]+\.([a-zA-Z0-9\-]+\.)*[a-zA-Z]{2,}>))$/.test(mail)
}

export function validateConfig(config: SendConfig) {
  if(config.from) {
    if(!isSingleMail(config.from)) throw new Error("Mail From is not a valid E-Mail.");
  }

  if(!validateMailList(config.to)) throw new Error("Mail TO is not a valid E-Mail.");
  

  if(config.cc && !validateMailList(config.cc))  throw new Error("Mail CC is not a valid E-Mail.");
  if(config.bcc && !validateMailList(config.bcc))  throw new Error("Mail BCC is not a valid E-Mail.");

  if(config.replyTo && !isSingleMail(config.replyTo)) throw new Error("Mail ReplyTo is not a valid E-Mail.");

  return true;
}

function validateMailList(mailList: mailList) {
  if(typeof mailList === 'string') return isSingleMail(mailList)

  if(Array.isArray(mailList)) return !mailList.some(m => {
    if(typeof m === 'string') return !isSingleMail(m);
    return !isMail(m.mail)
  })

  if((Object.keys(mailList).length === 1 && mailList.mail )|| (Object.keys(mailList).length === 2 && mailList.mail && mailList.name)) return isMail(mailList.mail)

  return !Object.values(mailList).some(m => !isSingleMail(m))
}