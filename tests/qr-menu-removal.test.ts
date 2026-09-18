import { describe, expect, it } from "vitest";

import { createApiApp } from "~/server/api/app";

describe("retired QR Menu API", () => {
  it.each([
    { method: "GET", path: "/api/organizations/org_1/menu" },
    { method: "GET", path: "/api/organizations/org_1/menu/summary" },
    { method: "POST", path: "/api/organizations/org_1/menu" },
    { method: "PATCH", path: "/api/organizations/org_1/menu" },
    { method: "PATCH", path: "/api/organizations/org_1/menu/enabled" },
    { method: "PATCH", path: "/api/organizations/org_1/menu/categories/reorder" },
    { method: "POST", path: "/api/organizations/org_1/menu/categories" },
    { method: "PATCH", path: "/api/organizations/org_1/menu/categories/category_1" },
    { method: "DELETE", path: "/api/organizations/org_1/menu/categories/category_1" },
    {
      method: "PATCH",
      path: "/api/organizations/org_1/menu/categories/category_1/items/reorder"
    },
    {
      method: "POST",
      path: "/api/organizations/org_1/menu/categories/category_1/items"
    },
    { method: "PATCH", path: "/api/organizations/org_1/menu/items/item_1" },
    { method: "DELETE", path: "/api/organizations/org_1/menu/items/item_1" },
    { method: "DELETE", path: "/api/organizations/org_1/menu/photos/asset_1" },
    { method: "GET", path: "/api/guest-entry/coffee-place/menu" }
  ])("does not expose $method $path", async ({ method, path }) => {
    const response = await createApiApp().request(path, { method });

    expect(response.status).toBe(404);
  });

  it("rejects the retired menu photo upload kind", async () => {
    const query = new URLSearchParams({
      fileName: "dish.jpg",
      kind: "MENU_ITEM_PHOTO",
      ownerId: "org_1",
      ownerType: "ORGANIZATION"
    });
    const response = await createApiApp().request(`/api/media/uploads/direct?${query}`, {
      body: new Uint8Array([1]),
      headers: {
        "Content-Type": "image/jpeg"
      },
      method: "POST"
    });

    expect(response.status).toBe(400);
  });
});
