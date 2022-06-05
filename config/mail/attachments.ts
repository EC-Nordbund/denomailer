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
    | base64Attachment
  )
  & baseAttachment;

type textAttachment = { encoding: "text"; content: string };
type base64Attachment = { encoding: "base64"; content: string };
type arrayBufferLikeAttachment = {
  content: ArrayBufferLike | Uint8Array;
  encoding: "binary";
};

export function resolveAttachment(attachment: Attachment): ResolvedAttachment {
    return attachment;
}
