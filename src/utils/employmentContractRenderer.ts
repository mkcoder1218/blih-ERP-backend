import {
  richTextToPlainText,
  sanitizeRichTextHtml,
} from "./richTextSanitizer";

export type EmploymentContractRenderValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined;

export type EmploymentContractRenderData =
  Record<
    string,
    EmploymentContractRenderValue
  >;

export interface RenderEmploymentContractResult {
  renderedContent: string;
  missingVariables: string[];
  usedVariables: string[];
}

export interface RenderEmploymentContractDocumentResult {
  renderedSubject: string;
  renderedHtml: string;
  renderedText: string;
  missingVariables: string[];
  usedVariables: string[];
}

const PLACEHOLDER_PATTERN =
  /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

export const EMPLOYMENT_CONTRACT_VARIABLES = [
  "contractNumber",
  "candidateName",
  "candidateEmail",
  "candidatePhone",
  "employeeName",
  "employeeEmail",
  "companyName",
  "companyAddress",
  "jobTitle",
  "positionName",
  "departmentName",
  "managerName",
  "salary",
  "currency",
  "formattedSalary",
  "employmentType",
  "contractType",
  "workLocation",
  "startDate",
  "endDate",
  "probationStartDate",
  "probationEndDate",
  "noticePeriodDays",
  "createdDate",
] as const;

function escapeHtml(
  value: string,
): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatValue(
  value: EmploymentContractRenderValue,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (value instanceof Date) {
    return value
      .toISOString()
      .slice(0, 10);
  }

  if (typeof value === "boolean") {
    return value
      ? "Yes"
      : "No";
  }

  return String(value);
}

function extractVariables(
  template: string,
): string[] {
  const variables =
    new Set<string>();

  let match: RegExpExecArray | null;

  PLACEHOLDER_PATTERN.lastIndex = 0;

  while (
    (
      match =
        PLACEHOLDER_PATTERN.exec(
          template,
        )
    ) !== null
  ) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

function escapeRegex(
  value: string,
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

export function renderEmploymentContractTemplate(
  template: string,
  data: EmploymentContractRenderData,
  options?: {
    sanitizeHtml?: boolean;
    escapeValues?: boolean;
  },
): RenderEmploymentContractResult {
  const source =
    String(template || "");

  const variables =
    extractVariables(source);

  const missingVariables: string[] = [];

  let renderedContent = source;

  for (const variable of variables) {
    const rawValue =
      data[variable];

    const isMissing =
      rawValue === null ||
      rawValue === undefined ||
      String(rawValue).trim() === "";

    if (isMissing) {
      missingVariables.push(variable);
    }

    const formattedValue =
      formatValue(rawValue);

    const replacement =
      options?.escapeValues === false
        ? formattedValue
        : escapeHtml(formattedValue);

    const variablePattern =
      new RegExp(
        `\\{\\{\\s*${escapeRegex(
          variable,
        )}\\s*\\}\\}`,
        "g",
      );

    renderedContent =
      renderedContent.replace(
        variablePattern,
        replacement,
      );
  }

  if (options?.sanitizeHtml) {
    renderedContent =
      sanitizeRichTextHtml(
        renderedContent,
      );
  }

  return {
    renderedContent,
    missingVariables,
    usedVariables: variables,
  };
}

export function renderEmploymentContractDocument(
  input: {
    subject: string;
    bodyHtml: string;
    bodyText?: string | null;
    data: EmploymentContractRenderData;
  },
): RenderEmploymentContractDocumentResult {
  const subjectResult =
    renderEmploymentContractTemplate(
      input.subject,
      input.data,
      {
        escapeValues: false,
      },
    );

  const safeBodyHtml =
    sanitizeRichTextHtml(
      input.bodyHtml,
    );

  const htmlResult =
    renderEmploymentContractTemplate(
      safeBodyHtml,
      input.data,
      {
        sanitizeHtml: true,
        escapeValues: true,
      },
    );

  const sourceText =
    input.bodyText?.trim() ||
    richTextToPlainText(
      input.bodyHtml,
    );

  const textResult =
    renderEmploymentContractTemplate(
      sourceText,
      input.data,
      {
        escapeValues: false,
      },
    );

  return {
    renderedSubject:
      subjectResult.renderedContent.trim(),

    renderedHtml:
      htmlResult.renderedContent,

    renderedText:
      textResult.renderedContent.trim(),

    missingVariables:
      Array.from(
        new Set([
          ...subjectResult.missingVariables,
          ...htmlResult.missingVariables,
          ...textResult.missingVariables,
        ]),
      ),

    usedVariables:
      Array.from(
        new Set([
          ...subjectResult.usedVariables,
          ...htmlResult.usedVariables,
          ...textResult.usedVariables,
        ]),
      ),
  };
}
