import * as React from "react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useLocation,
  useNavigate
} from "@tanstack/react-router";

import { PendingScreen } from "~/common/ui";
import { useTma } from "~/shared/tma";

const lazyRouteComponent = (
  load: () => Promise<{
    default: React.ComponentType;
  }>
) => {
  const LazyComponent = React.lazy(load);

  return function LazyRouteComponent() {
    return (
      <React.Suspense fallback={<PendingScreen />}>
        <LazyComponent />
      </React.Suspense>
    );
  };
};

const LandingPage = lazyRouteComponent(() =>
  import("~/routes/landing").then((module) => ({
    default: module.LandingPage
  }))
);
const AdminAnalyticsPage = lazyRouteComponent(() =>
  import("~/routes/admin/analytics").then((module) => ({
    default: module.AdminAnalyticsPage
  }))
);
const AdminOrganizationCreatePage = lazyRouteComponent(() =>
  import("~/routes/admin/create").then((module) => ({
    default: module.AdminOrganizationCreatePage
  }))
);
const AdminDashboard = lazyRouteComponent(() =>
  import("~/routes/admin/dashboard").then((module) => ({
    default: module.AdminDashboard
  }))
);
const AdminOrganizationOverviewPage = lazyRouteComponent(() =>
  import("~/routes/admin/dashboard").then((module) => ({
    default: module.AdminOrganizationOverviewPage
  }))
);
const AdminFaqPage = lazyRouteComponent(() =>
  import("~/routes/admin/faq").then((module) => ({
    default: module.AdminFaqPage
  }))
);
const AdminFeedPage = lazyRouteComponent(() =>
  import("~/routes/admin/feed").then((module) => ({
    default: module.AdminFeedPage
  }))
);
const AdminIntegrationsPage = lazyRouteComponent(() =>
  import("~/routes/admin/integrations").then((module) => ({
    default: module.AdminIntegrationsPage
  }))
);
const AdminLanguagePage = lazyRouteComponent(() =>
  import("~/routes/admin/language").then((module) => ({
    default: module.AdminLanguagePage
  }))
);
const AdminQrConstructor = lazyRouteComponent(() =>
  import("~/routes/admin/qr").then((module) => ({
    default: module.AdminQrConstructor
  }))
);
const AdminSection = lazyRouteComponent(() =>
  import("~/routes/admin/section").then((module) => ({
    default: module.AdminSection
  }))
);
const AdminStaffCreatePage = lazyRouteComponent(() =>
  import("~/routes/admin/staff/create").then((module) => ({
    default: module.AdminStaffCreatePage
  }))
);
const AdminStaffMemberPage = lazyRouteComponent(() =>
  import("~/routes/admin/staff/member").then((module) => ({
    default: module.AdminStaffMemberPage
  }))
);
const AdminSubscriptionPage = lazyRouteComponent(() =>
  import("~/routes/admin/subscription").then((module) => ({
    default: module.AdminSubscriptionPage
  }))
);
const AdminSystemPage = lazyRouteComponent(() =>
  import("~/routes/admin/system").then((module) => ({
    default: module.AdminSystemPage
  }))
);
const AdminSystemOrganizationsPage = lazyRouteComponent(() =>
  import("~/routes/admin/system").then((module) => ({
    default: module.AdminSystemOrganizationsPage
  }))
);
const AdminSystemOrganizationPage = lazyRouteComponent(() =>
  import("~/routes/admin/system").then((module) => ({
    default: module.AdminSystemOrganizationPage
  }))
);
const AdminSystemUsersPage = lazyRouteComponent(() =>
  import("~/routes/admin/system").then((module) => ({
    default: module.AdminSystemUsersPage
  }))
);
const AdminSystemUserPage = lazyRouteComponent(() =>
  import("~/routes/admin/system").then((module) => ({
    default: module.AdminSystemUserPage
  }))
);
const AdminSystemSubmissionsPage = lazyRouteComponent(() =>
  import("~/routes/admin/system").then((module) => ({
    default: module.AdminSystemSubmissionsPage
  }))
);
const AdminSystemStarsPage = lazyRouteComponent(() =>
  import("~/routes/admin/system").then((module) => ({
    default: module.AdminSystemStarsPage
  }))
);
const AdminSystemSubscriptionPricingPage = lazyRouteComponent(() =>
  import("~/routes/admin/system").then((module) => ({
    default: module.AdminSystemSubscriptionPricingPage
  }))
);
const CustomerWizardRoute = lazyRouteComponent(() =>
  import("~/routes/guest/start-param").then((module) => ({
    default: module.CustomerWizardRoute
  }))
);
const CustomerWizardChoicePage = lazyRouteComponent(() =>
  import("~/routes/guest/start-param/choice").then((module) => ({
    default: module.CustomerWizardChoicePage
  }))
);
const CustomerWizardStepPage = lazyRouteComponent(() =>
  import("~/routes/guest/start-param/step").then((module) => ({
    default: module.CustomerWizardStepPage
  }))
);

const RootComponent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const tma = useTma();
  const guestStartParam = tma.startParam?.trim();
  const guestTargetPath = guestStartParam ? `/guest/${encodeURIComponent(guestStartParam)}` : null;
  const isInsideGuestTarget =
    Boolean(guestTargetPath) &&
    (location.pathname === guestTargetPath || location.pathname.startsWith(`${guestTargetPath}/`));
  const shouldOpenGuestEntry = tma.isReady && Boolean(guestStartParam) && !isInsideGuestTarget;
  const isTelegramMiniApp = tma.isTelegram && Boolean(tma.initDataRaw);
  const shouldOpenAdminEntry =
    tma.isReady && isTelegramMiniApp && !guestStartParam && location.pathname === "/";

  React.useEffect(() => {
    if (!shouldOpenGuestEntry || !guestStartParam) {
      return;
    }

    void navigate({
      params: {
        startParam: guestStartParam
      },
      replace: true,
      to: "/guest/$startParam"
    });
  }, [guestStartParam, navigate, shouldOpenGuestEntry]);

  React.useEffect(() => {
    if (!shouldOpenAdminEntry) {
      return;
    }

    void navigate({
      replace: true,
      to: "/admin"
    });
  }, [navigate, shouldOpenAdminEntry]);

  if (!tma.isReady || shouldOpenGuestEntry || shouldOpenAdminEntry) {
    return <PendingScreen />;
  }

  return <Outlet />;
};

const rootRoute = createRootRoute({
  component: RootComponent
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LandingPage
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminDashboard
});

const adminCreateOrganizationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/new",
  component: AdminOrganizationCreatePage
});

const adminLanguageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/language",
  component: AdminLanguagePage
});

const adminFaqRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/faq",
  component: AdminFaqPage
});

const adminSystemRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/system",
  component: AdminSystemPage
});

const adminSystemOrganizationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/system/organizations",
  component: AdminSystemOrganizationsPage
});

const adminSystemOrganizationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/system/organizations/$organizationId",
  component: AdminSystemOrganizationPage
});

const adminSystemUsersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/system/users",
  component: AdminSystemUsersPage
});

const adminSystemUserRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/system/users/$userId",
  component: AdminSystemUserPage
});

const adminSystemSubmissionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/system/submissions",
  component: AdminSystemSubmissionsPage
});

const adminSystemStarsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/system/stars",
  component: AdminSystemStarsPage
});

const adminSystemSubscriptionPricingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/system/subscription-pricing",
  component: AdminSystemSubscriptionPricingPage
});

const adminOrganizationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/$organizationId",
  component: AdminOrganizationOverviewPage
});

const adminQrRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/$organizationId/qr",
  component: AdminQrConstructor
});

const adminFeedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/$organizationId/feed",
  component: AdminFeedPage
});

const adminAnalyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/$organizationId/analytics",
  component: AdminAnalyticsPage
});

const adminIntegrationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/$organizationId/integrations",
  component: AdminIntegrationsPage
});

const adminStaffCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/$organizationId/staff/new",
  component: AdminStaffCreatePage
});

const adminStaffMemberRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/$organizationId/staff/$staffMemberId",
  component: AdminStaffMemberPage
});

const adminSubscriptionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/$organizationId/subscription",
  component: AdminSubscriptionPage
});

const adminSectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/$organizationId/$section",
  component: AdminSection
});

const guestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/guest/$startParam",
  component: CustomerWizardRoute
});

const guestChoiceRoute = createRoute({
  getParentRoute: () => guestRoute,
  path: "/",
  component: CustomerWizardChoicePage
});

const guestStepRoute = createRoute({
  getParentRoute: () => guestRoute,
  path: "$wizardStep",
  component: CustomerWizardStepPage
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  adminRoute,
  adminCreateOrganizationRoute,
  adminLanguageRoute,
  adminFaqRoute,
  adminSystemRoute,
  adminSystemOrganizationsRoute,
  adminSystemOrganizationRoute,
  adminSystemUsersRoute,
  adminSystemUserRoute,
  adminSystemSubmissionsRoute,
  adminSystemStarsRoute,
  adminSystemSubscriptionPricingRoute,
  adminOrganizationRoute,
  adminQrRoute,
  adminFeedRoute,
  adminAnalyticsRoute,
  adminIntegrationsRoute,
  adminStaffCreateRoute,
  adminStaffMemberRoute,
  adminSubscriptionRoute,
  adminSectionRoute,
  guestRoute.addChildren([guestChoiceRoute, guestStepRoute])
]);

export const router = createRouter({
  defaultPendingComponent: PendingScreen,
  routeTree
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
