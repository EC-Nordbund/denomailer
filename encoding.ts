export { base64Decode } from "./deps.ts";

const encoder = new TextEncoder();

export function quotedPrintableEncode(data: string, encLB = false) {
  data.replaceAll('=', '=3D')

  if (!encLB) {
    data = data.replaceAll(" \r\n", "=20\r\n").replaceAll(" \n", "=20\n");
  }

  const encodedData = Array.from(data).map((ch) => {
    // For each char check decoding
    const encodedChar = encoder.encode(ch);

    if (encodedChar.length === 1) {
      const code = encodedChar[0];

      if (code >= 32 && code <= 126 && code !== 61) return ch;
      if (!encLB && (code === 10 || code === 13)) return ch;
      if (code === 9) return ch;
    }

    let enc = "";
    encodedChar.forEach((i) => {
      let c = i.toString(16)
      if(c.length === 1) c = '0' + c
      enc += `=${c}`;
    });

    return enc;
  }).join("");

  let ret = "";
  const lines = Math.ceil(encodedData.length / 74) - 1;

  let offset = 0
  for (let i = 0; i < lines; i++) {
    let old = encodedData.slice(i * 74 + offset, (i + 1) * 74);
    offset = 0

    if(old.at(-1) === '=') {
      old = old.slice(0, old.length - 1)
      offset = -1
    }

    if(old.at(-2) === '=') {
      old = old.slice(0, old.length - 2)
      offset = -2
    }

    if (old.endsWith("\r") || old.endsWith("\n")) {
      ret += old;
    }

    ret += `${old}=\r\n`;
  }

  // Add rest with no new line
  ret += encodedData.slice(lines * 74);

  return ret;
}
