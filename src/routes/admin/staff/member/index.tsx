import { useNavigate, useParams } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Save, Trash2, UserRound } from "lucide-react";
import * as React from "react";

import { Avatar } from "~/common/components";
import { Button, Input, List, ListIcon, PendingScreen, Toggle } from "~/common/ui";
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
import { showTmaPopup, useTma, useTmaBackButton, useTmaMainButton } from "~/shared/tma";

const STAFF_AVATAR_MAX_BYTES = getMediaImageSizeLimit("STAFF_AVATAR");

const createHeaders = (initDataRaw?: string, headers?: HeadersInit) => {
  const nextHeaders = new Headers(headers);

  if (initDataRaw) {
    nextHeaders.set("X-Telegram-Init-Data", initDataRaw);
  }

  return nextHeaders;
};

export const AdminStaffMemberPage = () => {
  const navigate = useNavigate();
  const params = useParams({ from: "/admin/$organizationId/staff/$staffMemberId" });
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
  const [staffMember, setStaffMember] = React.useState<StaffMemberItem | null>(null);
  const [displayName, setDisplayName] = React.useState("");
  const [roleTitle, setRoleTitle] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = React.useState<string | null>(null);
  const [avatarError, setAvatarError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
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

  React.useEffect(() => {
    if (!organization) {
      setIsLoading(isOrganizationsLoading);
      return;
    }

    const abortController = new AbortController();
    let didAbort = false;

    setIsLoading(true);

    void fetch(`/api/organizations/${organization.id}/staff-members/${params.staffMemberId}`, {
      headers: createHeaders(tma.initDataRaw),
      signal: abortController.signal
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Staff member loading failed.");
        }

        const payload = (await response.json()) as StaffMembersPayload;
        const item = payload.item ?? payload.items[0] ?? null;

        if (didAbort) {
          return;
        }

        if (!item) {
          throw new Error("Staff member was not returned.");
        }

        setStaffMember(item);
        setDisplayName(item.displayName);
        setRoleTitle(item.roleTitle);
        setIsActive(item.isActive);
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") return;
        if (didAbort) return;

        tma.haptics.notification("error");
        backToStaff();
      })
      .finally(() => {
        if (!didAbort) {
          setIsLoading(false);
        }
      });

    return () => {
      didAbort = true;
      abortController.abort();
    };
  }, [backToStaff, isOrganizationsLoading, organization, params.staffMemberId, t, tma.initDataRaw]);

  const resetAvatarSelection = () => {
    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }

    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    setAvatarError(null);

    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  };

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

  const uploadAvatar = async () => {
    if (!avatarFile || !staffMember) {
      return undefined;
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

    return avatarAsset.id;
  };

  const saveStaffMember = React.useCallback(async () => {
    if (!organization || !staffMember || isSaving) {
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
      const uploadedAvatarMediaAssetId = await uploadAvatar();
      const response = await fetch(
        `/api/organizations/${organization.id}/staff-members/${staffMember.id}`,
        {
          body: JSON.stringify({
            ...(uploadedAvatarMediaAssetId
              ? { avatarMediaAssetId: uploadedAvatarMediaAssetId }
              : {}),
            displayName: cleanDisplayName,
            isActive,
            roleTitle: cleanRoleTitle
          }),
          headers: createHeaders(tma.initDataRaw, {
            "Content-Type": "application/json"
          }),
          method: "PATCH"
        }
      );

      if (!response.ok) {
        throw new Error("Staff member save failed.");
      }

      const payload = (await response.json()) as StaffMembersPayload;
      const updated =
        payload.item ?? payload.items.find((item) => item.id === staffMember.id) ?? staffMember;

      setStaffMember(updated);
      setDisplayName(updated.displayName);
      setRoleTitle(updated.roleTitle);
      setIsActive(updated.isActive);
      resetAvatarSelection();
      await queryClient.invalidateQueries({
        queryKey: queryKeys.staffMembers(organization.id, tma.initDataRaw)
      });
      await refreshOrganizations();
      tma.haptics.notification("success");
    } catch {
      setAvatarError(t("admin.moduleSettings.staff.editPage.error"));
      tma.haptics.notification("error");
    } finally {
      setIsSaving(false);
    }
  }, [
    displayName,
    isActive,
    isSaving,
    organization,
    queryClient,
    refreshOrganizations,
    roleTitle,
    staffMember,
    t,
    tma.haptics,
    tma.initDataRaw,
    uploadAvatar
  ]);

  const handleDelete = async () => {
    if (!organization || !staffMember || isDeleting) {
      return;
    }

    tma.haptics.impact("medium");

    const buttonId = await showTmaPopup({
      buttons: [
        {
          id: "delete",
          text: t("admin.moduleSettings.staff.editPage.deletePopup.confirm"),
          type: "destructive"
        },
        {
          id: "cancel",
          type: "cancel"
        }
      ],
      message: t("admin.moduleSettings.staff.editPage.deletePopup.message"),
      title: t("admin.moduleSettings.staff.editPage.deletePopup.title")
    });

    if (buttonId !== "delete") {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/organizations/${organization.id}/staff-members/${staffMember.id}`,
        {
          headers: createHeaders(tma.initDataRaw),
          method: "DELETE"
        }
      );

      if (!response.ok) {
        throw new Error("Staff member deletion failed.");
      }

      await queryClient.invalidateQueries({
        queryKey: queryKeys.staffMembers(organization.id, tma.initDataRaw)
      });
      await refreshOrganizations();
      tma.haptics.notification("success");
      backToStaff();
    } catch {
      tma.haptics.notification("error");
    } finally {
      setIsDeleting(false);
    }
  };

  const resolvedAvatarUrl = avatarPreviewUrl ?? staffMember?.avatarUrl ?? null;
  const canSave = Boolean(displayName.trim()) && Boolean(staffMember) && !isLoading && !isSaving;
  const heroTitle = displayName.trim() || t("admin.moduleSettings.staff.editPage.title");
  const mainButtonText = t("admin.moduleSettings.staff.dialog.save");
  const mainButtonState = React.useMemo(
    () =>
      staffMember
        ? {
            enabled: canSave,
            loading: isSaving,
            shine: canSave,
            text: mainButtonText
          }
        : null,
    [canSave, isSaving, mainButtonText, staffMember]
  );

  useTmaMainButton(mainButtonState, saveStaffMember);

  if (isLoading && !staffMember) {
    return (
      <PageTransition>
        <PendingScreen label={t("common.loading")} />
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
                (isLoading || isSaving) && "pointer-events-none opacity-70"
              )}
              type="button"
              onClick={() => avatarInputRef.current?.click()}
            >
              {resolvedAvatarUrl ? (
                <Avatar
                  alt={displayName || t("admin.moduleSettings.staff.createPage.avatarAlt")}
                  className="size-[108px] rounded-full ring-1 ring-border/60"
                  initialsClassName="ios-large-title"
                  name={displayName || t("admin.moduleSettings.staff.createPage.avatarAlt")}
                  seed={staffMember?.id ?? params.staffMemberId}
                  src={resolvedAvatarUrl}
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
                {heroTitle}
              </h2>
              <p className="ios-footnote max-w-[360px] text-muted">
                {roleTitle || t("admin.moduleSettings.staff.editPage.heroHint")}
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
              disabled={isLoading}
              placeholder={t("admin.moduleSettings.staff.dialog.namePlaceholder")}
              value={displayName}
              wide
              onChange={(event) => setDisplayName(event.target.value)}
            />
            <Input
              clearLabel={t("common.actions.clear")}
              disabled={isLoading}
              hint={t("admin.moduleSettings.staff.dialog.roleHint")}
              placeholder={t("admin.moduleSettings.staff.dialog.rolePlaceholder")}
              value={roleTitle}
              wide
              onChange={(event) => setRoleTitle(event.target.value)}
            />
          </section>

          <List
            items={[
              {
                addon: {
                  before: (
                    <ListIcon
                      className={isActive ? "bg-[#34C759] text-white" : "bg-[#FF3B30] text-white"}
                    >
                      <UserRound size={15} strokeWidth={2.35} />
                    </ListIcon>
                  ),
                  after: (
                    <Toggle
                      aria-label={t("admin.moduleSettings.staff.dialog.activeTitle")}
                      checked={isActive}
                      disabled={isLoading || isSaving}
                      onCheckedChange={setIsActive}
                    />
                  )
                },
                isAction: false,
                title: t("admin.moduleSettings.staff.dialog.activeTitle")
              },
              {
                addon: {
                  before: (
                    <ListIcon className="bg-[#FF3B30] text-white">
                      <Trash2 size={15} strokeWidth={2.35} />
                    </ListIcon>
                  )
                },
                disabled: isLoading || isSaving || isDeleting,
                onClick: handleDelete,
                title: t("admin.moduleSettings.staff.editPage.delete"),
                variant: "destructive"
              }
            ]}
          />

          <section className="grid gap-3 px-4">
            <Button
              className="tma-fallback-action"
              disabled={!canSave}
              state={isSaving ? "loading" : "idle"}
              type="submit"
              wide
            >
              <Save size={16} />
              {mainButtonText}
            </Button>
          </section>
        </form>
      </main>
    </PageTransition>
  );
};
