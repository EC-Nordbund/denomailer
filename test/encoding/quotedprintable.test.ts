import { assertEquals } from "https://deno.land/std@0.136.0/testing/asserts.ts";
import {quotedPrintableEncode, quotedPrintableEncodeInline} from "../../config/mail/encoding.ts";

Deno.test("test quoted-printable encode ascii", () => {
  const encodedString = quotedPrintableEncode("test");
  assertEquals(encodedString, "test");
});

Deno.test("test quoted-printable encode multibyte('test' meaning in Japanese)", () => {
  const encodedString = quotedPrintableEncode("テスト");
  assertEquals(encodedString, "=e3=83=86=e3=82=b9=e3=83=88");
});

Deno.test("test quoted-printable encode multibyte('mail' meaning in Japanese)", () => {
  const encodedString = quotedPrintableEncode("メール");
  assertEquals(encodedString, "=e3=83=a1=e3=83=bc=e3=83=ab");
});

Deno.test("test quoted-printable encode multibyte bug@1.6.0", () => {
  const encodedString = quotedPrintableEncode("これは日本語のメールだよ");
  assertEquals(encodedString, "=e3=81=93=e3=82=8c=e3=81=af=e6=97=a5=e6=9c=ac=e8=aa=9e=e3=81=ae=e3=83=a1=\r\n=e3=83=bc=e3=83=ab=e3=81=a0=e3=82=88");
});

Deno.test("test quoted-printable encode multibyte offset check +1 bug@1.6.0", () => {
  const encodedString = quotedPrintableEncode("1これは日本語のメールだよ");
  assertEquals(encodedString, "1=e3=81=93=e3=82=8c=e3=81=af=e6=97=a5=e6=9c=ac=e8=aa=9e=e3=81=ae=e3=83=a1=\r\n=e3=83=bc=e3=83=ab=e3=81=a0=e3=82=88");
});

Deno.test("test quoted-printable encode multibyte offset check +2 bug@1.6.0", () => {
  const encodedString = quotedPrintableEncode("12これは日本語のメールだよ");
  assertEquals(encodedString, "12=e3=81=93=e3=82=8c=e3=81=af=e6=97=a5=e6=9c=ac=e8=aa=9e=e3=81=ae=e3=83=a1=\r\n=e3=83=bc=e3=83=ab=e3=81=a0=e3=82=88");
});

Deno.test("test quoted-printable encode multibyte offset check +3 bug@1.6.0", () => {
  const encodedString = quotedPrintableEncode("123これは日本語のメールだよ");
  assertEquals(encodedString, "123=e3=81=93=e3=82=8c=e3=81=af=e6=97=a5=e6=9c=ac=e8=aa=9e=e3=81=ae=e3=83=\r\n=a1=e3=83=bc=e3=83=ab=e3=81=a0=e3=82=88");
});

Deno.test("test quoted-printable encode multibyte bug@1.6.0 multi lines", () => {
  const encodedString = quotedPrintableEncode("これは日本語のメールだよ。QP対象のMultiByteが問題になっていたので日本語以外も同様のはず。");
  assertEquals(encodedString, "=e3=81=93=e3=82=8c=e3=81=af=e6=97=a5=e6=9c=ac=e8=aa=9e=e3=81=ae=e3=83=a1=\r\n"
      + "=e3=83=bc=e3=83=ab=e3=81=a0=e3=82=88=e3=80=82QP=e5=af=be=e8=b1=a1=e3=81=aeMu=\r\n"
      + "ltiByte=e3=81=8c=e5=95=8f=e9=a1=8c=e3=81=ab=e3=81=aa=e3=81=a3=e3=81=a6=e3=\r\n"
      + "=81=84=e3=81=9f=e3=81=ae=e3=81=a7=e6=97=a5=e6=9c=ac=e8=aa=9e=e4=bb=a5=e5=a4=\r\n"
      + "=96=e3=82=82=e5=90=8c=e6=a7=98=e3=81=ae=e3=81=af=e3=81=9a=e3=80=82");

});

Deno.test("test quoted-printable encode inline", () => {
  const encodedString = quotedPrintableEncodeInline("test");
  assertEquals(encodedString, "test");
});

Deno.test("test quoted-printable encode inline multibytes", () => {
  const encodedString = quotedPrintableEncodeInline("テスト");
  assertEquals(encodedString, "=?utf-8?Q?=e3=83=86=e3=82=b9=e3=83=88?=");
});

Deno.test("test quoted-printable encode inline multibytes and multi lines", () => {
  const encodedString = quotedPrintableEncodeInline("これは日本語のメールだよ");
  assertEquals(encodedString, "=?utf-8?Q?=e3=81=93=e3=82=8c=e3=81=af=e6=97=a5=e6=9c=ac=e8=aa=9e=e3=81=ae=e3=83=a1=?=\r\n" +
      " =?utf-8?Q?=e3=83=bc=e3=83=ab=e3=81=a0=e3=82=88?=");
});