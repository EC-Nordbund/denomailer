export { base64Decode } from "./deps.ts";

const encoder = new TextEncoder();

export function quotedPrintableEncode(data: string, encLB = false) {
  const encodedData = Array.from(data).map((ch, i) => {
    // For each char check decoding
    const encodedChar = encoder.encode(ch);

    if (encodedChar.length === 1) {
      const code = encodedChar[0];

      if (!encLB && (code === 10 || code === 13)) return ch;
      if (code === 9) return ch;
      if (code > 32 && code <= 126 && code !== 61) return ch;

      if (code === 32) {
        // When LB after space escape it!
        if (!encLB && (data[i + 1] === "\r" || data[i + 1] === "\n")) {
          return "=20";
        }
        return " ";
      }
    }

    let enc = "";
    encodedChar.forEach((i) => {
      enc += `=${i.toString(16)}`;
    });

    return enc;
  }).join("");

  let ret = "";
  const lines = Math.ceil(encodedData.length / 75) - 1;

  for (let i = 0; i < lines; i++) {
    const old = encodedData.slice(i * 75, (i + 1) * 75);

    if (old.endsWith("\r") || old.endsWith("\n")) {
      ret += old;
    }

    ret += `${old}=\r\n`;
  }

  // Add rest with no new line
  ret += encodedData.slice(lines * 75);

  return ret;
}
