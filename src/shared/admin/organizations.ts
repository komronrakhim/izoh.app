import type { AppLocale } from "~/shared/i18n";

export type AdminOrganizationLocale = AppLocale;
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
  subscriptionActive: boolean;
};

export const ACTIVE_ADMIN_ORGANIZATION_STORAGE_KEY = "izoh.admin.activeOrganizationId";
export const MAX_ADMIN_ORGANIZATIONS = 3;
