import { quotedPrintableEncode } from "./encoding.ts";

// console.log(quotedPrintableEncode('abc'))
// console.log(quotedPrintableEncode('abcß2`öäü dsd sd 😉'))

// console.log(quotedPrintableEncode(
//   `Hätten Hüte ein ß im Namen, wären sie möglicherweise keine Hüte mehr,
// sondern Hüße.`
// ))

// console.log(quotedPrintableEncode('abc', true))
// console.log(quotedPrintableEncode('abcß2`öäü dsd sd 😉', true))

// console.log(quotedPrintableEncode(
//   `Hätten Hüte ein ß im Namen, wären sie möglicherweise keine Hüte mehr,
// sondern Hüße.`, true
// ))

// console.log(quotedPrintableEncode(`J'interdis aux marchands de vanter trop leurs marchandises. Car ils se font vite pédagogues et t'enseignent comme but ce qui n'est par essence qu'un moyen, et te trompant ainsi sur la route à suivre les voilà bientôt qui te dégradent, car si leur musique est vulgaire ils te fabriquent pour te la vendre une âme vulgaire.`))

const strings = [
  `Hätten Hüte ein ß im Namen, wären sie möglicherweise keine Hüte mehr,
sondern Hüße.`,
  "abc",
  "abcß2`öäü dsd sd 😉",
  `J'interdis aux marchands de vanter trop leurs marchandises. Car ils se font vite pédagogues et t'enseignent comme but ce qui n'est par essence qu'un moyen, et te trompant ainsi sur la route à suivre les voilà bientôt qui te dégradent, car si leur musique est vulgaire ils te fabriquent pour te la vendre une âme vulgaire.`,
  "😉",
];

strings.forEach((s) => {
  console.log(s);
  console.log(quotedPrintableEncode(s));
  console.log(quotedPrintableDecode(quotedPrintableEncode(s)));
  console.log(quotedPrintableDecode(quotedPrintableEncode(s)) == s);
});
