const HTML_LIKE_PATTERN = /<\/?[a-z][\s\S]*>/i;
const MARKDOWN_LIKE_PATTERN = /(^|\n)\s*(#{1,3}\s+|[-*]\s+|\d+\.\s+|\*\*[^*]+\*\*|---+\s*$)/m;

const escapeHtml = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const applyInlineMarkdown = (value) =>
  escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");

const markdownToHtml = (value) => {
  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  const html = [];
  let listType = null;

  const closeList = () => {
    if (!listType) return;
    html.push(listType === "ul" ? "</ul>" : "</ol>");
    listType = null;
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      return;
    }

    if (/^---+$/.test(trimmed)) {
      closeList();
      html.push("<hr>");
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      const level = Math.min(headingMatch[1].length, 3);
      html.push(`<h${level}>${applyInlineMarkdown(headingMatch[2])}</h${level}>`);
      return;
    }

    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      if (listType !== "ol") {
        closeList();
        html.push("<ol>");
        listType = "ol";
      }
      html.push(`<li>${applyInlineMarkdown(orderedMatch[2])}</li>`);
      return;
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (unorderedMatch) {
      if (listType !== "ul") {
        closeList();
        html.push("<ul>");
        listType = "ul";
      }
      html.push(`<li>${applyInlineMarkdown(unorderedMatch[1])}</li>`);
      return;
    }

    closeList();
    html.push(`<p>${applyInlineMarkdown(trimmed)}</p>`);
  });

  closeList();
  return html.join("");
};

export const toRichTextHtml = (value) => {
  const text = typeof value === "string" ? value : "";
  if (!text) return "";
  if (HTML_LIKE_PATTERN.test(text) || text.includes("&nbsp;")) return text;
  if (MARKDOWN_LIKE_PATTERN.test(text)) return markdownToHtml(text);
  return escapeHtml(text).replace(/\n/g, "<br>");
};

export const isRichTextEmpty = (value) => {
  const html = typeof value === "string" ? value : "";
  if (!html) return true;

  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|li|h1|h2|h3|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();

  return text.length === 0;
};
