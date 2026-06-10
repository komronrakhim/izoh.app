import { getDomainDb, type DomainDb } from "~/server/domain/shared";
import type { StaffMemberItem, StaffMembersPayload } from "~/shared/staff";

type StaffMemberInput = {
  avatarMediaAssetId?: null | string;
  displayName: string;
  roleTitle?: string;
};

type StaffMemberPatch = Partial<StaffMemberInput> & {
  isActive?: boolean;
};

const toStaffMemberItem = (
  staffMember: {
    avatar_media_asset_id: null | string;
    display_name: string;
    id: string;
    is_active: boolean;
    role_title: string;
    sort_order: number;
  },
  avatarUrlByAssetId: Map<string, string> = new Map()
): StaffMemberItem => ({
  avatarMediaAssetId: staffMember.avatar_media_asset_id,
  avatarUrl: staffMember.avatar_media_asset_id
    ? (avatarUrlByAssetId.get(staffMember.avatar_media_asset_id) ?? null)
    : null,
  displayName: staffMember.display_name,
  id: staffMember.id,
  isActive: staffMember.is_active,
  roleTitle: staffMember.role_title,
  sortOrder: staffMember.sort_order
});

const assertActiveOrganization = async (organizationId: string, db: DomainDb) => {
  const organization = await db.organization.findUnique({
    select: {
      id: true,
      status: true
    },
    where: {
      id: organizationId
    }
  });

  if (!organization || organization.status !== "ACTIVE") {
    throw new Error("Organization is not available.");
  }

  return organization;
};

const getAvatarUrlByAssetId = async (avatarMediaAssetIds: Array<null | string>, db: DomainDb) => {
  const ids = avatarMediaAssetIds.filter((value): value is string => Boolean(value));

  if (ids.length === 0) {
    return new Map<string, string>();
  }

  const assets = await db.mediaAsset.findMany({
    select: {
      id: true,
      public_url: true
    },
    where: {
      id: {
        in: ids
      },
      kind: "STAFF_AVATAR",
      status: "READY"
    }
  });

  return new Map(assets.map((asset) => [asset.id, asset.public_url]));
};

const assertStaffAvatarAsset = async ({
  avatarMediaAssetId,
  db,
  staffMemberId
}: {
  avatarMediaAssetId?: null | string;
  db: DomainDb;
  staffMemberId: string;
}) => {
  if (!avatarMediaAssetId) {
    return;
  }

  const asset = await db.mediaAsset.findFirst({
    select: {
      id: true
    },
    where: {
      id: avatarMediaAssetId,
      kind: "STAFF_AVATAR",
      owner_id: staffMemberId,
      owner_type: "STAFF_MEMBER",
      status: "READY"
    }
  });

  if (!asset) {
    throw new Error("Staff avatar is not available.");
  }
};

export const getOrganizationStaffMembers = async (
  organizationId: string,
  db: DomainDb = getDomainDb()
): Promise<StaffMembersPayload> => {
  await assertActiveOrganization(organizationId, db);

  const staffMembers = await db.staffMember.findMany({
    orderBy: [
      {
        is_active: "desc"
      },
      {
        sort_order: "asc"
      },
      {
        created_at: "asc"
      }
    ],
    where: {
      organization_id: organizationId
    }
  });

  const avatarUrlByAssetId = await getAvatarUrlByAssetId(
    staffMembers.map((staffMember) => staffMember.avatar_media_asset_id),
    db
  );

  return {
    items: staffMembers.map((staffMember) => toStaffMemberItem(staffMember, avatarUrlByAssetId)),
    organizationId
  };
};

export const getOrganizationStaffMember = async (
  {
    organizationId,
    staffMemberId
  }: {
    organizationId: string;
    staffMemberId: string;
  },
  db: DomainDb = getDomainDb()
): Promise<StaffMembersPayload> => {
  await assertActiveOrganization(organizationId, db);

  const staffMember = await db.staffMember.findFirst({
    where: {
      id: staffMemberId,
      organization_id: organizationId
    }
  });

  if (!staffMember) {
    throw new Error("Staff member is not available.");
  }

  const avatarUrlByAssetId = await getAvatarUrlByAssetId([staffMember.avatar_media_asset_id], db);
  const item = toStaffMemberItem(staffMember, avatarUrlByAssetId);

  return {
    item,
    items: [item],
    organizationId
  };
};

export const createOrganizationStaffMember = async (
  {
    displayName,
    avatarMediaAssetId = null,
    organizationId,
    roleTitle = ""
  }: StaffMemberInput & {
    organizationId: string;
  },
  db: DomainDb = getDomainDb()
): Promise<StaffMembersPayload> => {
  await assertActiveOrganization(organizationId, db);

  const staffCount = await db.staffMember.count({
    where: {
      organization_id: organizationId
    }
  });

  const staffMember = await db.staffMember.create({
    data: {
      avatar_media_asset_id: avatarMediaAssetId,
      display_name: displayName,
      organization_id: organizationId,
      role_title: roleTitle,
      sort_order: staffCount
    }
  });

  await assertStaffAvatarAsset({
    avatarMediaAssetId,
    db,
    staffMemberId: staffMember.id
  });

  const payload = await getOrganizationStaffMembers(organizationId, db);

  return {
    ...payload,
    item: payload.items.find((item) => item.id === staffMember.id) ?? null
  };
};

export const updateOrganizationStaffMember = async (
  {
    organizationId,
    patch,
    staffMemberId
  }: {
    organizationId: string;
    patch: StaffMemberPatch;
    staffMemberId: string;
  },
  db: DomainDb = getDomainDb()
): Promise<StaffMembersPayload> => {
  await assertActiveOrganization(organizationId, db);

  const staffMember = await db.staffMember.findFirst({
    select: {
      id: true
    },
    where: {
      id: staffMemberId,
      organization_id: organizationId
    }
  });

  if (!staffMember) {
    throw new Error("Staff member is not available.");
  }

  await assertStaffAvatarAsset({
    avatarMediaAssetId: patch.avatarMediaAssetId,
    db,
    staffMemberId
  });

  await db.staffMember.update({
    data: {
      avatar_media_asset_id: patch.avatarMediaAssetId,
      display_name: patch.displayName,
      is_active: patch.isActive,
      role_title: patch.roleTitle
    },
    where: {
      id: staffMemberId
    }
  });

  const payload = await getOrganizationStaffMembers(organizationId, db);

  return {
    ...payload,
    item: payload.items.find((item) => item.id === staffMemberId) ?? null
  };
};

export const deleteOrganizationStaffMember = async (
  {
    organizationId,
    staffMemberId
  }: {
    organizationId: string;
    staffMemberId: string;
  },
  db: DomainDb = getDomainDb()
): Promise<StaffMembersPayload> => {
  await assertActiveOrganization(organizationId, db);

  const staffMember = await db.staffMember.findFirst({
    select: {
      id: true
    },
    where: {
      id: staffMemberId,
      organization_id: organizationId
    }
  });

  if (!staffMember) {
    throw new Error("Staff member is not available.");
  }

  await db.staffMember.delete({
    where: {
      id: staffMemberId
    }
  });

  return getOrganizationStaffMembers(organizationId, db);
};
