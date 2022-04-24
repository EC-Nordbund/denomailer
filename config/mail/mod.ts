import { Attachment, ResolvedAttachment, resolveAttachment } from "./attachments.ts";
import { Content, resolveContent } from "./content.ts";
import { mailList, saveMailObject, parseSingleEmail, parseMailList, validateEmailList, isSingleMail } from "./email.ts";
import { ResolvedClientOptions } from "../client/mod.ts";

export interface SendConfig {
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
  replyTo?: string;
  references?: string;
  priority?: "high" | "normal" | "low";
  attachments?: Attachment[];
  internalTag?: string | symbol
}


export interface ResolvedSendConfig {
  to: saveMailObject[];
  cc: saveMailObject[];
  bcc: saveMailObject[];
  from: saveMailObject;
  date: string;
  subject: string;
  mimeContent: Content[];
  inReplyTo?: string;
  replyTo?: saveMailObject;
  references?: string;
  priority?: "high" | "normal" | "low";
  attachments: ResolvedAttachment[];
  internalTag?: string | symbol
}

export function resolveSendConfig(config: SendConfig): ResolvedSendConfig {
  const {
    to,
    cc = [],
    bcc = [],
    from,
    date = new Date().toUTCString().split(",")[1].slice(1),
    subject,
    content,
    mimeContent,
    html,
    inReplyTo,
    replyTo,
    references,
    priority,
    attachments,
    internalTag
  } = config

  return {
    to: parseMailList(to),
    cc: parseMailList(cc),
    bcc: parseMailList(bcc),
    from: parseSingleEmail(from),
    date,
    mimeContent: resolveContent({
      mimeContent,
      html,
      text: content
    }),
    replyTo: replyTo ? parseSingleEmail(replyTo) : undefined,
    inReplyTo,
    subject,
    attachments: attachments ? attachments.map(attachment => resolveAttachment(attachment)) : [],
    references,
    priority,
    internalTag
  }
}

export function validateConfig(config: ResolvedSendConfig, client: ResolvedClientOptions): ResolvedSendConfig {
  const errors: string[] = []
  const warn: string[] = []

  if(!isSingleMail(config.from.mail)) {
    errors.push(`The specified from adress is not a valid email adress.`)
  }

  if(config.replyTo && !isSingleMail(config.replyTo.mail)) {
    errors.push(`The specified replyTo adress is not a valid email adress.`)
  }

  const valTo = validateEmailList(config.to)

  if(valTo.bad.length > 0) {
    config.to = valTo.ok

    valTo.bad.forEach(m => {
      warn.push(`TO Email ${m.mail} is not valid!`)
    })
  }

  const valCc = validateEmailList(config.cc)

  if(valCc.bad.length > 0) {
    config.to = valCc.ok

    valCc.bad.forEach(m => {
      warn.push(`CC Email ${m.mail} is not valid!`)
    })
  }

  const valBcc = validateEmailList(config.bcc)

  if(valBcc.bad.length > 0) {
    config.to = valBcc.ok

    valBcc.bad.forEach(m => {
      warn.push(`BCC Email ${m.mail} is not valid!`)
    })
  }

  if(config.to.length + config.cc.length + config.bcc.length === 0) {
    errors.push(`No valid emails provided!`)
  }

  if(config.mimeContent.length === 0) {
    errors.push(`No content provided!`)
  }

  if(!config.mimeContent.some(v=>v.mimeType.trim() === 'text/html' || v.mimeType.trim() === 'text/plain')) {
    warn.push('You shoukd provide at least html or text content!')
  }

  if(client.client.warning === 'log' && warn.length > 0) console.warn(warn.join('\n'))
  
  if(client.client.warning === 'error') {
    errors.push(...warn)
  }

  if(errors.length > 0) {
    throw new Error(errors.join('\n'))
  }

  return config
}
