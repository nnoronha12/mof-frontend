/**
 * Text direction from the content itself, so an English answer stays
 * left-to-right in the Arabic portal and an Arabic answer or table renders
 * right-to-left in the English portal.
 */

export type TextDirection = "rtl" | "ltr";

const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LATIN_SCRIPT = /[A-Za-z\u00C0-\u024F]/;

/**
 * "rtl" when at least as many words contain Arabic letters as Latin letters,
 * "ltr" when Latin words are the majority, and undefined when the text has no
 * letters (numbers, emoji), so the element keeps the surrounding direction.
 * Same rule as the REPLY LANGUAGE the chat workflows compute.
 */
export const detectTextDirection = (text: string): TextDirection | undefined => {
  let arabic = 0;
  let latin = 0;
  for (const word of text.split(/\s+/)) {
    if (ARABIC_SCRIPT.test(word)) arabic += 1;
    else if (LATIN_SCRIPT.test(word)) latin += 1;
  }
  if (!arabic && !latin) return undefined;
  return arabic >= latin ? "rtl" : "ltr";
};

/** Plain text of an HTML or markdown string, for direction detection only. */
export const textFromMarkup = (markup: string) =>
  markup
    .replace(/<(code|pre|style|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ");

interface HastLike {
  type?: string;
  tagName?: string;
  value?: string;
  children?: HastLike[];
}

/**
 * Text of a react-markdown (hast) node. Code is skipped by default, so a code
 * span does not decide the direction of the paragraph around it; pass
 * includeCode for a block whose own content should decide.
 */
export const textFromHast = (node: HastLike | undefined, includeCode = false): string => {
  if (!node) return "";
  if (node.type === "text") return node.value ?? "";
  if (!includeCode && (node.tagName === "code" || node.tagName === "pre")) return "";
  return (node.children ?? []).map((child) => textFromHast(child, includeCode)).join(" ");
};
