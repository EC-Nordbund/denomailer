import { base64Decode } from "./encoding.ts";

interface baseAttachment {
  contentType: string;
  filename: string;
}

export type Attachment =
  & (
    | textAttachment
    | base64Attachment
    | arrayBufferLikeAttachment
  )
  & baseAttachment;

export type ResolvedAttachment =
  & (
    | textAttachment
    | arrayBufferLikeAttachment
  )
  & baseAttachment

type textAttachment = { encoding: "text"; content: string };
type base64Attachment = { encoding: "base64"; content: string };
type arrayBufferLikeAttachment = {
  content: ArrayBufferLike | Uint8Array;
  encoding: "binary";
};

export function resolveAttachment(attachment: Attachment): ResolvedAttachment {
  if(attachment.encoding === 'base64') {
    return {
      filename: attachment.filename,
      contentType: attachment.contentType,
      encoding: 'binary',
      content: base64Decode(attachment.content)
    }
  } else {
    return attachment
  }
}