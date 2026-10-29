/**
 * Copying chat answers.
 *
 * The Clipboard API exists only in secure contexts, and inside an embedded
 * frame or a mobile WebView it also needs the clipboard-write permission. When
 * it is missing or refuses, fall back to the copy command on a hidden textarea,
 * which works in those places too.
 */
export const copyText = async (text: string): Promise<boolean> => {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or document not focused: try the fallback below.
    }
  }

  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "0";
  area.style.opacity = "0";
  area.style.pointerEvents = "none";
  document.body.appendChild(area);

  const selection = document.getSelection();
  const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  const previousFocus = document.activeElement as HTMLElement | null;

  area.focus();
  area.select();
  area.setSelectionRange(0, text.length);
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  area.remove();

  if (selection && previousRange) {
    selection.removeAllRanges();
    selection.addRange(previousRange);
  }
  previousFocus?.focus?.();
  return copied;
};

/**
 * Answers are HTML but are parsed as Markdown, and Markdown ends an HTML block
 * at the first blank line. A <pre> block with blank lines (a drafted email) was
 * split: its paragraphs became <p> elements and its blank lines and indentation
 * were lost. Writing the line breaks inside <pre> as &#10; keeps the block whole;
 * the browser turns the entity back into a line break.
 */
export const protectPreBlocks = (html: string): string =>
  html.replace(/(<pre\b[^>]*>)([\s\S]*?)(<\/pre>)/gi, (_match, open: string, body: string, close: string) =>
    open + body.replace(/\r?\n/g, "&#10;") + close);

const BLOCK_TAGS = new Set([
  "P", "DIV", "SECTION", "ARTICLE", "HEADER", "FOOTER", "BLOCKQUOTE",
  "H1", "H2", "H3", "H4", "H5", "H6", "TABLE", "UL", "OL", "HR",
]);

const LIST_MARKER = /^(• |\d+\. )$/;

/**
 * Plain text of an answer's HTML that keeps its shape: one line per paragraph
 * or heading, "• " or "1. " before list items, tab-separated table cells (they
 * paste into Excel as columns), and <pre> text (drafted emails) unchanged.
 */
export const htmlToPlainText = (root: Node): string => {
  const out: string[] = [];
  const newline = () => {
    if (out.length && !out[out.length - 1].endsWith("\n")) out.push("\n");
  };

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      let value = (node.nodeValue ?? "").replace(/\s+/g, " ");
      // No leading space at the start of a line or right after a list marker.
      const last = out.length ? out[out.length - 1] : "\n";
      if (last.endsWith("\n") || LIST_MARKER.test(last)) value = value.trimStart();
      if (value) out.push(value);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName;

    if (tag === "BR") {
      out.push("\n");
      return;
    }
    if (tag === "SCRIPT" || tag === "STYLE") return;
    if (tag === "PRE") {
      newline();
      out.push((el.textContent ?? "").trimEnd(), "\n");
      return;
    }
    if (tag === "LI") {
      newline();
      const list = el.parentElement;
      out.push(list?.tagName === "OL" ? `${Array.from(list.children).indexOf(el) + 1}. ` : "• ");
      el.childNodes.forEach(walk);
      newline();
      return;
    }
    if (tag === "TR") {
      newline();
      const cells = Array.from(el.children).filter((cell) => cell.tagName === "TD" || cell.tagName === "TH");
      const cellText = (cell: Element) => htmlToPlainText(cell).split("\n").map((part) => part.trim()).filter(Boolean).join(" ");
      out.push(cells.map(cellText).join("\t"), "\n");
      return;
    }

    const block = BLOCK_TAGS.has(tag);
    if (block) newline();
    el.childNodes.forEach(walk);
    if (block) newline();
  };

  walk(root);
  return out
    .join("")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};
