import { useNavigate, useParams } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, UserRound } from "lucide-react";
import * as React from "react";

import { Avatar } from "~/common/components";
import { Input, PendingScreen } from "~/common/ui";
import { cn } from "~/common/utils";
import { useAdminOrganization } from "~/shared/admin";
import { useI18n } from "~/shared/i18n/react";
import {
  getMediaImageSizeLimit,
  isSupportedImageContentType,
  uploadImageAsset
} from "~/shared/media";
import { PageTransition } from "~/shared/router/page-transition";
import { queryKeys } from "~/shared/query";
import { type StaffMemberItem, type StaffMembersPayload } from "~/shared/staff";
import { useTma, useTmaBackButton, useTmaMainButton } from "~/shared/tma";

const STAFF_AVATAR_MAX_BYTES = getMediaImageSizeLimit("STAFF_AVATAR");

const createHeaders = (initDataRaw?: string, headers?: HeadersInit) => {
  const nextHeaders = new Headers(headers);

  if (initDataRaw) {
    nextHeaders.set("X-Telegram-Init-Data", initDataRaw);
  }

  return nextHeaders;
};

export const AdminStaffCreatePage = () => {
  const navigate = useNavigate();
  const params = useParams({ from: "/admin/$organizationId/staff/new" });
  const queryClient = useQueryClient();
  const tma = useTma();
  const { t } = useI18n();
  const {
    isLoading: isOrganizationsLoading,
    organizations,
    refreshOrganizations,
    setActiveOrganizationId
  } = useAdminOrganization();
  const organization =
    organizations.find((item) => item.id === params.organizationId) ??
    organizations.find((item) => item.slug === params.organizationId) ??
    null;
  const [displayName, setDisplayName] = React.useState("");
  const [roleTitle, setRoleTitle] = React.useState("");
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = React.useState<string | null>(null);
  const [avatarError, setAvatarError] = React.useState<string | null>(null);
  const [createdStaffMember, setCreatedStaffMember] = React.useState<StaffMemberItem | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const avatarInputId = React.useId();
  const avatarInputRef = React.useRef<HTMLInputElement>(null);

  const backToStaff = React.useCallback(() => {
    void navigate({
      params: {
        organizationId: params.organizationId,
        section: "staff"
      },
      to: "/admin/$organizationId/$section"
    });
  }, [navigate, params.organizationId]);

  useTmaBackButton(true, backToStaff);

  React.useEffect(
    () => () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    },
    [avatarPreviewUrl]
  );

  React.useEffect(() => {
    if (organization) {
      setActiveOrganizationId(organization.id);
    }
  }, [organization, setActiveOrganizationId]);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (!isSupportedImageContentType(file.type)) {
      setAvatarError(t("admin.moduleSettings.staff.avatarErrors.type"));
      return;
    }

    if (file.size > STAFF_AVATAR_MAX_BYTES) {
      setAvatarError(t("admin.moduleSettings.staff.avatarErrors.size"));
      return;
    }

    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }

    setAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
    setAvatarError(null);
  };

  const attachAvatar = async (staffMember: StaffMemberItem) => {
    if (!avatarFile || !organization) {
      return;
    }

    const assets = await uploadImageAsset({
      file: avatarFile,
      initDataRaw: tma.initDataRaw,
      kind: "STAFF_AVATAR",
      ownerId: staffMember.id,
      ownerType: "STAFF_MEMBER"
    });
    const avatarAsset = assets.find((asset) => asset.kind === "STAFF_AVATAR");

    if (!avatarAsset) {
      throw new Error("Staff avatar asset was not returned.");
    }

    const response = await fetch(
      `/api/organizations/${organization.id}/staff-members/${staffMember.id}`,
      {
        body: JSON.stringify({
          avatarMediaAssetId: avatarAsset.id
        }),
        headers: createHeaders(tma.initDataRaw, {
          "Content-Type": "application/json"
        }),
        method: "PATCH"
      }
    );

    if (!response.ok) {
      throw new Error("Staff avatar attachment failed.");
    }
  };

  const saveStaffMember = React.useCallback(async () => {
    if (!organization || isSaving) {
      return;
    }

    const cleanDisplayName = displayName.trim();
    const cleanRoleTitle = roleTitle.trim();

    if (!cleanDisplayName) {
      return;
    }

    setIsSaving(true);
    setAvatarError(null);

    try {
      const staffMember =
        createdStaffMember ??
        (await fetch(`/api/organizations/${organization.id}/staff-members`, {
          body: JSON.stringify({
            displayName: cleanDisplayName,
            roleTitle: cleanRoleTitle
          }),
          headers: createHeaders(tma.initDataRaw, {
            "Content-Type": "application/json"
          }),
          method: "POST"
        }).then(async (response) => {
          if (!response.ok) {
            throw new Error("Staff member creation failed.");
          }

          const payload = (await response.json()) as StaffMembersPayload;
          const created =
            payload.item ??
            payload.items.find((item) => item.displayName === cleanDisplayName) ??
            null;

          if (!created) {
            throw new Error("Created staff member was not returned.");
          }

          return created;
        }));

      if (!staffMember) {
        throw new Error("Created staff member was not returned.");
      }

      setCreatedStaffMember(staffMember);
      await attachAvatar(staffMember);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.staffMembers(organization.id, tma.initDataRaw)
      });
      await refreshOrganizations();
      tma.haptics.notification("success");
      backToStaff();
    } catch {
      setAvatarError(t("admin.moduleSettings.staff.createPage.error"));
      tma.haptics.notification("error");
    } finally {
      setIsSaving(false);
    }
  }, [
    attachAvatar,
    backToStaff,
    createdStaffMember,
    displayName,
    isSaving,
    organization,
    queryClient,
    refreshOrganizations,
    roleTitle,
    t,
    tma.haptics,
    tma.initDataRaw
  ]);

  const canSave = Boolean(displayName.trim()) && Boolean(organization) && !isSaving;
  const mainButtonText = createdStaffMember
    ? t("admin.moduleSettings.staff.createPage.savingAvatar")
    : t("admin.moduleSettings.staff.dialog.create");
  const mainButtonState = React.useMemo(
    () =>
      organization
        ? {
            enabled: canSave,
            loading: isSaving,
            shine: canSave,
            text: mainButtonText
          }
        : null,
    [canSave, isSaving, mainButtonText, organization]
  );

  useTmaMainButton(mainButtonState, saveStaffMember);

  if (isOrganizationsLoading && !organization) {
    return (
      <PageTransition>
        <PendingScreen label={t("common.loading")} />
      </PageTransition>
    );
  }

  if (!organization) {
    return (
      <PageTransition>
        <main className="tma-page bg-surface text-foreground">
          <div className="account-shell">
            <section className="grid justify-items-center gap-2 px-4 text-center">
              <h2 className="ios-title-2 font-semibold tracking-normal text-foreground">
                {t("admin.organizations.emptyTitle")}
              </h2>
              <p className="ios-footnote max-w-[360px] text-muted">
                {t("admin.organizations.emptyHint")}
              </p>
            </section>
          </div>
        </main>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <main className="tma-page bg-surface text-foreground">
        <form
          className="account-shell"
          onSubmit={(event) => {
            event.preventDefault();
            void saveStaffMember();
          }}
        >
          <section className="grid justify-items-center gap-4 px-4 text-center">
            <button
              aria-describedby={avatarError ? `${avatarInputId}-error` : undefined}
              className={cn(
                "group relative rounded-full outline-none transition-opacity active:opacity-80",
                isSaving && "pointer-events-none opacity-70"
              )}
              type="button"
              onClick={() => avatarInputRef.current?.click()}
            >
              {avatarPreviewUrl ? (
                <Avatar
                  alt={displayName || t("admin.moduleSettings.staff.createPage.avatarAlt")}
                  className="size-[108px] rounded-full ring-1 ring-border/60"
                  initialsClassName="ios-large-title"
                  name={displayName || t("admin.moduleSettings.staff.createPage.avatarAlt")}
                  seed={displayName || "new-staff-member"}
                  src={avatarPreviewUrl}
                />
              ) : (
                <span
                  aria-label={t("admin.moduleSettings.staff.createPage.avatarAlt")}
                  className="iz-glass iz-liquid-control grid size-[108px] place-items-center rounded-full bg-surface-2 text-muted ring-1 ring-border/60"
                  role="img"
                >
                  <UserRound size={46} strokeWidth={1.85} />
                </span>
              )}
              <span className="absolute bottom-1 right-1 grid size-9 place-items-center rounded-full border border-white/40 bg-primary text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
                <ImagePlus size={16} strokeWidth={2.35} />
              </span>
            </button>

            <input
              ref={avatarInputRef}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              id={avatarInputId}
              type="file"
              onChange={handleAvatarChange}
            />

            <div className="grid max-w-[420px] justify-items-center gap-1.5">
              <h2 className="ios-title-2 max-w-full text-center font-semibold tracking-normal text-foreground">
                {t("admin.moduleSettings.staff.createPage.heroTitle")}
              </h2>
              <p className="ios-footnote max-w-[360px] text-muted">
                {t("admin.moduleSettings.staff.createPage.hint")}
              </p>
              {avatarError ? (
                <p
                  id={`${avatarInputId}-error`}
                  className="ios-caption-1 max-w-[320px] text-danger"
                >
                  {avatarError}
                </p>
              ) : null}
            </div>
          </section>

          <section className="grid w-full justify-self-stretch gap-3">
            <Input
              autoFocus
              clearLabel={t("common.actions.clear")}
              disabled={Boolean(createdStaffMember)}
              placeholder={t("admin.moduleSettings.staff.dialog.namePlaceholder")}
              value={displayName}
              wide
              onChange={(event) => setDisplayName(event.target.value)}
            />
            <Input
              clearLabel={t("common.actions.clear")}
              hint={t("admin.moduleSettings.staff.dialog.roleHint")}
              placeholder={t("admin.moduleSettings.staff.dialog.rolePlaceholder")}
              value={roleTitle}
              wide
              onChange={(event) => setRoleTitle(event.target.value)}
            />
          </section>
        </form>
      </main>
    </PageTransition>
  );
};
