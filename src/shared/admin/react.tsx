import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  ACTIVE_ADMIN_ORGANIZATION_STORAGE_KEY,
  type AdminOrganization,
  type AdminOrganizationLocale,
  type AdminViewer
} from "./organizations";
import { fetchApiJson } from "~/shared/api";
import type { OrganizationPresetId } from "~/shared/organization-presets";
import { queryKeys } from "~/shared/query";
import { useTma } from "~/shared/tma";

type CreateAdminOrganizationInput = {
  businessType?: OrganizationPresetId;
  contactText?: string;
  locale: AdminOrganizationLocale;
  name: string;
  timeZone?: string;
};

type AdminOrganizationsPayload = {
  activeOrganizationId?: null | string;
  organizations?: AdminOrganization[];
  viewer?: AdminViewer;
};

type CreateAdminOrganizationPayload = AdminOrganizationsPayload & {
  organization?: AdminOrganization;
};

type AdminOrganizationContextValue = {
  activeOrganization: AdminOrganization | null;
  activeOrganizationId: string | null;
  createOrganization: (input: CreateAdminOrganizationInput) => Promise<AdminOrganization | null>;
  error: string | null;
  isLoading: boolean;
  organizations: AdminOrganization[];
  refreshOrganizations: () => Promise<void>;
  setActiveOrganizationId: (id: string) => void;
  viewer: AdminViewer;
};

const AdminOrganizationContext = React.createContext<AdminOrganizationContextValue | null>(null);

const defaultAdminViewer: AdminViewer = {
  isSystemAdmin: false,
  systemRole: "USER"
};

const getStoredActiveOrganizationId = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ACTIVE_ADMIN_ORGANIZATION_STORAGE_KEY);
};

const storeActiveOrganizationId = (id: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACTIVE_ADMIN_ORGANIZATION_STORAGE_KEY, id);
};

const resolveActiveOrganizationId = ({
  activeOrganizationId,
  organizations,
  storedOrganizationId
}: {
  activeOrganizationId?: null | string;
  organizations: AdminOrganization[];
  storedOrganizationId: null | string;
}) => {
  if (
    storedOrganizationId &&
    organizations.some((organization) => organization.id === storedOrganizationId)
  ) {
    return storedOrganizationId;
  }

  return activeOrganizationId ?? organizations[0]?.id ?? null;
};

export const AdminOrganizationProvider = ({ children }: { children: React.ReactNode }) => {
  const { initDataRaw, isReady } = useTma();
  const queryClient = useQueryClient();
  const organizationsQueryKey = queryKeys.adminOrganizations(initDataRaw);
  const [activeOrganizationId, setActiveOrganizationIdState] = React.useState<string | null>(
    getStoredActiveOrganizationId()
  );

  const organizationsQuery = useQuery({
    enabled: isReady && Boolean(initDataRaw),
    queryFn: () =>
      fetchApiJson<AdminOrganizationsPayload>("/api/admin/organizations", {
        initDataRaw
      }),
    queryKey: organizationsQueryKey
  });

  const organizations = React.useMemo(
    () => organizationsQuery.data?.organizations ?? [],
    [organizationsQuery.data?.organizations]
  );

  const setActiveOrganizationId = React.useCallback((id: string) => {
    setActiveOrganizationIdState(id);
    storeActiveOrganizationId(id);
  }, []);

  const refreshOrganizations = React.useCallback(async () => {
    await organizationsQuery.refetch();
  }, [organizationsQuery]);

  const createOrganizationMutation = useMutation({
    mutationFn: ({
      businessType,
      contactText,
      locale,
      name,
      timeZone
    }: CreateAdminOrganizationInput) =>
      fetchApiJson<CreateAdminOrganizationPayload>("/api/admin/organizations", {
        body: JSON.stringify({
          businessType,
          contactText,
          locale,
          name,
          timeZone
        }),
        headers: {
          "Content-Type": "application/json"
        },
        initDataRaw,
        method: "POST"
      }),
    onSuccess: (payload) => {
      queryClient.setQueryData<AdminOrganizationsPayload>(organizationsQueryKey, (current) => ({
        activeOrganizationId: payload.activeOrganizationId ?? current?.activeOrganizationId ?? null,
        organizations: payload.organizations ?? current?.organizations ?? []
      }));
    }
  });

  const createOrganization = React.useCallback(
    async (input: CreateAdminOrganizationInput) => {
      try {
        const payload = await createOrganizationMutation.mutateAsync(input);
        const nextOrganizations = payload.organizations ?? organizations;
        if (!payload.organization) {
          return null;
        }

        const nextActiveOrganizationId = payload.activeOrganizationId ?? payload.organization.id;

        queryClient.setQueryData<AdminOrganizationsPayload>(organizationsQueryKey, {
          activeOrganizationId: nextActiveOrganizationId,
          organizations:
            nextOrganizations.length > 0
              ? nextOrganizations
              : [
                  ...organizations.filter(
                    (organization) => organization.id !== payload.organization!.id
                  ),
                  payload.organization
                ]
        });
        setActiveOrganizationId(nextActiveOrganizationId);

        return payload.organization;
      } catch {
        return null;
      }
    },
    [
      createOrganizationMutation,
      organizations,
      organizationsQueryKey,
      queryClient,
      setActiveOrganizationId
    ]
  );

  React.useEffect(() => {
    if (!organizationsQuery.data) {
      return;
    }

    const nextActiveOrganizationId = resolveActiveOrganizationId({
      activeOrganizationId: organizationsQuery.data.activeOrganizationId,
      organizations,
      storedOrganizationId: getStoredActiveOrganizationId()
    });

    setActiveOrganizationIdState(nextActiveOrganizationId);

    if (nextActiveOrganizationId) {
      storeActiveOrganizationId(nextActiveOrganizationId);
    }
  }, [organizations, organizationsQuery.data]);

  const activeOrganization = React.useMemo(
    () =>
      organizations.find((organization) => organization.id === activeOrganizationId) ??
      organizations[0] ??
      null,
    [activeOrganizationId, organizations]
  );

  const value = React.useMemo<AdminOrganizationContextValue>(
    () => ({
      activeOrganization,
      activeOrganizationId: activeOrganization?.id ?? null,
      createOrganization,
      error:
        organizationsQuery.error || createOrganizationMutation.error
          ? "Failed to load organizations."
          : null,
      isLoading: !isReady || organizationsQuery.isLoading,
      organizations,
      refreshOrganizations,
      setActiveOrganizationId,
      viewer: organizationsQuery.data?.viewer ?? defaultAdminViewer
    }),
    [
      activeOrganization,
      createOrganization,
      createOrganizationMutation.error,
      isReady,
      organizations,
      organizationsQuery.data?.viewer,
      organizationsQuery.error,
      organizationsQuery.isLoading,
      refreshOrganizations,
      setActiveOrganizationId
    ]
  );

  return (
    <AdminOrganizationContext.Provider value={value}>{children}</AdminOrganizationContext.Provider>
  );
};

export const useAdminOrganization = () => {
  const context = React.useContext(AdminOrganizationContext);

  if (!context) {
    throw new Error("useAdminOrganization must be used within AdminOrganizationProvider");
  }

  return context;
};
