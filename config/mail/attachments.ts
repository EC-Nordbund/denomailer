import { base64Encode } from "./encoding.ts";

interface baseAttachment {
  contentType: string;
  filename: string;
  contentID?: string | number;
}

export type Attachment =
  & (
    | textAttachment
    | base64Attachment
    | arrayBufferLikeAttachment
  )
  & baseAttachment
  & { contentDisposition?: "attachment" | "inline" };

export type ResolvedAttachment =
  & (
    | textAttachment
    | base64Attachment
  )
  & baseAttachment
  & { contentDisposition: "attachment" | "inline" };

type textAttachment = { encoding: "text"; content: string };
type base64Attachment = { encoding: "base64"; content: string };
type arrayBufferLikeAttachment = {
  content: ArrayBufferLike | Uint8Array;
  encoding: "binary";
};

export function resolveAttachment(attachment: Attachment): ResolvedAttachment {
  if (attachment.encoding === "binary") {
    return {
      filename: attachment.filename,
      contentType: attachment.contentType,
      encoding: "base64",
      content: base64Encode(attachment.content),
      contentDisposition: attachment.contentDisposition ?? "attachment",
    };
  } else {
    return {
      filename: attachment.filename,
      contentType: attachment.contentType,
      encoding: attachment.encoding,
      content: attachment.content,
      contentDisposition: attachment.contentDisposition ?? "attachment",
    };
  }
}
