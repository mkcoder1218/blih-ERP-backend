export type BrainContactFieldType =
  | "text"
  | "long_text"
  | "number"
  | "phone"
  | "email"
  | "date"
  | "url"
  | "dropdown"
  | "multi_select"
  | "checkbox";

export type BrainContactFieldOption = {
  id: string;
  label: string;
};

export type BrainContactFieldInput = {
  label: string;
  type: BrainContactFieldType;
  isRequired?: boolean;
  showInTable?: boolean;
  options?: Array<string | BrainContactFieldOption>;
};

export type BrainContactCategoryInput = {
  name: string;
  iconName?: string;
  description?: string | null;
  fields?: BrainContactFieldInput[];
};

export type BrainCustomContactInput = {
  name: string;
  values?: Record<string, unknown>;
};
