export type BrainContactKind = "client" | "influencer";

export type BrainContactOptionType =
  | "field"
  | "behavior"
  | "platform"
  | "client_status"
  | "client_type"
  | "position"
  | "company";

export type BrainContactPhone = {
  id?: string;
  number: string;
  label?: string | null;
};

export type BrainContactPlatformAccount = {
  id?: string;
  platformOptionId: string;
  handle?: string | null;
  profileUrl?: string | null;
  followerCount?: number | null;
};

export type BrainContactDirectoryMetadata = {
  version: 1;
  kind: BrainContactKind;
  name: string;
  phones: BrainContactPhone[];
  email?: string | null;
  fieldOptionId?: string | null;
  behaviorOptionId?: string | null;
  companyOptionId?: string | null;
  positionOptionId?: string | null;
  clientTypeOptionId?: string | null;
  clientStatusOptionId?: string | null;
  location?: string | null;
  notes?: string | null;
  profileImageUrl?: string | null;
  platformAccounts: BrainContactPlatformAccount[];
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
};

export type BrainContactInput = {
  kind: BrainContactKind;
  name: string;
  phones: BrainContactPhone[];
  email?: string | null;
  fieldOptionId?: string | null;
  behaviorOptionId?: string | null;
  companyOptionId?: string | null;
  positionOptionId?: string | null;
  clientTypeOptionId?: string | null;
  clientStatusOptionId?: string | null;
  location?: string | null;
  notes?: string | null;
  profileImageUrl?: string | null;
  platformAccounts?: BrainContactPlatformAccount[];
};

export type BrainContactListQuery = {
  page?: number | string;
  size?: number | string;
  search?: string;
  kind?: BrainContactKind;
  fieldOptionId?: string;
  behaviorOptionId?: string;
  clientStatusOptionId?: string;
};
