import {mimeEncode, quotedPrintableEncode} from "./encoding.ts";

export interface Content {
  mimeType: string;
  content: string;
  transferEncoding?: string;
}

export function resolveContent({
  text,
  html,
  mimeContent,
  mimeEncoding
}: {
  text?: string;
  html?: string;
  mimeContent?: Content[];
  mimeEncoding?: "quoted-printable" | "base64";
}): Content[] {
  const newContent = [...mimeContent ?? []];

  if (text === "auto" && html) {
    text = html
      .replace(/<head((.|\n|\r)*?)<\/head>/g, "")
      .replace(/<style((.|\n|\r)*?)<\/style>/g, "")
      .replace(/<[^>]+>/g, "");
  }

  if (text) {
    newContent.push({
      mimeType: 'text/plain; charset="utf-8"',
      content: mimeEncode(text, mimeEncoding),
      transferEncoding: mimeEncoding,
    });
  }

  if (html) {
    newContent.push({
      mimeType: 'text/html; charset="utf-8"',
      content: mimeEncode(html),
      transferEncoding: mimeEncoding,
    });
  }

  return newContent;
}
