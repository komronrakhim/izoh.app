import "dotenv/config";
import { serve } from "@hono/node-server";

import { createApiApp } from "./api/app";

const port = Number(process.env.PORT ?? 3000);

serve(
  {
    fetch: createApiApp().fetch,
    hostname: "0.0.0.0",
    port
  },
  (info) => {
    console.log(`Izoh API listening on http://localhost:${info.port}`);
  }
);
