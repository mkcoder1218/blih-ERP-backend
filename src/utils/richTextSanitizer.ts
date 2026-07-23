import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "span",
  "div",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "hr",
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  "*": ["class", "style"],
  a: ["href", "target", "rel", "title"],
  table: [
    "border",
    "cellpadding",
    "cellspacing",
    "width",
    "align",
    "role",
  ],
  th: [
    "colspan",
    "rowspan",
    "width",
    "align",
  ],
  td: [
    "colspan",
    "rowspan",
    "width",
    "align",
  ],
};

const ALLOWED_STYLES: sanitizeHtml.IOptions["allowedStyles"] = {
  "*": {
    color: [
      /^#[0-9a-f]{3,8}$/i,
      /^rgb\([0-9,\s]+\)$/i,
      /^rgba\([0-9,\s.]+\)$/i,
      /^[a-z]+$/i,
    ],

    "background-color": [
      /^#[0-9a-f]{3,8}$/i,
      /^rgb\([0-9,\s]+\)$/i,
      /^rgba\([0-9,\s.]+\)$/i,
      /^[a-z]+$/i,
    ],

    "font-size": [
      /^\d+(\.\d+)?(px|pt|em|rem|%)$/i,
    ],

    "font-weight": [
      /^(normal|bold|bolder|lighter|\d{3})$/i,
    ],

    "font-style": [
      /^(normal|italic|oblique)$/i,
    ],

    "font-family": [
      /^[a-z0-9,\s"'_-]+$/i,
    ],

    "text-align": [
      /^(left|right|center|justify)$/i,
    ],

    "text-decoration": [
      /^(none|underline|line-through|overline)(\s+[a-z-]+)*$/i,
    ],

    "line-height": [
      /^\d+(\.\d+)?(px|em|rem|%)?$/i,
    ],

    margin: [
      /^[0-9.\s%-]+(px|em|rem|%)?$/i,
    ],

    "margin-top": [
      /^[0-9.]+(px|em|rem|%)$/i,
    ],

    "margin-right": [
      /^[0-9.]+(px|em|rem|%)$/i,
    ],

    "margin-bottom": [
      /^[0-9.]+(px|em|rem|%)$/i,
    ],

    "margin-left": [
      /^[0-9.]+(px|em|rem|%)$/i,
    ],

    padding: [
      /^[0-9.\s%-]+(px|em|rem|%)?$/i,
    ],

    "padding-top": [
      /^[0-9.]+(px|em|rem|%)$/i,
    ],

    "padding-right": [
      /^[0-9.]+(px|em|rem|%)$/i,
    ],

    "padding-bottom": [
      /^[0-9.]+(px|em|rem|%)$/i,
    ],

    "padding-left": [
      /^[0-9.]+(px|em|rem|%)$/i,
    ],

    border: [
      /^[0-9a-z#(),.\s%-]+$/i,
    ],

    "border-top": [
      /^[0-9a-z#(),.\s%-]+$/i,
    ],

    "border-right": [
      /^[0-9a-z#(),.\s%-]+$/i,
    ],

    "border-bottom": [
      /^[0-9a-z#(),.\s%-]+$/i,
    ],

    "border-left": [
      /^[0-9a-z#(),.\s%-]+$/i,
    ],

    "border-collapse": [
      /^(collapse|separate)$/i,
    ],

    "border-radius": [
      /^[0-9.\s%-]+(px|em|rem|%)?$/i,
    ],

    width: [
      /^[0-9.]+(px|em|rem|%)$/i,
    ],

    "max-width": [
      /^[0-9.]+(px|em|rem|%)$/i,
    ],

    "min-width": [
      /^[0-9.]+(px|em|rem|%)$/i,
    ],

    height: [
      /^[0-9.]+(px|em|rem|%)$/i,
    ],

    display: [
      /^(block|inline|inline-block|table|table-row|table-cell)$/i,
    ],

    "vertical-align": [
      /^(top|middle|bottom|baseline)$/i,
    ],

    "white-space": [
      /^(normal|nowrap|pre|pre-wrap|pre-line)$/i,
    ],
  },
};

export function sanitizeRichTextHtml(
  value: unknown,
): string {
  if (typeof value !== "string") {
    return "";
  }

  return sanitizeHtml(value, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedStyles: ALLOWED_STYLES,

    allowedSchemes: [
      "http",
      "https",
      "mailto",
      "tel",
    ],

    allowedSchemesByTag: {
      a: [
        "http",
        "https",
        "mailto",
        "tel",
      ],
    },

    allowProtocolRelative: false,
    enforceHtmlBoundary: true,

    transformTags: {
      a: sanitizeHtml.simpleTransform(
        "a",
        {
          target: "_blank",
          rel: "noopener noreferrer",
        },
        true,
      ),
    },
  }).trim();
}

export function richTextToPlainText(
  value: unknown,
): string {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    return "";
  }

  const safeHtml =
    sanitizeRichTextHtml(value);

  return sanitizeHtml(safeHtml, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasMeaningfulRichText(
  value: unknown,
): boolean {
  return (
    richTextToPlainText(value).length > 0
  );
}
