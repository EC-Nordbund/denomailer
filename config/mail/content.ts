import { quotedPrintableEncode } from "./encoding.ts";

export interface Content {
  mimeType: string;
  content: string;
  transferEncoding?: string;
}

export function resolveContent({
    text,
    html,
    mimeContent
  }: {
    text?: string,
    html?: string,
    mimeContent?: Content[]
  }): Content[] {
  const newContent = [...mimeContent ?? []]

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
    });
  }

  if (html) {
    newContent.push({
      mimeType: 'text/html; charset="utf-8"',
      content: quotedPrintableEncode(html),
      transferEncoding: "quoted-printable",
    });
  
  }

  return newContent
}