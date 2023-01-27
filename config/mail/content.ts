import {
  Attachment,
  resolveAttachment,
  ResolvedAttachment,
} from "./attachments.ts";
import { quotedPrintableEncode } from "./encoding.ts";

export interface Content {
  mimeType: string;
  content: string;
  transferEncoding?: string;
  relatedAttachments?: Attachment[];
}

export interface ResolvedContent {
  mimeType: string;
  content: string;
  transferEncoding?: string;
  relatedAttachments: ResolvedAttachment[];
}

export function resolveContent(content: Content): ResolvedContent {
  return {
    mimeType: content.mimeType,
    content: content.content,
    transferEncoding: content.transferEncoding,
    relatedAttachments: content.relatedAttachments
      ? content.relatedAttachments.map((v) => resolveAttachment(v))
      : [],
  };
}

export function resolveMessage({
  text,
  html,
  relatedAttachments,
  mimeContent,
}: {
  text?: string;
  html?: string;
  relatedAttachments?: Attachment[];
  mimeContent?: Content[];
}): ResolvedContent[] {
  const newContent = [...mimeContent ?? []].map((v) => resolveContent(v));

  if (text === "auto" && html) {
    text = html
      .replace(/<head((.|\n|\r)*?)<\/head>/g, "")
      .replace(/<style((.|\n|\r)*?)<\/style>/g, "")
      .replace(/<[^>]+>/g, "");
  }

  if (text) {
    newContent.push({
      mimeType: 'text/plain; charset="utf-8"',
      content: quotedPrintableEncode(text),
      transferEncoding: "quoted-printable",
      relatedAttachments: [],
    });
  }

  if (html) {
    newContent.push(resolveContent({
      mimeType: 'text/html; charset="utf-8"',
      content: quotedPrintableEncode(html),
      transferEncoding: "quoted-printable",
      relatedAttachments,
    }));
  }

  return newContent;
}
