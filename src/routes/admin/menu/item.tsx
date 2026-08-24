import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  Flame,
  ImagePlus,
  PackageCheck,
  Trash2,
  TriangleAlert
} from "lucide-react";
import * as React from "react";

import {
  Button,
  Input,
  List,
  PendingScreen,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Toggle
} from "~/common/ui";
import { cn } from "~/common/utils";
import { useI18n } from "~/shared/i18n/react";
import {
  MENU_ALLERGEN_CODES,
  MENU_DESCRIPTION_MAX_LENGTH,
  MENU_DIETARY_TAG_CODES,
  MENU_MARKETING_TAG_CODES,
  MENU_NAME_MAX_LENGTH,
  MENU_PORTION_LABEL_MAX_LENGTH,
  MENU_SPICE_LEVELS,
  type MenuAllergenCode,
  type MenuDietaryTagCode,
  type MenuItemPayload,
  type MenuMarketingTagCode,
  type MenuSpiceLevel
} from "~/shared/menu";
import {
  MEDIA_IMAGE_MAX_BYTES,
  isSupportedImageContentType,
  uploadImageAsset
} from "~/shared/media";
import { PageTransition } from "~/shared/router/page-transition";
import { showTmaPopup, useTma, useTmaBackButton, useTmaMainButton } from "~/shared/tma";

import {
  createAdminMenuItem,
  createMenuClientRequestId,
  deleteDetachedAdminMenuPhoto,
  deleteAdminMenuItem,
  reorderAdminMenuItems,
  setAdminMenuQueryData,
  updateAdminMenuItem,
  useAdminMenuQuery
} from "./api";
import {
  AdminMenuStateScreen,
  MenuItemCover,
  MenuListIcon,
  MenuOptionChips,
  MenuPageHeader,
  parsePriceMinor,
  priceMinorToInput,
  sortMenuEntities,
  useAdminMenuOrganization,
  useAdminMenuRouteParams
} from "./components";

type ItemFormMode = "create" | "edit";

const ChipSection = <T extends string>({
  disabled,
  getLabel,
  hint,
  onChange,
  options,
  selected,
  title
}: {
  disabled?: boolean;
  getLabel: (value: T) => string;
  hint: string;
  onChange: (values: T[]) => void;
  options: readonly T[];
  selected: readonly T[];
  title: string;
}) => (
  <section className="grid gap-2.5">
    <header className="px-4">
      <h2 className="ios-caption-1 font-semibold uppercase text-muted">{title}</h2>
    </header>
    <div className="iz-liquid-list rounded-[28px] border p-4">
      <MenuOptionChips
        disabled={disabled}
        getLabel={getLabel}
        options={options}
        selected={selected}
        onChange={onChange}
      />
    </div>
    <p className="ios-footnote px-4 text-muted">{hint}</p>
  </section>
);

const findMenuItem = (items: readonly MenuItemPayload[], itemId?: string) =>
  items.find((item) => item.id === itemId) ?? null;

const AdminMenuItemFormPage = ({ mode }: { mode: ItemFormMode }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useAdminMenuRouteParams();
  const tma = useTma();
  const { t } = useI18n();
  const { isLoading: isOrganizationsLoading, organization } = useAdminMenuOrganization(
    params.organizationId
  );
  const menuQuery = useAdminMenuQuery(organization?.id, tma.initDataRaw, tma.isReady);
  const menu = menuQuery.data?.menu ?? null;
  const categories = React.useMemo(
    () => sortMenuEntities(menu?.categories ?? []),
    [menu?.categories]
  );
  const category = categories.find((item) => item.id === params.categoryId) ?? null;
  const items = React.useMemo(() => sortMenuEntities(category?.items ?? []), [category?.items]);
  const item = mode === "edit" ? findMenuItem(items, params.itemId) : null;
  const itemIndex = item ? items.findIndex((candidate) => candidate.id === item.id) : -1;
  const minorUnit = menu?.currency.minorUnit ?? 0;

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [portionLabel, setPortionLabel] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [isVisible, setIsVisible] = React.useState(true);
  const [isAvailable, setIsAvailable] = React.useState(true);
  const [spiceLevel, setSpiceLevel] = React.useState<MenuSpiceLevel>(0);
  const [dietaryTagCodes, setDietaryTagCodes] = React.useState<MenuDietaryTagCode[]>([]);
  const [marketingTagCodes, setMarketingTagCodes] = React.useState<MenuMarketingTagCode[]>([]);
  const [allergenCodes, setAllergenCodes] = React.useState<MenuAllergenCode[]>([]);
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = React.useState<string | null>(null);
  const [removeExistingPhoto, setRemoveExistingPhoto] = React.useState(false);
  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isActing, setIsActing] = React.useState(false);
  const photoInputId = React.useId();
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const clientRequestIdRef = React.useRef(createMenuClientRequestId("menu-item"));
  const duplicateRequestIdRef = React.useRef(createMenuClientRequestId("menu-item-copy"));
  const duplicateInFlightRef = React.useRef(false);

  const clearLocalPhoto = React.useCallback(() => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }, [photoPreviewUrl]);

  React.useEffect(
    () => () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    },
    [photoPreviewUrl]
  );

  React.useEffect(() => {
    if (mode !== "edit" || !item) return;

    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
    setRemoveExistingPhoto(false);
    setPhotoError(null);
    setError(null);
  }, [item?.id, mode]);

  React.useEffect(() => {
    if (mode !== "edit" || !item) return;

    setName(item.name);
    setDescription(item.description);
    setPortionLabel(item.portionLabel);
    setPrice(priceMinorToInput(item.priceMinor, minorUnit));
    setIsVisible(item.isVisible);
    setIsAvailable(item.isAvailable);
    setSpiceLevel(item.spiceLevel);
    setDietaryTagCodes(item.dietaryTagCodes);
    setMarketingTagCodes(item.marketingTagCodes);
    setAllergenCodes(item.allergenCodes);
    setRemoveExistingPhoto(false);
  }, [item?.id, minorUnit, mode]);

  const backToCategory = React.useCallback(() => {
    if (!params.organizationId || !params.categoryId) return;
    void navigate({
      to: `/admin/${params.organizationId}/menu/categories/${params.categoryId}` as never
    });
  }, [navigate, params.categoryId, params.organizationId]);

  const backToMenu = React.useCallback(() => {
    if (!params.organizationId) return;
    void navigate({ to: `/admin/${params.organizationId}/menu` as never });
  }, [navigate, params.organizationId]);

  useTmaBackButton(true, menu ? backToCategory : backToMenu);

  const handlePhotoChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      event.target.value = "";

      if (!file) return;

      if (!isSupportedImageContentType(file.type)) {
        setPhotoError(t("admin.menu.items.photoErrors.type"));
        return;
      }

      if (file.size > MEDIA_IMAGE_MAX_BYTES) {
        setPhotoError(t("admin.menu.items.photoErrors.size"));
        return;
      }

      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
      setPhotoFile(file);
      setPhotoPreviewUrl(URL.createObjectURL(file));
      setRemoveExistingPhoto(false);
      setPhotoError(null);
    },
    [photoPreviewUrl, t]
  );

  const removePhoto = React.useCallback(() => {
    clearLocalPhoto();
    setRemoveExistingPhoto(true);
    setPhotoError(null);
  }, [clearLocalPhoto]);

  const uploadPhoto = React.useCallback(async () => {
    if (!photoFile || !organization) return undefined;

    const assets = await uploadImageAsset({
      file: photoFile,
      initDataRaw: tma.initDataRaw,
      kind: "MENU_ITEM_PHOTO",
      ownerId: organization.id,
      ownerType: "ORGANIZATION"
    });
    const photoAsset = assets.find((asset) => asset.kind === "MENU_ITEM_PHOTO");

    if (!photoAsset) {
      throw new Error("Menu item photo asset was not returned.");
    }

    return photoAsset.id;
  }, [organization, photoFile, tma.initDataRaw]);

  const saveItem = React.useCallback(async () => {
    const cleanName = name.trim();
    const priceMinor = parsePriceMinor(price, minorUnit);

    if (
      !organization ||
      !menu ||
      !category ||
      !cleanName ||
      priceMinor === null ||
      isSaving ||
      isActing
    ) {
      return;
    }

    setError(null);
    setPhotoError(null);
    setIsSaving(true);

    let uploadedPhotoMediaAssetId: string | undefined;

    try {
      uploadedPhotoMediaAssetId = await uploadPhoto();
      const mutableFields = {
        allergenCodes,
        description: description.trim(),
        dietaryTagCodes,
        isAvailable,
        isVisible,
        marketingTagCodes,
        name: cleanName,
        portionLabel: portionLabel.trim(),
        priceMinor,
        spiceLevel
      };
      const updated =
        mode === "create"
          ? await createAdminMenuItem(
              organization.id,
              category.id,
              {
                ...mutableFields,
                clientRequestId: clientRequestIdRef.current,
                photoMediaAssetId: uploadedPhotoMediaAssetId ?? null,
                sortOrder: (items.at(-1)?.sortOrder ?? -1) + 1
              },
              tma.initDataRaw
            )
          : item
            ? await updateAdminMenuItem(
                organization.id,
                item.id,
                {
                  ...mutableFields,
                  ...(uploadedPhotoMediaAssetId
                    ? { photoMediaAssetId: uploadedPhotoMediaAssetId }
                    : removeExistingPhoto
                      ? { photoMediaAssetId: null }
                      : {})
                },
                tma.initDataRaw
              )
            : null;

      if (!updated) throw new Error("Menu item is unavailable.");

      setAdminMenuQueryData(queryClient, updated, tma.initDataRaw);
      clearLocalPhoto();
      setRemoveExistingPhoto(false);
      tma.haptics.notification("success");

      if (mode === "create") backToCategory();
    } catch {
      if (uploadedPhotoMediaAssetId) {
        try {
          await deleteDetachedAdminMenuPhoto(
            organization.id,
            uploadedPhotoMediaAssetId,
            tma.initDataRaw
          );
        } catch {
          // Cleanup is best-effort. The asset may already be attached if the save
          // succeeded but its response did not reach the client.
        }
      }

      setError(t("admin.menu.errors.save"));
      tma.haptics.notification("error");
    } finally {
      setIsSaving(false);
    }
  }, [
    allergenCodes,
    backToCategory,
    category,
    clearLocalPhoto,
    description,
    dietaryTagCodes,
    isActing,
    isAvailable,
    isSaving,
    isVisible,
    item,
    items,
    marketingTagCodes,
    menu,
    minorUnit,
    mode,
    name,
    organization,
    portionLabel,
    price,
    queryClient,
    removeExistingPhoto,
    spiceLevel,
    t,
    tma.haptics,
    tma.initDataRaw,
    uploadPhoto
  ]);

  const cachePayload = React.useCallback(
    (payload: NonNullable<typeof menuQuery.data>) =>
      setAdminMenuQueryData(queryClient, payload, tma.initDataRaw),
    [queryClient, tma.initDataRaw]
  );

  const duplicateItem = React.useCallback(async () => {
    if (
      !organization ||
      !category ||
      !item ||
      isSaving ||
      isActing ||
      duplicateInFlightRef.current
    ) {
      return;
    }

    duplicateInFlightRef.current = true;
    setError(null);
    setIsActing(true);

    try {
      const previousIds = new Set(items.map((candidate) => candidate.id));
      const updated = await createAdminMenuItem(
        organization.id,
        category.id,
        {
          allergenCodes: item.allergenCodes,
          clientRequestId: duplicateRequestIdRef.current,
          description: item.description,
          dietaryTagCodes: item.dietaryTagCodes,
          isAvailable: item.isAvailable,
          isVisible: item.isVisible,
          marketingTagCodes: item.marketingTagCodes,
          name: item.name,
          // Photos are single-use media assets. A duplicate starts without a photo
          // so it can be saved independently without sharing or cloning R2 objects.
          photoMediaAssetId: null,
          portionLabel: item.portionLabel,
          priceMinor: item.priceMinor,
          sortOrder: (items.at(-1)?.sortOrder ?? -1) + 1,
          spiceLevel: item.spiceLevel
        },
        tma.initDataRaw
      );
      cachePayload(updated);
      duplicateRequestIdRef.current = createMenuClientRequestId("menu-item-copy");
      tma.haptics.notification("success");

      const createdItem = updated.menu?.categories
        .find((candidate) => candidate.id === category.id)
        ?.items.find((candidate) => !previousIds.has(candidate.id));

      if (createdItem) {
        void navigate({
          replace: true,
          to: `/admin/${organization.id}/menu/categories/${category.id}/items/${createdItem.id}` as never
        });
      }
    } catch {
      setError(t("admin.menu.errors.save"));
      tma.haptics.notification("error");
    } finally {
      duplicateInFlightRef.current = false;
      setIsActing(false);
    }
  }, [
    cachePayload,
    category,
    isActing,
    isSaving,
    item,
    items,
    navigate,
    organization,
    t,
    tma.haptics,
    tma.initDataRaw
  ]);

  const moveItem = React.useCallback(
    async (direction: "down" | "up") => {
      if (!organization || !item || isSaving || isActing) return;
      const neighbor = items[itemIndex + (direction === "up" ? -1 : 1)];
      if (!neighbor) return;

      setError(null);
      setIsActing(true);

      try {
        const orderedIds = items.map((candidate) => candidate.id);
        [orderedIds[itemIndex], orderedIds[itemIndex + (direction === "up" ? -1 : 1)]] = [
          neighbor.id,
          item.id
        ];
        const updated = await reorderAdminMenuItems(
          organization.id,
          item.categoryId,
          { orderedIds },
          tma.initDataRaw
        );
        cachePayload(updated);
        tma.haptics.notification("success");
      } catch {
        setError(t("admin.menu.errors.save"));
        tma.haptics.notification("error");
      } finally {
        setIsActing(false);
      }
    },
    [
      cachePayload,
      isActing,
      isSaving,
      item,
      itemIndex,
      items,
      organization,
      t,
      tma.haptics,
      tma.initDataRaw
    ]
  );

  const deleteItem = React.useCallback(async () => {
    if (!organization || !item || isSaving || isActing) return;

    const buttonId = await showTmaPopup({
      buttons: [
        { id: "delete", text: t("admin.menu.items.deleteConfirm"), type: "destructive" },
        { id: "cancel", type: "cancel" }
      ],
      message: t("admin.menu.items.deleteMessage"),
      title: t("admin.menu.items.deleteTitle")
    });

    if (buttonId !== "delete") return;

    setIsActing(true);

    try {
      const updated = await deleteAdminMenuItem(organization.id, item.id, tma.initDataRaw);
      cachePayload(updated);
      tma.haptics.notification("success");
      backToCategory();
    } catch {
      setError(t("admin.menu.errors.delete"));
      tma.haptics.notification("error");
    } finally {
      setIsActing(false);
    }
  }, [
    backToCategory,
    cachePayload,
    isActing,
    isSaving,
    item,
    organization,
    t,
    tma.haptics,
    tma.initDataRaw
  ]);

  const priceMinor = parsePriceMinor(price, minorUnit);
  const canSave =
    Boolean(organization) &&
    Boolean(category) &&
    Boolean(name.trim()) &&
    priceMinor !== null &&
    !isSaving &&
    !isActing;
  const mainButtonState = React.useMemo(
    () =>
      organization && category && (mode === "create" || item)
        ? {
            enabled: canSave,
            loading: isSaving,
            shine: canSave,
            text: t(
              mode === "create" ? "admin.menu.items.createAction" : "admin.menu.items.saveAction"
            )
          }
        : null,
    [canSave, category, isSaving, item, mode, organization, t]
  );

  useTmaMainButton(mainButtonState, saveItem);

  if ((isOrganizationsLoading && !organization) || (organization && menuQuery.isLoading)) {
    return <PendingScreen label={t("common.loading")} />;
  }

  if (!organization) {
    return (
      <AdminMenuStateScreen
        hint={t("admin.organizations.emptyHint")}
        title={t("admin.organizations.emptyTitle")}
      />
    );
  }

  if (menuQuery.isError) {
    return (
      <AdminMenuStateScreen
        actionLabel={t("admin.menu.actions.retry")}
        hint={t("admin.menu.errors.load")}
        title={t(mode === "create" ? "admin.menu.items.createTitle" : "admin.menu.items.editTitle")}
        onAction={() => void menuQuery.refetch()}
      />
    );
  }

  if (!menu) {
    return (
      <AdminMenuStateScreen
        actionLabel={t("admin.menu.actions.back")}
        hint={t("admin.menu.categories.currencyRequiredHint")}
        title={t(mode === "create" ? "admin.menu.items.createTitle" : "admin.menu.items.editTitle")}
        onAction={backToMenu}
      />
    );
  }

  if (!category || (mode === "edit" && !item)) {
    return (
      <AdminMenuStateScreen
        actionLabel={t("admin.menu.actions.back")}
        hint={t("admin.menu.items.notFoundHint")}
        title={t("admin.menu.items.notFoundTitle")}
        onAction={backToCategory}
      />
    );
  }

  const resolvedPhotoUrl = photoPreviewUrl ?? (!removeExistingPhoto ? item?.photoUrl : null);
  const isBusy = isSaving || isActing;
  const priceError =
    price.length > 0 && priceMinor === null ? t("admin.menu.items.fields.priceError") : undefined;

  return (
    <PageTransition>
      <main className="tma-page bg-surface text-foreground">
        <form
          className="account-shell"
          onSubmit={(event) => {
            event.preventDefault();
            void saveItem();
          }}
        >
          <MenuPageHeader
            hint={t(
              mode === "create" ? "admin.menu.items.createHint" : "admin.menu.items.editHint"
            )}
            title={
              name.trim() ||
              t(mode === "create" ? "admin.menu.items.createTitle" : "admin.menu.items.editTitle")
            }
          />

          <section className="grid gap-3 px-4">
            <button
              aria-describedby={photoError ? `${photoInputId}-error` : undefined}
              aria-label={t("admin.menu.items.fields.photoAction")}
              className={cn(
                "group relative overflow-hidden rounded-[30px] outline-none transition-opacity active:opacity-85",
                isBusy && "pointer-events-none opacity-60"
              )}
              disabled={isBusy}
              type="button"
              onClick={() => photoInputRef.current?.click()}
            >
              <MenuItemCover
                className="aspect-[16/10] w-full rounded-[30px]"
                item={item}
                name={name || t("admin.menu.items.fields.photoAlt")}
                photoUrl={resolvedPhotoUrl}
              />
              <span className="absolute bottom-3 right-3 grid size-10 place-items-center rounded-full border border-white/40 bg-primary text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
                <ImagePlus size={18} strokeWidth={2.35} />
              </span>
            </button>
            <input
              ref={photoInputRef}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              id={photoInputId}
              type="file"
              onChange={handlePhotoChange}
            />
            {resolvedPhotoUrl ? (
              <Button
                className="justify-self-center"
                disabled={isBusy}
                size="sm"
                type="destructive"
                variant="text"
                onClick={removePhoto}
              >
                {t("admin.menu.items.fields.removePhoto")}
              </Button>
            ) : null}
            {photoError ? (
              <p id={`${photoInputId}-error`} className="ios-footnote text-center text-danger">
                {photoError}
              </p>
            ) : null}
          </section>

          <section className="grid gap-3">
            <Input
              autoFocus={mode === "create"}
              clearLabel={t("common.actions.clear")}
              disabled={isBusy}
              maxLength={MENU_NAME_MAX_LENGTH}
              placeholder={t("admin.menu.items.fields.namePlaceholder")}
              value={name}
              wide
              onChange={(event) => setName(event.target.value)}
            />
            <Textarea
              autoresize={{ maxHeight: 220 }}
              disabled={isBusy}
              maxLength={MENU_DESCRIPTION_MAX_LENGTH}
              placeholder={t("admin.menu.items.fields.descriptionPlaceholder")}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <Input
              clearLabel={t("common.actions.clear")}
              disabled={isBusy}
              maxLength={MENU_PORTION_LABEL_MAX_LENGTH}
              placeholder={t("admin.menu.items.fields.portionPlaceholder")}
              value={portionLabel}
              wide
              onChange={(event) => setPortionLabel(event.target.value)}
            />
            <Input
              addon={{
                after: (
                  <span className="ios-footnote font-semibold text-muted">
                    {menu.currency.code}
                  </span>
                )
              }}
              disabled={isBusy}
              error={priceError}
              inputMode="decimal"
              placeholder={t("admin.menu.items.fields.pricePlaceholder")}
              value={price}
              wide
              onChange={(event) => setPrice(event.target.value)}
            />
          </section>

          <List
            hint={t("admin.menu.items.visibilityHint")}
            items={[
              {
                addon: {
                  after: (
                    <Toggle
                      aria-label={t("admin.menu.items.fields.visible")}
                      checked={isVisible}
                      disabled={isBusy}
                      onCheckedChange={setIsVisible}
                    />
                  ),
                  before: <MenuListIcon icon={Eye} tone="visibility" />
                },
                isAction: false,
                title: t("admin.menu.items.fields.visible")
              },
              {
                addon: {
                  after: (
                    <Toggle
                      aria-label={t("admin.menu.items.fields.available")}
                      checked={isAvailable}
                      disabled={isBusy}
                      onCheckedChange={setIsAvailable}
                    />
                  ),
                  before: <MenuListIcon icon={PackageCheck} tone="available" />
                },
                isAction: false,
                title: t("admin.menu.items.fields.available")
              }
            ]}
          />

          <List
            hint={t("admin.menu.items.spiceHint")}
            items={[
              {
                addon: {
                  after: (
                    <Select
                      disabled={isBusy}
                      value={String(spiceLevel)}
                      onValueChange={(value) => setSpiceLevel(Number(value) as MenuSpiceLevel)}
                    >
                      <SelectTrigger className="w-[150px] rounded-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MENU_SPICE_LEVELS.map((level) => (
                          <SelectItem key={level} value={String(level)}>
                            {t(`admin.menu.spice.${level}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ),
                  before: <MenuListIcon icon={Flame} tone="spice" />
                },
                isAction: false,
                title: t("admin.menu.items.fields.spice")
              }
            ]}
          />

          <ChipSection
            disabled={isBusy}
            getLabel={(code) => t(`admin.menu.tags.dietary.${code}`)}
            hint={t("admin.menu.tags.dietaryHint")}
            options={MENU_DIETARY_TAG_CODES}
            selected={dietaryTagCodes}
            title={t("admin.menu.tags.dietaryTitle")}
            onChange={setDietaryTagCodes}
          />
          <ChipSection
            disabled={isBusy}
            getLabel={(code) => t(`admin.menu.tags.marketing.${code}`)}
            hint={t("admin.menu.tags.marketingHint")}
            options={MENU_MARKETING_TAG_CODES}
            selected={marketingTagCodes}
            title={t("admin.menu.tags.marketingTitle")}
            onChange={setMarketingTagCodes}
          />
          <ChipSection
            disabled={isBusy}
            getLabel={(code) => t(`admin.menu.allergens.${code}`)}
            hint={t("admin.menu.allergens.hint")}
            options={MENU_ALLERGEN_CODES}
            selected={allergenCodes}
            title={t("admin.menu.allergens.title")}
            onChange={setAllergenCodes}
          />

          {mode === "edit" && item ? (
            <List
              items={[
                {
                  addon: { before: <MenuListIcon icon={Copy} tone="duplicate" /> },
                  disabled: isBusy,
                  onClick: () => void duplicateItem(),
                  title: t("admin.menu.actions.duplicate")
                },
                {
                  addon: { before: <MenuListIcon icon={ArrowUp} tone="move" /> },
                  disabled: itemIndex <= 0 || isBusy,
                  onClick: () => void moveItem("up"),
                  title: t("admin.menu.actions.moveUp")
                },
                {
                  addon: { before: <MenuListIcon icon={ArrowDown} tone="move" /> },
                  disabled: itemIndex < 0 || itemIndex >= items.length - 1 || isBusy,
                  onClick: () => void moveItem("down"),
                  title: t("admin.menu.actions.moveDown")
                },
                {
                  addon: { before: <MenuListIcon icon={Trash2} tone="allergen" /> },
                  disabled: isBusy,
                  onClick: () => void deleteItem(),
                  title: t("admin.menu.items.deleteAction"),
                  variant: "destructive"
                }
              ]}
            />
          ) : null}

          {error ? (
            <p className="ios-footnote flex items-center gap-2 px-4 text-danger">
              <TriangleAlert size={15} strokeWidth={2.25} />
              {error}
            </p>
          ) : null}
        </form>
      </main>
    </PageTransition>
  );
};

export const AdminMenuItemCreatePage = () => <AdminMenuItemFormPage mode="create" />;

export const AdminMenuItemPage = () => <AdminMenuItemFormPage mode="edit" />;
