import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import "~/assets/styles/index.css";

import { AdminOrganizationProvider } from "~/shared/admin";
import { I18nProvider } from "~/shared/i18n/react";
import { AppQueryProvider } from "~/shared/query";
import { TmaProvider } from "~/shared/tma";
import { installApiFetchShim } from "~/shared/api";
import { router } from "./router";
import { TmaEnvironmentGate } from "./tma-environment-gate";

installApiFetchShim();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <TmaProvider>
        <TmaEnvironmentGate>
          <AppQueryProvider>
            <AdminOrganizationProvider>
              <RouterProvider router={router} />
            </AdminOrganizationProvider>
          </AppQueryProvider>
        </TmaEnvironmentGate>
      </TmaProvider>
    </I18nProvider>
  </React.StrictMode>
);
