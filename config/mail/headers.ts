export interface Headers {
  [headerName: string]: string;
}

export function validateHeaders(
  headers: Headers,
) {
  return !(Object.keys(headers).some((v) =>
    v.includes("\n") || v.includes("\r")
  ) || Object.values(headers).some((v) => v.includes("\n") || v.includes("\r")));
}
