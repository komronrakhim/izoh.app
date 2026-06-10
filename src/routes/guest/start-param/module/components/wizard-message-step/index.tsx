import { ImagePlus, Trash2, X } from "lucide-react";
import type { ChangeEvent } from "react";

import { Spinner } from "~/common/ui";
import { cn } from "~/common/utils";
import { SUBMISSION_PHOTO_LIMIT } from "~/shared/submissions";

import type { CustomerWizardTranslate, PhotoInputRef, SubmissionPhotoDraft } from "../../types";

type WizardMessageStepProps = {
  bodyText: string;
  helperText: string;
  helperTone: "danger" | "muted";
  onBodyTextChange: (value: string) => void;
  onPhotoFiles: (files: FileList | null) => void;
  onRemovePhoto: (clientId: string) => void;
  photoInputRef: PhotoInputRef;
  photoHint: string;
  photos: SubmissionPhotoDraft[];
  photosEnabled: boolean;
  placeholder: string;
  t: CustomerWizardTranslate;
};

export const WizardMessageStep = ({
  bodyText,
  helperText,
  helperTone,
  onBodyTextChange,
  onPhotoFiles,
  onRemovePhoto,
  photoInputRef,
  photoHint,
  photos,
  photosEnabled,
  placeholder,
  t
}: WizardMessageStepProps) => {
  const handlePhotoInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    onPhotoFiles(event.currentTarget.files);
    event.currentTarget.value = "";
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <textarea
          className={cn(
            "min-h-[156px] w-full resize-none rounded-[28px] bg-surface-2 px-4 py-4 ios-body text-foreground caret-[color:var(--wizard-accent)] outline-none ring-1 ring-foreground/[0.06] transition-[box-shadow,background-color] placeholder:text-placeholder focus:ring-2 focus:ring-[color:var(--wizard-accent)]",
            helperTone === "danger" && "ring-danger/38"
          )}
          placeholder={placeholder}
          value={bodyText}
          onChange={(event) => onBodyTextChange(event.target.value)}
        />
        <p
          className={cn(
            "ios-footnote px-1",
            helperTone === "danger" ? "text-danger" : "text-muted"
          )}
        >
          {helperText}
        </p>
      </div>

      {photosEnabled ? (
        <div className="grid gap-2">
          <input
            ref={photoInputRef}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handlePhotoInputChange}
          />

          <div className="grid grid-cols-4 gap-2.5">
            {photos.map((photo, index) => (
              <div
                key={photo.clientId}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-[22px] bg-surface-2 ring-1 ring-foreground/[0.06]",
                  photo.status === "failed" && "ring-danger/50"
                )}
              >
                <img
                  src={photo.previewUrl}
                  alt={t("customer.attachPhotoSlot", {
                    index: index + 1
                  })}
                  className="size-full object-cover"
                />

                {photo.status === "uploading" ? (
                  <span className="absolute inset-0 grid place-items-center bg-black/26 text-white backdrop-blur-sm">
                    <Spinner size={20} />
                  </span>
                ) : null}

                {photo.status === "failed" ? (
                  <span className="absolute inset-0 grid place-items-center bg-danger/76 text-white backdrop-blur-sm">
                    <X size={21} strokeWidth={2.65} />
                  </span>
                ) : null}

                <button
                  type="button"
                  className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/42 text-white backdrop-blur-md transition-transform active:scale-95"
                  aria-label={t("customer.photos.remove")}
                  onClick={() => onRemovePhoto(photo.clientId)}
                >
                  <Trash2 size={13.5} strokeWidth={2.5} />
                </button>
              </div>
            ))}

            {photos.length < SUBMISSION_PHOTO_LIMIT ? (
              <button
                type="button"
                className="ios-touch-target grid aspect-square place-items-center rounded-[22px] bg-surface-2 text-muted ring-1 ring-foreground/[0.06] transition-[background-color,transform] active:scale-[0.97]"
                onClick={() => photoInputRef.current?.click()}
              >
                <span className="grid justify-items-center gap-1">
                  <ImagePlus size={22} strokeWidth={2.35} />
                  <span className="ios-caption-2 font-semibold">{t("customer.photos.add")}</span>
                </span>
              </button>
            ) : null}
          </div>

          <p className="ios-caption-1 px-1 text-muted">{photoHint}</p>
        </div>
      ) : null}
    </div>
  );
};
