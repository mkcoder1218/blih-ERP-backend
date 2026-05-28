export function renderOfferLetter(template: string, data: Record<string, string | number>): { renderedContent: string; missingVariables: string[] } {
  let renderedContent = template;
  const missingVariables: string[] = [];
  
  // Extract all placeholders like {{variableName}}
  const placeholderRegex = /\{\{\s*([\w]+)\s*\}\}/g;
  let match;
  
  const placeholders = new Set<string>();
  while ((match = placeholderRegex.exec(template)) !== null) {
    placeholders.add(match[1]);
  }
  
  // Replace placeholders
  for (const placeholder of placeholders) {
    if (data[placeholder] !== undefined && data[placeholder] !== null) {
      const regex = new RegExp(`\\{\\{\\s*${placeholder}\\s*\\}\\}`, 'g');
      renderedContent = renderedContent.replace(regex, String(data[placeholder]));
    } else {
      missingVariables.push(placeholder);
    }
  }
  
  return { renderedContent, missingVariables };
}
