import { assertEquals } from "https://deno.land/std@0.136.0/testing/asserts.ts";
import {base64Encode, base64EncodeInline, base64EncodeWrapLine} from "../../config/mail/encoding.ts";

Deno.test("test base64 encode ascii", () => {
  const encodedString = base64EncodeWrapLine("test");
  assertEquals(encodedString, "dGVzdA==");
});

Deno.test("test base64 encode multibyte('test' meaning in Japanese)", () => {
  const encodedString = base64EncodeWrapLine("テスト");
  assertEquals(encodedString, "44OG44K544OI");
});

Deno.test("test base64 encode multibyte multi lines", () => {
  const encodedString = base64EncodeWrapLine("これは日本語のメールだよ。QP対象のMultiByteが問題になっていたので日本語以外も同様のはず。");
  assertEquals(encodedString, "44GT44KM44Gv5pel5pys6Kqe44Gu44Oh44O844Or44Gg44KI44CCUVDlr77o\r\n" +
      "saHjga5NdWx0aUJ5dGXjgYzllY/poYzjgavjgarjgaPjgabjgYTjgZ/jga7j\r\n" +
      "gafml6XmnKzoqp7ku6XlpJbjgoLlkIzmp5jjga7jga/jgZrjgII=");
});

Deno.test("test base64 encode inline", () => {
  const encodedString = base64EncodeInline("test");
  assertEquals(encodedString, "=?utf-8?B?dGVzdA==?=");
});

Deno.test("test base64 encode inline multibytes", () => {
  const encodedString = base64EncodeInline("テスト");
  assertEquals(encodedString, "=?utf-8?B?44OG44K544OI?=");
});

Deno.test("test base64 encode inline multibytes and multi lines", () => {
  const encodedString = base64EncodeInline("これは日本語のメールだよ。QP対象のMultiByteが問題になっていたので日本語以外も同様のはず。");
  assertEquals(encodedString, "=?utf-8?B?44GT44KM44Gv5pel5pys6Kqe44Gu44Oh44O844Or44Gg44KI44CCUVDlr77o?=\r\n" +
      " =?utf-8?B?saHjga5NdWx0aUJ5dGXjgYzllY/poYzjgavjgarjgaPjgabjgYTjgZ/jga7j?=\r\n" +
      " =?utf-8?B?gafml6XmnKzoqp7ku6XlpJbjgoLlkIzmp5jjga7jga/jgZrjgII=?=");
});



