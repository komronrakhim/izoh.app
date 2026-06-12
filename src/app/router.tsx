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
import { AdminAnalyticsPage } from "~/routes/admin/analytics";
import { AdminOrganizationCreatePage } from "~/routes/admin/create";
import { AdminDashboard, AdminOrganizationOverviewPage } from "~/routes/admin/dashboard";
import { AdminFaqPage } from "~/routes/admin/faq";
import { AdminFeedPage } from "~/routes/admin/feed";
import { AdminLanguagePage } from "~/routes/admin/language";
import { AdminQrConstructor } from "~/routes/admin/qr";
import { AdminSection } from "~/routes/admin/section";
import { AdminStaffCreatePage } from "~/routes/admin/staff/create";
import { AdminStaffMemberPage } from "~/routes/admin/staff/member";
import { AdminSubscriptionPage } from "~/routes/admin/subscription";
import { CustomerWizardChoicePage } from "~/routes/guest/start-param/choice";
import { CustomerWizardRoute } from "~/routes/guest/start-param";
import { CustomerWizardStepPage } from "~/routes/guest/start-param/step";
import { useTma } from "~/shared/tma";

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

  if (!tma.isReady || shouldOpenGuestEntry) {
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
  component: AdminDashboard
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
  adminOrganizationRoute,
  adminQrRoute,
  adminFeedRoute,
  adminAnalyticsRoute,
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
