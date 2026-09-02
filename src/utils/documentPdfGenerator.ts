import puppeteer from "puppeteer";
import sanitizeHtml from "sanitize-html";

export type DocumentPdfInput = {
  title?: string;
  bodyHtml: string;
  headerHtml?: string | null;
  footerHtml?: string | null;
};

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    "img",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "colgroup",
    "col",
    "section",
    "article",
    "header",
    "footer",
  ],
  allowedAttributes: {
    "*": ["style", "class", "align", "colspan", "rowspan"],
    a: ["href", "name", "target", "rel", "style", "class"],
    img: ["src", "alt", "width", "height", "style", "class"],
    table: ["width", "cellpadding", "cellspacing", "border", "style", "class"],
    col: ["width", "style", "class"],
  },
  allowedSchemes: ["http", "https", "data", "mailto"],
  allowedSchemesByTag: {
    img: ["http", "https", "data"],
  },
};

function cleanHtml(value?: string | null) {
  return sanitizeHtml(String(value || ""), SANITIZE_OPTIONS);
}

function htmlDocument(title: string, bodyHtml: string) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: Arial, Helvetica, sans-serif;
        color: #172033;
        font-size: 11pt;
        line-height: 1.5;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      p { margin: 0 0 10px; }
      h1, h2, h3, h4 { color: #111827; page-break-after: avoid; }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 14px 0;
        font-size: 10pt;
      }
      th, td {
        border: 1px solid #dbe2ea;
        padding: 8px 9px;
        vertical-align: top;
        text-align: left;
      }
      th {
        background: #f4f7fb;
        color: #344054;
        font-weight: 700;
      }
      tr { page-break-inside: avoid; }
      img { max-width: 100%; }
      a { color: inherit; }
    </style>
  </head>
  <body>${bodyHtml}</body>
</html>`;
}

function chromeMarginTemplate(html: string, position: "header" | "footer") {
  if (!html.trim()) return "<span></span>";
  const alignment = position === "header" ? "flex-start" : "flex-end";
  return `
    <div style="width:100%; padding:0 18mm; font-family:Arial,Helvetica,sans-serif; color:#475467; font-size:9pt; display:flex; align-items:${alignment};">
      <div style="width:100%;">${html}</div>
    </div>
  `;
}

export async function generateDocumentPdf(input: DocumentPdfInput): Promise<Buffer> {
  const bodyHtml = cleanHtml(input.bodyHtml);
  const headerHtml = cleanHtml(input.headerHtml);
  const footerHtml = cleanHtml(input.footerHtml);
  const hasHeader = Boolean(headerHtml.trim());
  const hasFooter = Boolean(footerHtml.trim());

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(
      htmlDocument(cleanHtml(input.title || "Document"), bodyHtml),
      { waitUntil: "networkidle0" },
    );

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: hasHeader || hasFooter,
      headerTemplate: chromeMarginTemplate(headerHtml, "header"),
      footerTemplate: chromeMarginTemplate(footerHtml, "footer"),
      margin: {
        top: hasHeader ? "34mm" : "22mm",
        right: "18mm",
        bottom: hasFooter ? "32mm" : "22mm",
        left: "18mm",
      },
    });

    return Buffer.from(pdf);
  } finally {
    if (browser) await browser.close();
  }
}
