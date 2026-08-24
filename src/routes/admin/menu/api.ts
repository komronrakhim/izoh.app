import { useQuery, type QueryClient } from "@tanstack/react-query";

import { ApiError, fetchApiJson } from "~/shared/api";
import type {
  AdminMenuPayload,
  AdminMenuSummaryPayload,
  CreateMenuCategoryInput,
  CreateMenuInput,
  CreateMenuItemInput,
  DeleteDetachedMenuPhotoPayload,
  ReorderMenuEntitiesInput,
  UpdateMenuCategoryInput,
  UpdateMenuInput,
  UpdateMenuItemInput
} from "~/shared/menu";

export const adminMenuQueryKey = (organizationId: string, initDataRaw?: string) =>
  ["admin", "organization", organizationId, "menu", initDataRaw ?? ""] as const;

export const adminMenuSummaryQueryKey = (organizationId: string, initDataRaw?: string) =>
  ["admin", "organization", organizationId, "menu", "summary", initDataRaw ?? ""] as const;

const adminMenuUrl = (organizationId: string) =>
  `/api/organizations/${encodeURIComponent(organizationId)}/menu`;

export const createMenuClientRequestId = (prefix: string) => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

export const fetchAdminMenu = (
  organizationId: string,
  initDataRaw?: string,
  signal?: AbortSignal
) =>
  fetchApiJson<AdminMenuPayload>(adminMenuUrl(organizationId), {
    initDataRaw,
    signal
  });

export const useAdminMenuQuery = (
  organizationId: string | null | undefined,
  initDataRaw?: string,
  enabled = true
) =>
  useQuery({
    enabled: Boolean(organizationId) && enabled,
    queryFn: ({ signal }) => fetchAdminMenu(organizationId!, initDataRaw, signal),
    queryKey: organizationId
      ? adminMenuQueryKey(organizationId, initDataRaw)
      : (["admin", "organization", "menu", "idle"] as const)
  });

export const fetchAdminMenuSummary = (
  organizationId: string,
  initDataRaw?: string,
  signal?: AbortSignal
) =>
  fetchApiJson<AdminMenuSummaryPayload>(`${adminMenuUrl(organizationId)}/summary`, {
    initDataRaw,
    signal
  });

export const useAdminMenuSummaryQuery = (
  organizationId: string | null | undefined,
  initDataRaw?: string,
  enabled = true
) =>
  useQuery({
    enabled: Boolean(organizationId) && enabled,
    queryFn: ({ signal }) => fetchAdminMenuSummary(organizationId!, initDataRaw, signal),
    queryKey: organizationId
      ? adminMenuSummaryQueryKey(organizationId, initDataRaw)
      : (["admin", "organization", "menu", "summary", "idle"] as const),
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 404) && failureCount < 2
  });

export const setAdminMenuQueryData = (
  queryClient: QueryClient,
  payload: AdminMenuPayload,
  initDataRaw?: string
) => {
  queryClient.setQueryData(adminMenuQueryKey(payload.organizationId, initDataRaw), payload);
  queryClient.setQueryData<AdminMenuSummaryPayload>(
    adminMenuSummaryQueryKey(payload.organizationId, initDataRaw),
    {
      guestAvailable: payload.guestAvailable,
      moduleEnabled: payload.moduleEnabled,
      organizationId: payload.organizationId
    }
  );
};

export const deleteDetachedAdminMenuPhoto = (
  organizationId: string,
  mediaAssetId: string,
  initDataRaw?: string
) =>
  fetchApiJson<DeleteDetachedMenuPhotoPayload>(
    `${adminMenuUrl(organizationId)}/photos/${encodeURIComponent(mediaAssetId)}`,
    {
      initDataRaw,
      method: "DELETE"
    }
  );

export const createAdminMenu = (
  organizationId: string,
  input: CreateMenuInput,
  initDataRaw?: string
) =>
  fetchApiJson<AdminMenuPayload>(adminMenuUrl(organizationId), {
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json"
    },
    initDataRaw,
    method: "POST"
  });

export const updateAdminMenu = (
  organizationId: string,
  input: UpdateMenuInput,
  initDataRaw?: string
) =>
  fetchApiJson<AdminMenuPayload>(adminMenuUrl(organizationId), {
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json"
    },
    initDataRaw,
    method: "PATCH"
  });

export const updateAdminMenuEnabled = (
  organizationId: string,
  enabled: boolean,
  initDataRaw?: string
) =>
  fetchApiJson<AdminMenuPayload>(`${adminMenuUrl(organizationId)}/enabled`, {
    body: JSON.stringify({ enabled }),
    headers: {
      "Content-Type": "application/json"
    },
    initDataRaw,
    method: "PATCH"
  });

export const createAdminMenuCategory = (
  organizationId: string,
  input: CreateMenuCategoryInput,
  initDataRaw?: string
) =>
  fetchApiJson<AdminMenuPayload>(`${adminMenuUrl(organizationId)}/categories`, {
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json"
    },
    initDataRaw,
    method: "POST"
  });

export const updateAdminMenuCategory = (
  organizationId: string,
  categoryId: string,
  input: UpdateMenuCategoryInput,
  initDataRaw?: string
) =>
  fetchApiJson<AdminMenuPayload>(
    `${adminMenuUrl(organizationId)}/categories/${encodeURIComponent(categoryId)}`,
    {
      body: JSON.stringify(input),
      headers: {
        "Content-Type": "application/json"
      },
      initDataRaw,
      method: "PATCH"
    }
  );

export const deleteAdminMenuCategory = (
  organizationId: string,
  categoryId: string,
  initDataRaw?: string
) =>
  fetchApiJson<AdminMenuPayload>(
    `${adminMenuUrl(organizationId)}/categories/${encodeURIComponent(categoryId)}`,
    {
      initDataRaw,
      method: "DELETE"
    }
  );

export const reorderAdminMenuCategories = (
  organizationId: string,
  input: ReorderMenuEntitiesInput,
  initDataRaw?: string
) =>
  fetchApiJson<AdminMenuPayload>(`${adminMenuUrl(organizationId)}/categories/reorder`, {
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json"
    },
    initDataRaw,
    method: "PATCH"
  });

export const createAdminMenuItem = (
  organizationId: string,
  categoryId: string,
  input: CreateMenuItemInput,
  initDataRaw?: string
) =>
  fetchApiJson<AdminMenuPayload>(
    `${adminMenuUrl(organizationId)}/categories/${encodeURIComponent(categoryId)}/items`,
    {
      body: JSON.stringify(input),
      headers: {
        "Content-Type": "application/json"
      },
      initDataRaw,
      method: "POST"
    }
  );

export const updateAdminMenuItem = (
  organizationId: string,
  itemId: string,
  input: UpdateMenuItemInput,
  initDataRaw?: string
) =>
  fetchApiJson<AdminMenuPayload>(
    `${adminMenuUrl(organizationId)}/items/${encodeURIComponent(itemId)}`,
    {
      body: JSON.stringify(input),
      headers: {
        "Content-Type": "application/json"
      },
      initDataRaw,
      method: "PATCH"
    }
  );

export const deleteAdminMenuItem = (organizationId: string, itemId: string, initDataRaw?: string) =>
  fetchApiJson<AdminMenuPayload>(
    `${adminMenuUrl(organizationId)}/items/${encodeURIComponent(itemId)}`,
    {
      initDataRaw,
      method: "DELETE"
    }
  );

export const reorderAdminMenuItems = (
  organizationId: string,
  categoryId: string,
  input: ReorderMenuEntitiesInput,
  initDataRaw?: string
) =>
  fetchApiJson<AdminMenuPayload>(
    `${adminMenuUrl(organizationId)}/categories/${encodeURIComponent(categoryId)}/items/reorder`,
    {
      body: JSON.stringify(input),
      headers: {
        "Content-Type": "application/json"
      },
      initDataRaw,
      method: "PATCH"
    }
  );
