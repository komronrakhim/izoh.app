import * as React from "react";
import {
  configureTmaBackButton,
  configureTmaMainButton,
  configureTmaSecondaryButton,
  initTma,
  syncTmaTheme,
  tmaHaptics
} from "./sdk";
import type { TmaButtonState, TmaLaunchContext, TmaSecondaryButtonState } from "./types";

const keyboardHeightCssVar = "--iz-keyboard-height";
const keyboardScrollSpaceCssVar = "--iz-keyboard-scroll-space";
const visualViewportHeightCssVar = "--iz-visual-viewport-height";
const editableSelector = [
  "textarea",
  "select",
  "[contenteditable='true']",
  "input:not([type='button']):not([type='checkbox']):not([type='color']):not([type='file']):not([type='hidden']):not([type='image']):not([type='radio']):not([type='range']):not([type='reset']):not([type='submit'])"
].join(",");

type TmaContextValue = TmaLaunchContext & {
  haptics: typeof tmaHaptics;
  isReady: boolean;
};

const TmaContext = React.createContext<TmaContextValue>({
  haptics: tmaHaptics,
  initDataRaw: "",
  isReady: false,
  isTelegram: false
});
const useBrowserLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

const getEditableElement = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  return target.closest<HTMLElement>(editableSelector);
};

const getActiveEditableElement = () => getEditableElement(document.activeElement);

const syncKeyboardViewportVars = () => {
  const viewport = window.visualViewport;
  const viewportHeight = Math.round(viewport?.height ?? window.innerHeight);
  const keyboardHeight = Math.max(
    0,
    Math.round(window.innerHeight - viewportHeight - (viewport?.offsetTop ?? 0))
  );
  const resolvedKeyboardHeight = keyboardHeight > 80 ? keyboardHeight : 0;
  const keyboardScrollSpace =
    resolvedKeyboardHeight > 0
      ? resolvedKeyboardHeight + Math.min(260, Math.round(window.innerHeight * 0.28))
      : 0;
  const root = document.documentElement;

  root.style.setProperty(visualViewportHeightCssVar, `${viewportHeight}px`);
  root.style.setProperty(keyboardHeightCssVar, `${resolvedKeyboardHeight}px`);
  root.style.setProperty(keyboardScrollSpaceCssVar, `${keyboardScrollSpace}px`);
  root.dataset.keyboard = resolvedKeyboardHeight > 0 ? "open" : "closed";
};

const ensureFocusedControlVisible = (behavior: ScrollBehavior) => {
  const control = getActiveEditableElement();

  if (!control) {
    return;
  }

  const scrollElement = document.scrollingElement ?? document.documentElement;
  const viewport = window.visualViewport;
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const resolvedBehavior = prefersReducedMotion ? "auto" : behavior;
  const visibleTop = (viewport?.offsetTop ?? 0) + 20;
  const visibleBottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 28;
  const target = control.closest<HTMLElement>(".iz-ios-field") ?? control;
  const rect = target.getBoundingClientRect();
  const topOverflow = rect.top - visibleTop;
  const bottomOverflow = rect.bottom - visibleBottom;
  const delta = bottomOverflow > 0 ? bottomOverflow : topOverflow < 0 ? topOverflow : 0;

  if (Math.abs(delta) < 2) {
    return;
  }

  const maxTop = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
  const nextTop = Math.max(0, Math.min(maxTop, scrollElement.scrollTop + delta));

  scrollElement.scrollTo({
    behavior: resolvedBehavior,
    top: nextTop
  });
};

const useTmaKeyboardViewport = () => {
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    let rafId: number | undefined;
    const timeoutIds = new Set<number>();

    const runInFrame = (fn: () => void) => {
      if (rafId !== undefined) {
        window.cancelAnimationFrame(rafId);
      }

      rafId = window.requestAnimationFrame(() => {
        rafId = undefined;
        fn();
      });
    };

    const queueFocusScroll = (behavior: ScrollBehavior, delay = 0) => {
      if (delay === 0) {
        runInFrame(() => ensureFocusedControlVisible(behavior));
        return;
      }

      const timeoutId = window.setTimeout(() => {
        timeoutIds.delete(timeoutId);
        runInFrame(() => ensureFocusedControlVisible(behavior));
      }, delay);

      timeoutIds.add(timeoutId);
    };

    const handleViewportChange = () => {
      syncKeyboardViewportVars();

      if (getActiveEditableElement()) {
        queueFocusScroll("auto");
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (!getEditableElement(event.target)) {
        return;
      }

      syncKeyboardViewportVars();
      queueFocusScroll("auto", 60);
      queueFocusScroll("smooth", 220);
      queueFocusScroll("smooth", 420);
    };

    const handleFocusOut = () => {
      const timeoutId = window.setTimeout(() => {
        timeoutIds.delete(timeoutId);
        syncKeyboardViewportVars();
      }, 120);

      timeoutIds.add(timeoutId);
    };

    syncKeyboardViewportVars();
    window.addEventListener("resize", handleViewportChange);
    window.visualViewport?.addEventListener("resize", handleViewportChange);
    window.visualViewport?.addEventListener("scroll", handleViewportChange);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    return () => {
      if (rafId !== undefined) {
        window.cancelAnimationFrame(rafId);
      }

      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
      window.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("scroll", handleViewportChange);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, []);
};

export const TmaProvider = ({ children }: { children: React.ReactNode }) => {
  const [context, setContext] = React.useState<TmaLaunchContext>({
    initDataRaw: "",
    isTelegram: false
  });
  const [isReady, setIsReady] = React.useState(false);

  useTmaKeyboardViewport();

  React.useEffect(() => {
    const stopThemeSync = syncTmaTheme();

    void initTma()
      .then(setContext)
      .finally(() => setIsReady(true));

    return stopThemeSync;
  }, []);

  const value = React.useMemo<TmaContextValue>(
    () => ({
      ...context,
      haptics: tmaHaptics,
      isReady
    }),
    [context, isReady]
  );

  return <TmaContext.Provider value={value}>{children}</TmaContext.Provider>;
};

export const useTma = () => React.useContext(TmaContext);

export const useTmaBackButton = (visible: boolean, onClick: () => void) => {
  React.useEffect(() => configureTmaBackButton(visible, onClick), [onClick, visible]);
};

export const useTmaMainButton = (state: TmaButtonState | null, onClick: () => void) => {
  const onClickRef = React.useRef(onClick);
  const stateKey = JSON.stringify([
    state?.color ?? null,
    state?.enabled ?? null,
    state?.loading ?? null,
    state?.shine ?? null,
    state?.text ?? null,
    state?.textColor ?? null,
    state?.visible ?? null
  ]);

  React.useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  useBrowserLayoutEffect(() => {
    return configureTmaMainButton(state, () => onClickRef.current());
  }, [stateKey]);
};

export const useTmaSecondaryButton = (
  state: TmaSecondaryButtonState | null,
  onClick: () => void
) => {
  const onClickRef = React.useRef(onClick);
  const stateKey = JSON.stringify([
    state?.color ?? null,
    state?.enabled ?? null,
    state?.loading ?? null,
    state?.position ?? null,
    state?.shine ?? null,
    state?.text ?? null,
    state?.textColor ?? null,
    state?.visible ?? null
  ]);

  React.useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  useBrowserLayoutEffect(() => {
    return configureTmaSecondaryButton(state, () => onClickRef.current());
  }, [stateKey]);
};
