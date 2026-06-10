export type TmaColorScheme = "light" | "dark";

export type TmaLaunchContext = {
  isTelegram: boolean;
  initDataRaw: string;
  colorScheme?: TmaColorScheme;
  primaryColor?: `#${string}`;
  startParam?: string;
  platform?: string;
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
