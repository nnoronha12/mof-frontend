/** Media type for HTML opened or saved as a file. Without the charset the browser may decode UTF-8 as Windows-1252. */
export const HTML_FILE_TYPE = 'text/html;charset=utf-8';

/** Sanitising removes <meta charset>; put it back so a saved or opened copy is read as UTF-8. */
export const ensureUtf8Charset = (html: string): string => {
  if (/<meta[^>]+charset\s*=/i.test(html)) return html;
  const meta = '<meta charset="utf-8">';
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (head) => head + meta);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (tag) => tag + '<head>' + meta + '</head>');
  return meta + html;
};
