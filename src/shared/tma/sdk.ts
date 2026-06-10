import {
  bindMiniAppCssVars,
  bindThemeParamsCssVars,
  bindViewportCssVars,
  disableVerticalSwipes,
  enableClosingConfirmation,
  expandViewport,
  hapticFeedbackImpactOccurred,
  hapticFeedbackNotificationOccurred,
  hapticFeedbackSelectionChanged,
  hideBackButton,
  init,
  miniAppReady,
  mountBackButton,
  mountMainButton,
  mountMiniAppSync,
  mountSwipeBehavior,
  mountThemeParamsSync,
  mountViewport,
  onMainButtonClick,
  onBackButtonClick,
  openTelegramLink,
  requestContentSafeAreaInsets,
  retrieveLaunchParams,
  retrieveRawInitData,
  requestSafeAreaInsets,
  setMainButtonParams,
  setMiniAppBackgroundColor,
  setMiniAppBottomBarColor,
  setMiniAppHeaderColor,
  showPopup,
  showBackButton,
  unmountMainButton,
  isThemeParamsDark,
  themeParamsButtonColor,
  themeParamsButtonTextColor,
  viewportContentSafeAreaInsetTop
} from "@telegram-apps/sdk";
import type { ShowPopupOptions, ShowPopupOptionsButton } from "@telegram-apps/sdk";

import type { TmaButtonState, TmaColorScheme, TmaLaunchContext } from "./types";

let didInit = false;
let backButtonVisibleCount = 0;
let backButtonHideTimeout: number | undefined;
let mainButtonVisibleCount = 0;
let mainButtonHideTimeout: number | undefined;
const hiddenMainButtonText = "Continue";
const preferredDarkMediaQuery = "(prefers-color-scheme: dark)";
const tmaPrimaryCssVar = "--iz-tma-primary";
const tmaPrimaryForegroundCssVar = "--iz-tma-primary-foreground";
const tmaTopOverlayFallbackCssVar = "--iz-tma-top-overlay-fallback";
const tmaBackgroundCssVar = "--iz-tma-bg";
const tmaHeaderBackgroundCssVar = "--iz-tma-header-bg";
const tmaBottomBackgroundCssVar = "--iz-tma-bottom-bg";

type TelegramWebAppLike = {
  colorScheme?: string;
  MainButton?: {
    disable?: () => void;
    enable?: () => void;
    hide?: () => void;
    hideProgress?: () => void;
    setParams?: (params: Record<string, unknown>) => void;
    setText?: (text: string) => void;
    show?: () => void;
    showProgress?: (leaveActive?: boolean) => void;
  };
  offEvent?: (eventType: string, eventHandler: () => void) => void;
  onEvent?: (eventType: string, eventHandler: () => void) => void;
  platform?: string;
};

type TmaChromeColorToken =
  | typeof tmaBackgroundCssVar
  | typeof tmaHeaderBackgroundCssVar
  | typeof tmaBottomBackgroundCssVar;

export type TmaPopupButton = ShowPopupOptionsButton;

export type TmaPopupOptions = Pick<ShowPopupOptions, "buttons" | "message" | "title">;

const safe = <T>(fallback: T, fn: () => T) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

const callIfAvailable = <Args extends unknown[]>(
  fn: ((...args: Args) => unknown) & {
    ifAvailable?: (...args: Args) => [called: true, data: unknown] | [called: false];
  },
  ...args: Args
) => {
  if (!isTelegramEnvironment()) {
    return undefined;
  }

  try {
    if (typeof fn.ifAvailable === "function") {
      const result = fn.ifAvailable(...args);
      return result[0] ? result[1] : undefined;
    }

    return fn(...args);
  } catch {
    // Telegram methods are best-effort because the app also runs in browser during development.
    return undefined;
  }
};

const isHexColor = (value: unknown): value is `#${string}` =>
  typeof value === "string" && /^#[\da-f]{6}$/i.test(value);

const normalizeHexColor = (value: string): `#${string}` | undefined => {
  const color = value.trim();

  if (/^#[\da-f]{6}$/i.test(color)) {
    return color.toLowerCase() as `#${string}`;
  }

  if (/^#[\da-f]{3}$/i.test(color)) {
    const [, r, g, b] = color;

    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase() as `#${string}`;
  }

  return undefined;
};

const channelsToHex = (channels: string[], multiplier = 1): `#${string}` =>
  channels.reduce((result, channel) => {
    const channelValue = Math.max(0, Math.min(255, Math.round(Number(channel) * multiplier)));

    return `${result}${channelValue.toString(16).padStart(2, "0")}`;
  }, "#") as `#${string}`;

const cssColorToHex = (value: string): `#${string}` | undefined => {
  const hexColor = normalizeHexColor(value);

  if (hexColor) {
    return hexColor;
  }

  const rgbMatch = value.trim().match(/^rgba?\(\s*([\d.]+)(?:,|\s)+([\d.]+)(?:,|\s)+([\d.]+)/i);

  if (rgbMatch) {
    const [, red, green, blue] = rgbMatch;

    return channelsToHex([red, green, blue]);
  }

  const srgbMatch = value.trim().match(/^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);

  if (!srgbMatch) {
    return undefined;
  }

  const [, red, green, blue] = srgbMatch;

  return channelsToHex([red, green, blue], 255);
};

const getTelegramWebApp = (): TelegramWebAppLike | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (
    window as Window & {
      Telegram?: {
        WebApp?: TelegramWebAppLike;
      };
    }
  ).Telegram?.WebApp;
};

const getTelegramPlatform = () => {
  const webAppPlatform = getTelegramWebApp()?.platform;

  if (webAppPlatform) {
    return webAppPlatform;
  }

  return isTelegramEnvironment()
    ? safe(undefined as string | undefined, () => {
        const launchParams = retrieveLaunchParams() as Record<string, unknown>;

        return typeof launchParams.tgWebAppPlatform === "string"
          ? launchParams.tgWebAppPlatform
          : undefined;
      })
    : undefined;
};

const isTelegramIos = () => {
  if (!isTelegramEnvironment()) {
    return false;
  }

  const platform = getTelegramPlatform()?.toLowerCase() ?? "";

  if (platform.includes("ios") || platform.includes("iphone") || platform.includes("ipad")) {
    return true;
  }

  if (typeof navigator === "undefined") {
    return false;
  }

  return /iphone|ipad|ipod/i.test(navigator.userAgent);
};

const hasTelegramLaunchParams = () => {
  if (typeof window === "undefined") {
    return false;
  }

  if (window.location.href.includes("tgWebApp")) {
    return true;
  }

  return safe(false, () => localStorage.getItem("launchParams")?.includes("tgWebApp") ?? false);
};

const hasTelegramSdkLaunchParams = () =>
  safe(false, () => Boolean(retrieveRawInitData() || retrieveLaunchParams()));

const isTelegramEnvironment = () =>
  Boolean(getTelegramWebApp()) || hasTelegramLaunchParams() || hasTelegramSdkLaunchParams();

const getSystemColorScheme = (): TmaColorScheme => {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia?.(preferredDarkMediaQuery).matches ? "dark" : "light";
};

const getUnsafeTelegramColorScheme = (): TmaColorScheme | undefined => {
  const colorScheme = getTelegramWebApp()?.colorScheme;

  return colorScheme === "dark" || colorScheme === "light" ? colorScheme : undefined;
};

const getTelegramThemeParamsColorScheme = (): TmaColorScheme | undefined =>
  safe(undefined as TmaColorScheme | undefined, () => (isThemeParamsDark() ? "dark" : "light"));

const getResolvedColorScheme = (isTelegramEnvironment: boolean): TmaColorScheme => {
  if (isTelegramEnvironment) {
    return (
      getUnsafeTelegramColorScheme() ??
      getTelegramThemeParamsColorScheme() ??
      getSystemColorScheme()
    );
  }

  return getSystemColorScheme();
};

const getResolvedPrimaryColor = (isTelegramEnvironment: boolean) => {
  if (!isTelegramEnvironment) {
    return undefined;
  }

  const buttonColor = safe<`#${string}` | undefined>(undefined, () => themeParamsButtonColor());

  return isHexColor(buttonColor) ? buttonColor : undefined;
};

const applyTelegramPrimaryVars = (isTelegramEnvironment: boolean) => {
  if (typeof document === "undefined") {
    return;
  }

  const rootStyle = document.documentElement.style;

  if (!isTelegramEnvironment) {
    rootStyle.removeProperty(tmaPrimaryCssVar);
    rootStyle.removeProperty(tmaPrimaryForegroundCssVar);
    return;
  }

  const buttonColor = safe<`#${string}` | undefined>(undefined, () => themeParamsButtonColor());
  const buttonTextColor = safe<`#${string}` | undefined>(undefined, () =>
    themeParamsButtonTextColor()
  );

  if (isHexColor(buttonColor)) {
    rootStyle.setProperty(tmaPrimaryCssVar, buttonColor);
  }

  if (isHexColor(buttonTextColor)) {
    rootStyle.setProperty(tmaPrimaryForegroundCssVar, buttonTextColor);
  }
};

const cancelScheduledBackButtonHide = () => {
  if (backButtonHideTimeout === undefined || typeof window === "undefined") {
    return;
  }

  window.clearTimeout(backButtonHideTimeout);
  backButtonHideTimeout = undefined;
};

const scheduleBackButtonHide = () => {
  if (!isTelegramEnvironment()) {
    return;
  }

  if (typeof window === "undefined") {
    callIfAvailable(hideBackButton);
    return;
  }

  cancelScheduledBackButtonHide();

  backButtonHideTimeout = window.setTimeout(() => {
    backButtonHideTimeout = undefined;

    if (backButtonVisibleCount === 0) {
      callIfAvailable(hideBackButton);
    }
  }, 48);
};

const cancelScheduledMainButtonHide = () => {
  if (mainButtonHideTimeout === undefined || typeof window === "undefined") {
    return;
  }

  window.clearTimeout(mainButtonHideTimeout);
  mainButtonHideTimeout = undefined;
};

const hideTmaMainButton = (text = hiddenMainButtonText) => {
  const safeText = text.trim() || hiddenMainButtonText;

  callIfAvailable(setMainButtonParams, {
    isEnabled: false,
    isLoaderVisible: false,
    isVisible: false,
    text: safeText
  });

  const mainButton = getTelegramWebApp()?.MainButton;

  safe(undefined, () => mainButton?.hideProgress?.());
  safe(undefined, () => mainButton?.disable?.());
  safe(undefined, () => mainButton?.setText?.(safeText));
  safe(undefined, () =>
    mainButton?.setParams?.({
      is_active: false,
      is_progress_visible: false,
      is_visible: false,
      text: safeText
    })
  );
  safe(undefined, () => mainButton?.hide?.());
};

const forceHideTmaMainButton = (text = hiddenMainButtonText) => {
  cancelScheduledMainButtonHide();
  mainButtonVisibleCount = 0;
  callIfAvailable(mountMainButton);
  hideTmaMainButton(text);
  callIfAvailable(unmountMainButton);
};

const scheduleMainButtonHide = (text = hiddenMainButtonText, delayMs = 120) => {
  if (!isTelegramEnvironment()) {
    return;
  }

  if (typeof window === "undefined") {
    hideTmaMainButton(text);
    return;
  }

  cancelScheduledMainButtonHide();

  if (delayMs <= 0) {
    if (mainButtonVisibleCount === 0) {
      hideTmaMainButton(text);
    }

    return;
  }

  mainButtonHideTimeout = window.setTimeout(() => {
    mainButtonHideTimeout = undefined;

    if (mainButtonVisibleCount === 0) {
      hideTmaMainButton(text);
    }
  }, 120);
};

const syncTmaSafeAreaFallback = () => {
  if (typeof document === "undefined") {
    return;
  }

  const topInset = safe(0, () => viewportContentSafeAreaInsetTop());
  const needsIosTopFallback = isTelegramIos() && topInset < 72;
  const root = document.documentElement;

  root.style.setProperty(tmaTopOverlayFallbackCssVar, needsIosTopFallback ? "88px" : "0px");

  const platform = getTelegramPlatform();

  if (platform) {
    root.dataset.tmaPlatform = platform;
  } else {
    delete root.dataset.tmaPlatform;
  }
};

const resolveTmaChromeColor = (
  token: TmaChromeColorToken,
  colorScheme: TmaColorScheme
): `#${string}` => {
  const fallback = colorScheme === "dark" ? "#050507" : "#f2f2f7";

  if (typeof document === "undefined") {
    return fallback;
  }

  const root = document.documentElement;
  const rawValue = getComputedStyle(root).getPropertyValue(token).trim();
  const directColor = cssColorToHex(rawValue);

  if (directColor) {
    return directColor;
  }

  const probe = document.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.position = "fixed";
  probe.style.pointerEvents = "none";
  probe.style.visibility = "hidden";
  probe.style.color = `var(${token})`;
  root.appendChild(probe);

  const resolvedColor = cssColorToHex(getComputedStyle(probe).color);
  probe.remove();

  return resolvedColor ?? fallback;
};

const syncTmaChromeColors = (colorScheme: TmaColorScheme) => {
  const backgroundColor = resolveTmaChromeColor(tmaBackgroundCssVar, colorScheme);
  const headerColor = resolveTmaChromeColor(tmaHeaderBackgroundCssVar, colorScheme);
  const bottomBarColor = resolveTmaChromeColor(tmaBottomBackgroundCssVar, colorScheme);

  callIfAvailable(setMiniAppBackgroundColor, backgroundColor);
  callIfAvailable(
    setMiniAppHeaderColor,
    safe(false, () => setMiniAppHeaderColor.supports.rgb()) ? headerColor : "bg_color"
  );
  callIfAvailable(setMiniAppBottomBarColor, bottomBarColor);
};

const requestTmaSafeAreaInsets = () => {
  const safeAreaPromise = callIfAvailable(requestSafeAreaInsets);
  const contentSafeAreaPromise = callIfAvailable(requestContentSafeAreaInsets);
  const promises = [safeAreaPromise, contentSafeAreaPromise].filter(Boolean);

  if (promises.length === 0) {
    return;
  }

  void Promise.allSettled(promises).then(() => {
    callIfAvailable(bindViewportCssVars);
    syncTmaSafeAreaFallback();
    refreshTmaTheme();
  });
};

const syncTmaViewport = () => {
  callIfAvailable(bindViewportCssVars);
  requestTmaSafeAreaInsets();
  callIfAvailable(expandViewport);
  refreshTmaTheme();
};

const disableTmaVerticalSwipes = () => {
  callIfAvailable(mountSwipeBehavior);
  callIfAvailable(disableVerticalSwipes);
};

const emitTmaImpact = (style: "light" | "medium" | "heavy" | "rigid" | "soft" = "light") =>
  callIfAvailable(hapticFeedbackImpactOccurred, style);

const emitTmaSelection = () => callIfAvailable(hapticFeedbackSelectionChanged);

const emitTmaNotification = (type: "error" | "success" | "warning") =>
  callIfAvailable(hapticFeedbackNotificationOccurred, type);

export const refreshTmaTheme = () => {
  if (typeof document === "undefined") {
    return {
      colorScheme: "light" as const,
      isTelegram: false,
      primaryColor: undefined
    };
  }

  const isTelegram = isTelegramEnvironment();
  const colorScheme = getResolvedColorScheme(isTelegram);
  const root = document.documentElement;

  root.classList.toggle("dark", colorScheme === "dark");
  root.classList.toggle("light", colorScheme === "light");
  root.dataset.theme = colorScheme;
  root.dataset.tma = isTelegram ? "true" : "false";
  applyTelegramPrimaryVars(isTelegram);
  syncTmaSafeAreaFallback();
  syncTmaChromeColors(colorScheme);

  return {
    colorScheme,
    isTelegram,
    primaryColor: getResolvedPrimaryColor(isTelegram)
  };
};

export const syncTmaTheme = () => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const refresh = () => {
    refreshTmaTheme();
  };
  const cleanupFns: Array<() => void> = [];
  const mediaQuery = window.matchMedia?.(preferredDarkMediaQuery);
  const telegramWebApp = getTelegramWebApp();

  refresh();

  if (mediaQuery) {
    mediaQuery.addEventListener("change", refresh);
    cleanupFns.push(() => mediaQuery.removeEventListener("change", refresh));
  }

  if (isTelegramEnvironment() && telegramWebApp?.onEvent) {
    safe(undefined, () => telegramWebApp.onEvent?.("themeChanged", refresh));
    cleanupFns.push(() =>
      safe(undefined, () => telegramWebApp.offEvent?.("themeChanged", refresh))
    );
  }

  const signalCleanups = isTelegramEnvironment()
    ? safe<Array<() => void>>([], () => [
        isThemeParamsDark.sub(refresh),
        themeParamsButtonColor.sub(refresh),
        themeParamsButtonTextColor.sub(refresh)
      ])
    : [];

  cleanupFns.push(...signalCleanups);

  return () => {
    cleanupFns.forEach((cleanup) => cleanup());
  };
};

export const getTmaLaunchContext = (): TmaLaunchContext => {
  const launchParams = isTelegramEnvironment()
    ? safe<Record<string, unknown> | null>(null, () => retrieveLaunchParams() as never)
    : null;
  const theme = refreshTmaTheme();
  const startParam =
    typeof launchParams?.tgWebAppStartParam === "string"
      ? launchParams.tgWebAppStartParam
      : undefined;

  return {
    colorScheme: theme.colorScheme,
    initDataRaw: isTelegramEnvironment() ? safe("", () => retrieveRawInitData() ?? "") : "",
    isTelegram: theme.isTelegram,
    primaryColor: theme.primaryColor,
    platform:
      typeof launchParams?.tgWebAppPlatform === "string"
        ? launchParams.tgWebAppPlatform
        : undefined,
    startParam
  };
};

const getLanguageCodeFromRawInitData = (rawInitData: string) => {
  const userRaw = new URLSearchParams(rawInitData).get("user");

  if (!userRaw) {
    return undefined;
  }

  try {
    const user = JSON.parse(userRaw) as {
      language_code?: unknown;
    };

    return typeof user.language_code === "string" ? user.language_code : undefined;
  } catch {
    return undefined;
  }
};

export const getTmaUserLanguageCode = () => {
  if (typeof window === "undefined") {
    return undefined;
  }

  const unsafeLanguageCode = (
    window as Window & {
      Telegram?: {
        WebApp?: {
          initDataUnsafe?: {
            user?: {
              language_code?: unknown;
            };
          };
        };
      };
    }
  ).Telegram?.WebApp?.initDataUnsafe?.user?.language_code;

  if (typeof unsafeLanguageCode === "string") {
    return unsafeLanguageCode;
  }

  return isTelegramEnvironment()
    ? safe(undefined as string | undefined, () =>
        getLanguageCodeFromRawInitData(retrieveRawInitData() ?? "")
      )
    : undefined;
};

export const initTma = async () => {
  if (typeof window === "undefined" || didInit) {
    refreshTmaTheme();
    return getTmaLaunchContext();
  }

  didInit = true;

  if (!isTelegramEnvironment()) {
    refreshTmaTheme();
    return getTmaLaunchContext();
  }

  safe(undefined, () => init());
  callIfAvailable(mountMiniAppSync);
  callIfAvailable(mountThemeParamsSync);
  callIfAvailable(mountBackButton);
  callIfAvailable(mountMainButton);
  forceHideTmaMainButton();
  disableTmaVerticalSwipes();
  callIfAvailable(bindMiniAppCssVars);
  callIfAvailable(bindThemeParamsCssVars);
  callIfAvailable(enableClosingConfirmation);
  callIfAvailable(miniAppReady);

  const viewportMountPromise = callIfAvailable(mountViewport);

  if (viewportMountPromise) {
    void Promise.resolve(viewportMountPromise).then(syncTmaViewport).catch(syncTmaViewport);
  } else {
    syncTmaViewport();
  }

  refreshTmaTheme();

  return getTmaLaunchContext();
};

export const configureTmaBackButton = (visible: boolean, onClick: () => void) => {
  if (!visible || !isTelegramEnvironment()) {
    scheduleBackButtonHide();
    return () => undefined;
  }

  backButtonVisibleCount += 1;
  cancelScheduledBackButtonHide();
  callIfAvailable(mountBackButton);
  callIfAvailable(showBackButton);
  const off = callIfAvailable(onBackButtonClick, () => {
    emitTmaImpact("light");
    onClick();
  }) as (() => void) | undefined;

  return () => {
    off?.();
    backButtonVisibleCount = Math.max(0, backButtonVisibleCount - 1);
    scheduleBackButtonHide();
  };
};

export const configureTmaMainButton = (state: TmaButtonState | null, onClick: () => void) => {
  const isVisible = Boolean(state?.text.trim() && (state.visible ?? true));

  if (!state) {
    forceHideTmaMainButton();
    return () => undefined;
  }

  if (!isVisible) {
    forceHideTmaMainButton();
    return () => undefined;
  }

  if (!isTelegramEnvironment()) {
    return () => undefined;
  }

  mainButtonVisibleCount += 1;
  cancelScheduledMainButtonHide();
  callIfAvailable(mountMainButton);
  callIfAvailable(setMainButtonParams, {
    backgroundColor: state.color,
    hasShineEffect: state.shine,
    isEnabled: state.enabled ?? true,
    isLoaderVisible: state.loading ?? false,
    isVisible: true,
    text: state.text,
    textColor: state.textColor
  });

  const mainButton = getTelegramWebApp()?.MainButton;

  safe(undefined, () =>
    mainButton?.setParams?.({
      color: state.color,
      has_shine_effect: state.shine,
      is_active: state.enabled ?? true,
      is_progress_visible: state.loading ?? false,
      is_visible: true,
      text: state.text,
      text_color: state.textColor
    })
  );
  safe(undefined, () => mainButton?.setText?.(state.text));
  safe(undefined, () =>
    (state.enabled ?? true) ? mainButton?.enable?.() : mainButton?.disable?.()
  );
  safe(undefined, () =>
    state.loading ? mainButton?.showProgress?.(false) : mainButton?.hideProgress?.()
  );
  safe(undefined, () => mainButton?.show?.());

  const cleanup = callIfAvailable(onMainButtonClick, () => {
    emitTmaImpact("light");
    onClick();
  }) as (() => void) | undefined;

  return () => {
    cleanup?.();
    mainButtonVisibleCount = Math.max(0, mainButtonVisibleCount - 1);
    scheduleMainButtonHide(state.text);
  };
};

export const hideTmaMainButtonNow = () => {
  forceHideTmaMainButton();
};

const getPopupButtonId = (button: TmaPopupButton) => ("id" in button ? button.id : undefined);

const isPopupCancelButton = (button: TmaPopupButton) =>
  ("type" in button && (button.type === "cancel" || button.type === "close")) ||
  getPopupButtonId(button) === "cancel";

const getFallbackPopupConfirmButtonId = (buttons: TmaPopupButton[] = []) => {
  const destructiveButton = buttons.find(
    (button) => "type" in button && button.type === "destructive"
  );
  const defaultButton = buttons.find((button) => !isPopupCancelButton(button));
  const button = destructiveButton ?? defaultButton;

  return button ? (getPopupButtonId(button) ?? "") : "";
};

export const showTmaPopup = async (options: TmaPopupOptions) => {
  if (!isTelegramEnvironment()) {
    if (typeof window === "undefined") {
      return null;
    }

    const confirmed = window.confirm([options.title, options.message].filter(Boolean).join("\n\n"));

    return confirmed ? getFallbackPopupConfirmButtonId(options.buttons) : null;
  }

  const result = callIfAvailable(showPopup, options);

  if (!result) {
    return null;
  }

  return Promise.resolve(result as string | null);
};

export const openTmaTelegramLink = (url: string | URL) => {
  const href = url.toString();

  if (!isTelegramEnvironment()) {
    if (typeof window !== "undefined") {
      window.location.href = href;
    }

    return;
  }

  try {
    if (typeof openTelegramLink.ifAvailable === "function") {
      const result = openTelegramLink.ifAvailable(url);

      if (result[0]) {
        return;
      }
    } else {
      openTelegramLink(url);
      return;
    }
  } catch {
    // Fall through to browser navigation below.
  }

  if (typeof window !== "undefined") {
    window.location.href = href;
  }
};

export const tmaHaptics = {
  impact: emitTmaImpact,
  notification: emitTmaNotification,
  selection: emitTmaSelection
};
