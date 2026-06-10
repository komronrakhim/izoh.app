export type StaffMemberItem = {
  avatarMediaAssetId?: null | string;
  avatarUrl?: null | string;
  displayName: string;
  id: string;
  isActive: boolean;
  roleTitle: string;
  sortOrder: number;
};

export type StaffMembersPayload = {
  item?: null | StaffMemberItem;
  items: StaffMemberItem[];
  organizationId: string;
};
