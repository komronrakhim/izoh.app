export type TmaColorScheme = "light" | "dark";

export type TmaUserContext = {
  firstName?: string;
  id?: string;
  lastName?: string;
  username?: string;
};

export type TmaLaunchContext = {
  isTelegram: boolean;
  initDataRaw: string;
  colorScheme?: TmaColorScheme;
  primaryColor?: `#${string}`;
  startParam?: string;
  platform?: string;
  user?: TmaUserContext;
};

export type TmaButtonState = {
  color?: `#${string}`;
  enabled?: boolean;
  loading?: boolean;
  shine?: boolean;
  text: string;
  textColor?: `#${string}`;
  visible?: boolean;
};

export type TmaSecondaryButtonPosition = "left" | "right" | "top" | "bottom";

export type TmaSecondaryButtonState = TmaButtonState & {
  position?: TmaSecondaryButtonPosition;
};
