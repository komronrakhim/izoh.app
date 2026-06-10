import { describe, expect, it } from "vitest";

import { getOrCreateOrganizationGuestContext } from "~/server/domain/guest-contexts";

describe("guest contexts", () => {
  it("stores normalized labels behind short per-organization codes", async () => {
    const rows: Array<{
      code: string;
      id: string;
      label: string;
      organization_id: string;
    }> = [];
    const db = {
      organizationGuestContext: {
        create: async ({
          data,
          select
        }: {
          data: {
            code: string;
            label: string;
            organization_id: string;
          };
          select: Record<string, boolean>;
        }) => {
          const row = {
            ...data,
            id: `context_${rows.length + 1}`
          };

          rows.push(row);

          return Object.fromEntries(
            Object.entries(select)
              .filter(([, enabled]) => enabled)
              .map(([key]) => [key, row[key as keyof typeof row]])
          );
        },
        findFirst: async ({
          where
        }: {
          where: {
            code?: string;
            label?: string;
            organization_id: string;
          };
        }) =>
          rows.find((row) => {
            return (
              row.organization_id === where.organization_id &&
              (where.code ? row.code === where.code : true) &&
              (where.label ? row.label === where.label : true)
            );
          }) ?? null
      }
    };

    const first = await getOrCreateOrganizationGuestContext(
      {
        label: "  Стол   4  ",
        organizationId: "org_1"
      },
      db as never
    );
    const second = await getOrCreateOrganizationGuestContext(
      {
        label: "Стол 4",
        organizationId: "org_1"
      },
      db as never
    );

    expect(first?.label).toBe("Стол 4");
    expect(first?.code).toMatch(/^[a-z0-9]{5}$/);
    expect(second?.code).toBe(first?.code);
    expect(rows).toHaveLength(1);
  });
});
