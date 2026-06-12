import { fetchApiJson } from "~/shared/api";

import { requestTmaContactPhone, showTmaPopup } from "./sdk";

type TmaContactPickerCopy = {
  getUsernameLabel: (username: string) => string;
  quickPickMessage: string;
  quickPickTitle: string;
  usePhone: string;
};

type TmaContactPickerHaptics = {
  notification: (type: "error" | "success" | "warning") => unknown;
  selection: () => unknown;
};

type TmaSessionPayload = {
  user?: {
    phoneNumber?: null | string;
  };
};

type PickTmaContactInput = {
  copy: TmaContactPickerCopy;
  haptics?: TmaContactPickerHaptics;
  initDataRaw: string;
  onContact: (value: string) => void;
  username?: string;
};

export type TmaContactPickerResult = "cancelled" | "filled" | "unavailable";

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const waitForTelegramPopupToClose = () => wait(180);

const saveSharedPhoneNumber = async ({
  contactDataRaw,
  initDataRaw
}: {
  contactDataRaw: string;
  initDataRaw: string;
}) => {
  const payload = await fetchApiJson<TmaSessionPayload>("/api/tma/contact", {
    body: JSON.stringify({
      contactData: contactDataRaw,
      initData: initDataRaw
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  return payload.user?.phoneNumber?.trim() ?? "";
};

export const pickTmaContact = async ({
  copy,
  haptics,
  initDataRaw,
  onContact,
  username
}: PickTmaContactInput): Promise<TmaContactPickerResult> => {
  const normalizedUsername = username?.replace(/^@/, "").trim();
  const usernameValue = normalizedUsername ? `@${normalizedUsername}` : "";
  const selected = await showTmaPopup({
    buttons: [
      ...(usernameValue
        ? [
            {
              id: "username",
              text: copy.getUsernameLabel(usernameValue),
              type: "default" as const
            }
          ]
        : []),
      {
        id: "phone",
        text: copy.usePhone,
        type: "default"
      },
      {
        id: "cancel",
        type: "cancel"
      }
    ],
    message: copy.quickPickMessage,
    title: copy.quickPickTitle
  });

  if (selected === "username" && usernameValue) {
    onContact(usernameValue);
    haptics?.selection();

    return "filled";
  }

  if (selected !== "phone") {
    return "cancelled";
  }

  await waitForTelegramPopupToClose();

  const contactRequest = await requestTmaContactPhone();

  if (contactRequest.status !== "sent") {
    return contactRequest.status;
  }

  const savedPhoneNumber = await saveSharedPhoneNumber({
    contactDataRaw: contactRequest.contactDataRaw,
    initDataRaw
  });
  onContact(savedPhoneNumber || contactRequest.phoneNumber);
  haptics?.notification("success");

  return "filled";
};
