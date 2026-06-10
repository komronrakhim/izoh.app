export type AdminOrganizationLocale = "RU" | "UZ";
export type AdminOrganizationRole = "OWNER";

export type AdminOrganization = {
  contactText: string;
  description: string;
  id: string;
  locale: AdminOrganizationLocale;
  logoUrl?: string;
  name: string;
  role: AdminOrganizationRole;
  slug: string;
};

export const ACTIVE_ADMIN_ORGANIZATION_STORAGE_KEY = "izoh.admin.activeOrganizationId";
