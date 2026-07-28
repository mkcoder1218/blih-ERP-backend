import sanitizeHtml from 'sanitize-html';

export function sanitizeArticleContent(rawHtml: string | null | undefined): { content: string; contentText: string } {
  if (!rawHtml || typeof rawHtml !== 'string') {
    return { content: '', contentText: '' };
  }

  const sanitizedContent = sanitizeHtml(rawHtml, {
    allowedTags: [
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'b', 'i', 'strong', 'em', 'u', 's', 'strike', 'del',
      'ol', 'ul', 'li', 'blockquote',
      'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'pre', 'code', 'hr', 'br', 'span', 'div'
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      table: ['border', 'cellpadding', 'cellspacing'],
      th: ['colspan', 'rowspan', 'scope'],
      td: ['colspan', 'rowspan'],
      code: ['class'],
      pre: ['class']
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {
      a: ['http', 'https', 'mailto', 'tel']
    },
    transformTags: {
      a: (tagName, attribs) => {
        const newAttribs = { ...attribs };
        if (newAttribs.href) {
          newAttribs.rel = 'noopener noreferrer';
        }
        return {
          tagName: 'a',
          attribs: newAttribs
        };
      }
    }
  });

  // Extract searchable plain text by stripping all HTML tags
  const plainText = sanitizeHtml(sanitizedContent, {
    allowedTags: [],
    allowedAttributes: {}
  })
    .replace(/\s+/g, ' ')
    .trim();

  return {
    content: sanitizedContent,
    contentText: plainText
  };
}
