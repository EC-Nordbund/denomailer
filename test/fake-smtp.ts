interface MailAdresses {
  value: { address: string; name: string }[];
  html: string;
  text: string;
}

export function getEmails(): Promise<
  {
    // deno-lint-ignore no-explicit-any
    attachments: any[];
    headerLines: { key: string; line: string }[];
    text: string;
    textAsHtml: string;
    subject: string;
    date: string;
    to: MailAdresses;
    from: MailAdresses;
    html: false | string;
  }[]
> {
  return fetch("http://localhost:1080/api/emails", {
    method: "get",
  }).then((v) => v.json());
}

export function clearEmails() {
  return fetch("http://localhost:1080/api/emails", { method: "delete" }).then(
    (v) => v.arrayBuffer(),
  );
}
