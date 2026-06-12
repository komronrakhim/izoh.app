import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 60 * 1000
    }
  }
});

export const AppQueryProvider = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

export const queryKeys = {
  adminOrganizations: (initDataRaw: string) => ["admin", "organizations", initDataRaw] as const,
  guestMenu: (organizationId: string, initDataRaw: string) =>
    ["organization", organizationId, "guest-menu", initDataRaw] as const,
  guestMenuItem: (organizationId: string, itemId: string, initDataRaw: string) =>
    ["organization", organizationId, "guest-menu", itemId, initDataRaw] as const,
  moduleSettings: (organizationId: string, moduleId: string, initDataRaw: string) =>
    ["organization", organizationId, "module-settings", moduleId, initDataRaw] as const,
  notificationSettings: (organizationId: string, initDataRaw: string) =>
    ["organization", organizationId, "notification-settings", initDataRaw] as const,
  subscription: (organizationId: string, initDataRaw: string) =>
    ["organization", organizationId, "subscription", initDataRaw] as const,
  analytics: (organizationId: string, period: string, initDataRaw: string) =>
    ["organization", organizationId, "analytics", period, initDataRaw] as const,
  organizationQrLink: (organizationId: string, context: string, initDataRaw: string) =>
    ["organization", organizationId, "qr-link", context, initDataRaw] as const,
  guestEntryConfig: (startParam: string) => ["guest-entry", startParam] as const,
  staffMembers: (organizationId: string, initDataRaw: string) =>
    ["organization", organizationId, "staff-members", initDataRaw] as const,
  submissions: (organizationId: string, filter: string, initDataRaw: string) =>
    ["organization", organizationId, "submissions", filter, initDataRaw] as const
};
