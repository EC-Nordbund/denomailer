export interface mailObject {
  mail: string;
  name?: string;
}
export interface saveMailObject {
  mail: string;
  name: string;
}
type singleMail = string | mailObject;
type mailListObject = Omit<Record<string, string>, "name" | "mail">;
export type mailList =
  | mailListObject
  | singleMail
  | singleMail[]
  | mailObject[];

export function isSingleMail(mail: string) {
  return /^(([^<>()\[\]\\,;:\s@"]+@[a-zA-Z0-9\-]+\.([a-zA-Z0-9\-]+\.)*[a-zA-Z]{2,})|(<[^<>()\[\]\\,;:\s@"]+@[a-zA-Z0-9]+\.([a-zA-Z0-9\-]+\.)*[a-zA-Z]{2,}>)|([^<>]+ <[^<>()\[\]\\,;:\s@"]+@[a-zA-Z0-9]+\.([a-zA-Z0-9\-]+\.)*[a-zA-Z]{2,}>))$/
    .test(mail);
}

export function parseSingleEmail(mail: singleMail): saveMailObject {
  if (typeof mail !== "string") {
    return {
      mail: mail.mail,
      name: mail.name ?? "",
    };
  }

  const mailSplitRe = /^([^<]*)<([^>]+)>\s*$/;

  const res = mailSplitRe.exec(mail);

  if (!res) {
    return {
      mail,
      name: "",
    };
  }

  const [_, name, email] = res;

  return {
    name: name.trim(),
    mail: email.trim(),
  };
}

export function parseMailList(list: mailList): saveMailObject[] {
  if (typeof list === "string") return [parseSingleEmail(list)];
  if (Array.isArray(list)) return list.map((v) => parseSingleEmail(v));

  if ("mail" in list) {
    return [{
      mail: list.mail,
      name: list.name ?? "",
    }];
  }

  return Object.entries(list as mailListObject).map(([name, mail]) => ({
    name,
    mail,
  }));
}

export function validateEmailList(
  list: saveMailObject[],
): { ok: saveMailObject[]; bad: saveMailObject[] } {
  const ok: saveMailObject[] = [];
  const bad: saveMailObject[] = [];

  list.forEach((mail) => {
    if (isSingleMail(mail.mail)) {
      ok.push(mail);
    } else {
      bad.push(mail);
    }
  });

  return { ok, bad };
}
