import { useNavigate } from "@tanstack/react-router";
import {
  Check,
  Coffee,
  Handshake,
  ImagePlus,
  Plus,
  ShoppingBag,
  Sparkles,
  X,
  type LucideIcon
} from "lucide-react";
import * as React from "react";

import { Avatar } from "~/common/components";
import { Input } from "~/common/ui";
import { cn } from "~/common/utils";
import {
  MAX_ADMIN_ORGANIZATIONS,
  useAdminOrganization,
  type AdminOrganization
} from "~/shared/admin";
import { useI18n } from "~/shared/i18n/react";
import { LOGO_MAX_BYTES, isSupportedImageContentType, uploadImageAsset } from "~/shared/media";
import {
  DEFAULT_ORGANIZATION_PRESET_ID,
  ORGANIZATION_PRESET_IDS,
  type OrganizationPresetId
} from "~/shared/organization-presets";
import { PageTransition } from "~/shared/router/page-transition";
import { getBrowserTimeZone } from "~/shared/time-zone";
import { pickTmaContact, useTma, useTmaBackButton, useTmaMainButton } from "~/shared/tma";

const presetIconMeta: Record<OrganizationPresetId, { icon: LucideIcon; tone: string }> = {
  cafe: {
    icon: Coffee,
    tone: "bg-[#FF9500] text-white"
  },
  other: {
    icon: Sparkles,
    tone: "bg-[#BF5AF2] text-white"
  },
  retail: {
    icon: ShoppingBag,
    tone: "bg-[#34C759] text-white"
  },
  services: {
    icon: Handshake,
    tone: "bg-[#007AFF] text-white"
  }
};

const ORGANIZATION_NAME_MIN_LENGTH = 2;
const ORGANIZATION_NAME_MAX_LENGTH = 80;
const ORGANIZATION_CONTACT_MAX_LENGTH = 120;

const createHeaders = (initDataRaw?: string, headers?: HeadersInit) => {
  const nextHeaders = new Headers(headers);

  if (initDataRaw) {
    nextHeaders.set("X-Telegram-Init-Data", initDataRaw);
  }

  return nextHeaders;
};

export const AdminOrganizationCreatePage = () => {
  const navigate = useNavigate();
  const tma = useTma();
  const { locale, t } = useI18n();
  const { createOrganization, organizations, refreshOrganizations, setActiveOrganizationId } =
    useAdminOrganization();
  const [name, setName] = React.useState("");
  const [contactText, setContactText] = React.useState("");
  const [businessType, setBusinessType] = React.useState<OrganizationPresetId>(
    DEFAULT_ORGANIZATION_PRESET_ID
  );
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = React.useState<string | null>(null);
  const [logoError, setLogoError] = React.useState<string | null>(null);
  const [createdOrganization, setCreatedOrganization] = React.useState<AdminOrganization | null>(
    null
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [isPickingContact, setIsPickingContact] = React.useState(false);
  const [didAttemptSubmit, setDidAttemptSubmit] = React.useState(false);
  const [didTouchName, setDidTouchName] = React.useState(false);
  const logoInputId = React.useId();
  const logoInputRef = React.useRef<HTMLInputElement>(null);

  const cleanName = name.trim();
  const cleanContactText = contactText.trim();
  const nameValidationError = React.useMemo(() => {
    if (!cleanName) {
      return t("admin.organizations.nameErrors.required");
    }

    if (cleanName.length < ORGANIZATION_NAME_MIN_LENGTH) {
      return t("admin.organizations.nameErrors.tooShort");
    }

    return "";
  }, [cleanName, t]);
  const displayedNameError =
    didAttemptSubmit || didTouchName ? nameValidationError || undefined : undefined;
  const isOrganizationLimitReached =
    !createdOrganization && organizations.length >= MAX_ADMIN_ORGANIZATIONS;

  const goBack = React.useCallback(() => {
    if (isSaving) {
      return;
    }

    void navigate({
      to: "/admin"
    });
  }, [isSaving, navigate]);

  useTmaBackButton(true, goBack);

  React.useEffect(() => {
    if (!isOrganizationLimitReached) {
      return;
    }

    void navigate({
      to: "/admin"
    });
  }, [isOrganizationLimitReached, navigate]);

  React.useEffect(
    () => () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    },
    [logoPreviewUrl]
  );

  const resetLogo = () => {
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }

    setLogoFile(null);
    setLogoPreviewUrl(null);
    setLogoError(null);

    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
  };

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (!isSupportedImageContentType(file.type)) {
      setLogoError(t("admin.organizations.logoErrors.type"));
      return;
    }

    if (file.size > LOGO_MAX_BYTES) {
      setLogoError(t("admin.organizations.logoErrors.size"));
      return;
    }

    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }

    setLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
    setLogoError(null);
  };

  const pickContact = React.useCallback(async () => {
    setIsPickingContact(true);

    try {
      await pickTmaContact({
        copy: {
          getUsernameLabel: (username) =>
            t("common.contactQuickFill.useUsername", {
              username
            }),
          quickPickMessage: t("common.contactQuickFill.message"),
          quickPickTitle: t("common.contactQuickFill.title"),
          usePhone: t("common.contactQuickFill.usePhone")
        },
        haptics: tma.haptics,
        initDataRaw: tma.initDataRaw,
        onContact: setContactText,
        username: tma.user?.username
      });
    } finally {
      setIsPickingContact(false);
    }
  }, [t, tma.haptics, tma.initDataRaw, tma.user?.username]);

  const attachLogo = React.useCallback(
    async (organization: AdminOrganization) => {
      if (!logoFile) {
        return;
      }

      const assets = await uploadImageAsset({
        file: logoFile,
        initDataRaw: tma.initDataRaw,
        kind: "ORGANIZATION_LOGO",
        ownerId: organization.id,
        ownerType: "ORGANIZATION"
      });
      const logoAsset = assets.find((asset) => asset.kind === "ORGANIZATION_LOGO");

      if (!logoAsset) {
        throw new Error("Logo asset was not returned.");
      }

      const response = await fetch(`/api/admin/organizations/${organization.id}/logo`, {
        body: JSON.stringify({
          logoMediaAssetId: logoAsset.id
        }),
        headers: createHeaders(tma.initDataRaw, {
          "Content-Type": "application/json"
        }),
        method: "PATCH"
      });

      if (!response.ok) {
        throw new Error("Logo attachment failed.");
      }
    },
    [logoFile, tma.initDataRaw]
  );

  const saveOrganization = React.useCallback(async () => {
    setDidAttemptSubmit(true);

    if (nameValidationError || isSaving || isOrganizationLimitReached) {
      if (nameValidationError) {
        tma.haptics.notification("error");
      }

      return;
    }

    setIsSaving(true);
    setLogoError(null);

    try {
      const organization =
        createdOrganization ??
        (await createOrganization({
          businessType,
          contactText: cleanContactText,
          locale,
          name: cleanName,
          timeZone: getBrowserTimeZone()
        }));

      if (!organization) {
        throw new Error("Organization was not created.");
      }

      setCreatedOrganization(organization);

      await attachLogo(organization);
      await refreshOrganizations();
      setActiveOrganizationId(organization.id);
      tma.haptics.notification("success");

      void navigate({
        params: {
          organizationId: organization.id
        },
        to: "/admin/$organizationId"
      });
    } catch {
      setLogoError(t("admin.organizations.createError"));
      tma.haptics.notification("error");
    } finally {
      setIsSaving(false);
    }
  }, [
    attachLogo,
    businessType,
    createOrganization,
    createdOrganization,
    cleanName,
    cleanContactText,
    isOrganizationLimitReached,
    isSaving,
    locale,
    navigate,
    nameValidationError,
    refreshOrganizations,
    setActiveOrganizationId,
    t,
    tma.haptics
  ]);

  const canSave = !isSaving && !createdOrganization && !isOrganizationLimitReached;
  const mainButtonText = createdOrganization
    ? t("admin.organizations.savingLogo")
    : t("admin.organizations.createAction");
  const mainButtonState = React.useMemo(
    () => ({
      enabled: canSave,
      loading: isSaving,
      shine: canSave && !nameValidationError,
      text: mainButtonText
    }),
    [canSave, isSaving, mainButtonText, nameValidationError]
  );

  useTmaMainButton(mainButtonState, saveOrganization);

  return (
    <PageTransition>
      <main className="tma-page bg-surface text-foreground">
        <form
          className="account-shell min-h-[calc(var(--iz-visual-viewport-height,100dvh)-48px)] content-center"
          onSubmit={(event) => {
            event.preventDefault();
            void saveOrganization();
          }}
        >
          <section className="grid justify-items-center gap-4 px-1 text-center">
            <button
              aria-describedby={logoError ? `${logoInputId}-error` : undefined}
              className={cn(
                "group relative rounded-full outline-none transition-opacity active:opacity-80",
                isSaving && "pointer-events-none opacity-70"
              )}
              type="button"
              onClick={() => {
                tma.haptics.impact("light");
                logoInputRef.current?.click();
              }}
            >
              <Avatar
                alt={name || t("admin.organizations.logoAlt")}
                className="size-[112px] rounded-full ring-1 ring-border/60"
                initialsClassName="ios-large-title"
                name={name || t("common.brand")}
                seed={name || "new-organization"}
                src={logoPreviewUrl ?? undefined}
              />
              <span className="absolute bottom-1 right-1 grid size-9 place-items-center rounded-full border border-white/40 bg-primary text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
                <ImagePlus size={16} strokeWidth={2.35} />
              </span>
            </button>

            <input
              ref={logoInputRef}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              id={logoInputId}
              type="file"
              onChange={handleLogoChange}
            />

            <div className="grid max-w-[420px] justify-items-center gap-1.5">
              <h1 className="ios-title-1 max-w-[340px] text-balance font-semibold tracking-normal text-foreground">
                {t("admin.organizations.createHeroTitle")}
              </h1>
              <p className="ios-body max-w-[340px] text-balance text-muted">
                {t("admin.organizations.createHint")}
              </p>
            </div>
          </section>

          <section className="grid gap-4 px-1">
            {logoFile ? (
              <button
                className="mx-auto inline-flex min-h-10 max-w-full items-center gap-2 rounded-full bg-foreground/8 px-3.5 text-muted transition-colors active:bg-foreground/12"
                type="button"
                onClick={resetLogo}
              >
                <span className="ios-footnote truncate font-semibold">
                  {t("admin.organizations.logoSelected")}
                </span>
                <X aria-hidden="true" size={14} strokeWidth={2.35} />
              </button>
            ) : null}

            {logoError ? (
              <p id={`${logoInputId}-error`} className="ios-footnote px-4 text-center text-danger">
                {logoError}
              </p>
            ) : null}

            <div className="grid gap-3">
              <Input
                autoComplete="organization"
                clearLabel={t("common.actions.clear")}
                disabled={Boolean(createdOrganization)}
                enterKeyHint="next"
                error={displayedNameError}
                maxLength={ORGANIZATION_NAME_MAX_LENGTH}
                placeholder={t("admin.organizations.namePlaceholder")}
                size="lg"
                value={name}
                wide
                onBlur={() => setDidTouchName(true)}
                onChange={(event) => setName(event.target.value)}
              />
              <Input
                addon={{
                  after:
                    contactText || createdOrganization ? null : (
                      <button
                        aria-label={t("common.contactQuickFill.add")}
                        className="relative grid size-7 place-items-center rounded-full bg-primary text-white shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-[opacity,transform] active:scale-95 disabled:pointer-events-none disabled:opacity-58 [&_svg]:absolute [&_svg]:left-1/2 [&_svg]:top-1/2 [&_svg]:block [&_svg]:-translate-x-1/2 [&_svg]:-translate-y-1/2"
                        disabled={isPickingContact || isSaving}
                        type="button"
                        onClick={pickContact}
                      >
                        <Plus size={15} strokeWidth={3} />
                      </button>
                    )
                }}
                autoComplete="off"
                clearLabel={t("common.actions.clear")}
                clearable={Boolean(contactText)}
                disabled={Boolean(createdOrganization)}
                enterKeyHint="done"
                hint={t("admin.organizations.contactHint")}
                maxLength={ORGANIZATION_CONTACT_MAX_LENGTH}
                placeholder={t("admin.organizations.contactPlaceholder")}
                size="lg"
                value={contactText}
                wide
                onChange={(event) => setContactText(event.target.value)}
              />
            </div>

            <div className="grid gap-2.5">
              <div className="grid grid-cols-2 gap-2">
                {ORGANIZATION_PRESET_IDS.map((presetId) => {
                  const isSelected = businessType === presetId;
                  const meta = presetIconMeta[presetId];
                  const Icon = meta.icon;

                  return (
                    <button
                      key={presetId}
                      className={cn(
                        "flex min-h-12 items-center gap-2.5 rounded-full bg-surface-2 px-3.5 text-left text-foreground transition-[background-color,box-shadow,opacity] active:bg-surface-3",
                        isSelected &&
                          "shadow-[inset_0_0_0_2px_color-mix(in_srgb,var(--iz-color-primary)_72%,transparent)]"
                      )}
                      type="button"
                      onClick={() => {
                        tma.haptics.selection();
                        setBusinessType(presetId);
                      }}
                    >
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-[9px] [&>svg]:size-[15px]",
                          meta.tone
                        )}
                      >
                        <Icon strokeWidth={2.35} />
                      </span>
                      <span className="ios-subhead min-w-0 flex-1 truncate font-medium">
                        {t(`admin.organizations.presets.${presetId}`)}
                      </span>
                      {isSelected ? (
                        <Check
                          aria-hidden="true"
                          className="shrink-0 text-primary"
                          size={16}
                          strokeWidth={2.5}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <p className="ios-footnote px-4 text-muted">{t("admin.organizations.presetHint")}</p>
            </div>
          </section>
        </form>
      </main>
    </PageTransition>
  );
};
