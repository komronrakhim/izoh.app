import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  GraduationCap,
  Hotel,
  ImagePlus,
  Languages,
  MapPin,
  MessageSquare,
  Minus,
  Plus,
  QrCode,
  Scissors,
  ShoppingBag,
  Star,
  Stethoscope,
  type LucideIcon,
  UsersRound,
  Utensils,
  Wrench
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "motion/react";

import { IZOH_TELEGRAM_URL, IZOH_WORDMARK_PATHS, IZOH_WORDMARK_VIEW_BOX } from "~/shared/brand";
import { APP_INTL_LOCALE_BY_LOCALE, APP_LOCALES } from "~/shared/i18n/config";
import { useI18n } from "~/shared/i18n/react";

const emojiBasePath = "/emoji/fluent-3d";
const complaintAlertMockupPath = "/landing/mockups/complaint-alert.png";
const guestFeedbackMockupPath = "/landing/mockups/guest-feedback.png";
const heroMockupPath = "/landing/mockups/hero.png";
const publicReviewMockupPath = "/landing/mockups/public-review.png";
const suggestionIdeaMockupPath = "/landing/mockups/suggestion-idea.png";
const telegramIconPath = "/landing/icons/telegram.svg";
const landingCanonicalUrl = "https://izoh.app/";
const landingOgImageUrl = "https://izoh.app/meta/og/izoh-og.png";

const navItems = [
  { href: "#how-it-works", labelKey: "landing.nav.howItWorks" },
  { href: "#features", labelKey: "landing.nav.features" },
  { href: "#for-whom", labelKey: "landing.nav.forWhom" },
  { href: "#faq", labelKey: "landing.nav.faq" }
] as const;

const floatingEmoji = [
  {
    className: "left-[5%] top-[38%] hidden w-[112px] md:block xl:w-[128px]",
    delay: "-1.2s",
    drift: "-16px",
    duration: "7.5s",
    rotate: "-12deg",
    src: `${emojiBasePath}/star_struck.png`
  },
  {
    className: "right-[6%] top-[39%] hidden w-[110px] md:block xl:w-[126px]",
    delay: "-2s",
    drift: "-14px",
    duration: "8.2s",
    rotate: "12deg",
    src: `${emojiBasePath}/smiling_face_with_hearts.png`
  },
  {
    className: "left-[17%] top-[55%] hidden w-[68px] lg:block xl:w-[84px]",
    delay: "-3.2s",
    drift: "-12px",
    duration: "7.8s",
    rotate: "13deg",
    src: `${emojiBasePath}/thumbs_up.png`
  },
  {
    className: "right-[17%] top-[57%] hidden w-[66px] lg:block xl:w-[82px]",
    delay: "-0.6s",
    drift: "-13px",
    duration: "8.6s",
    rotate: "-12deg",
    src: `${emojiBasePath}/red_exclamation_mark.png`
  },
  {
    className: "left-[7%] top-[70%] hidden w-[76px] lg:block xl:w-[96px]",
    delay: "-4.4s",
    drift: "-15px",
    duration: "8.8s",
    rotate: "6deg",
    src: `${emojiBasePath}/beaming_face_with_smiling_eyes.png`
  },
  {
    className: "right-[8%] top-[70%] hidden w-[78px] lg:block xl:w-[98px]",
    delay: "-2.7s",
    drift: "-16px",
    duration: "7.9s",
    rotate: "-6deg",
    src: `${emojiBasePath}/heart_hands.png`
  },
  {
    className: "left-[25%] top-[45%] hidden w-[42px] lg:block xl:w-[54px]",
    delay: "-5.1s",
    drift: "-10px",
    duration: "6.9s",
    rotate: "12deg",
    src: `${emojiBasePath}/speech_balloon.png`
  },
  {
    className: "right-[25%] top-[47%] hidden w-[42px] lg:block xl:w-[54px]",
    delay: "-1.8s",
    drift: "-10px",
    duration: "7.2s",
    rotate: "-12deg",
    src: `${emojiBasePath}/sparkling_heart.png`
  },
  {
    className: "left-[28%] top-[79%] hidden w-[38px] lg:block xl:w-[50px]",
    delay: "-3.8s",
    drift: "-9px",
    duration: "7.4s",
    rotate: "-6deg",
    src: `${emojiBasePath}/glowing_star.png`
  },
  {
    className: "right-[29%] top-[79%] hidden w-[38px] lg:block xl:w-[50px]",
    delay: "-4.8s",
    drift: "-9px",
    duration: "7.1s",
    rotate: "6deg",
    src: `${emojiBasePath}/two_hearts.png`
  },
  {
    className: "left-[13%] top-[84%] hidden w-[48px] xl:block",
    delay: "-2.2s",
    drift: "-12px",
    duration: "8.4s",
    rotate: "12deg",
    src: `${emojiBasePath}/relieved_face.png`
  },
  {
    className: "right-[13%] top-[84%] hidden w-[48px] xl:block",
    delay: "-3.4s",
    drift: "-12px",
    duration: "8s",
    rotate: "-12deg",
    src: `${emojiBasePath}/smiling_face_with_smiling_eyes.png`
  }
] as const;

const valueLines = [
  {
    color: "text-[#6817FF]",
    icon: QrCode,
    textKey: "landing.valueLines.scan"
  },
  {
    color: "text-[#ff3b30]",
    icon: Bell,
    textKey: "landing.valueLines.lowRating"
  },
  {
    color: "text-[#0094fe]",
    icon: MessageSquare,
    textKey: "landing.valueLines.context"
  },
  {
    color: "text-[#6817FF]",
    icon: CheckCircle2,
    textKey: "landing.valueLines.resolve"
  },
  {
    color: "text-[#34c759]",
    icon: Star,
    textKey: "landing.valueLines.publicReview"
  }
] as const;

type ValueLineItem = {
  accent: string;
  after: string;
  before: string;
  color: string;
  icon: LucideIcon;
};

const featureBlocks = [
  {
    icon: MessageSquare,
    layout: "wide",
    textKey: "landing.features.cards.guest",
    visual: "guest"
  },
  {
    icon: Bell,
    layout: "compact",
    textKey: "landing.features.cards.alert",
    visual: "alert"
  },
  {
    icon: CheckCircle2,
    layout: "compact",
    textKey: "landing.features.cards.idea",
    visual: "idea"
  },
  {
    icon: Star,
    layout: "wide",
    textKey: "landing.features.cards.public",
    visual: "public"
  }
] as const;

type FeatureVisualKind = (typeof featureBlocks)[number]["visual"];
type FeatureBlockItem = (typeof featureBlocks)[number] & {
  body: string;
  title: string;
  visualAlt: string;
};

const featureToneByVisual: Record<
  FeatureVisualKind,
  { card: string; edgeTint: string; icon: string; visualSurface: string }
> = {
  alert: {
    card: "bg-[#fff0f3]",
    edgeTint: "bg-[#fff0f3]/60",
    icon: "bg-white text-[#ff2d55]",
    visualSurface: ""
  },
  guest: {
    card: "bg-[#eef6ff]",
    edgeTint: "bg-white/70",
    icon: "bg-white text-[#6817FF]",
    visualSurface: "bg-white/60"
  },
  idea: {
    card: "bg-[#eefbf4]",
    edgeTint: "bg-[#eefbf4]/60",
    icon: "bg-white text-[#18a957]",
    visualSurface: ""
  },
  public: {
    card: "bg-[#f4f0ff]",
    edgeTint: "bg-white/70",
    icon: "bg-white text-[#6817FF]",
    visualSurface: "bg-white/60"
  }
};

const placeTypes = [
  {
    icon: Utensils,
    labelKey: "landing.forWhom.places.cafe",
    tone: "bg-[#fff6e8] text-[#c56a00]"
  },
  {
    icon: Scissors,
    labelKey: "landing.forWhom.places.studios",
    tone: "bg-[#fff0f7] text-[#c13b7a]"
  },
  {
    icon: Stethoscope,
    labelKey: "landing.forWhom.places.clinics",
    tone: "bg-[#eefbf7] text-[#118660]"
  },
  {
    icon: ShoppingBag,
    labelKey: "landing.forWhom.places.shops",
    tone: "bg-[#eef4ff] text-[#2563eb]"
  },
  {
    icon: Hotel,
    labelKey: "landing.forWhom.places.hotels",
    tone: "bg-[#f2edff] text-[#6817FF]"
  },
  {
    icon: Wrench,
    labelKey: "landing.forWhom.places.services",
    tone: "bg-[#f4f5f7] text-[#596273]"
  },
  {
    icon: Building2,
    labelKey: "landing.forWhom.places.coworking",
    tone: "bg-[#ecfbff] text-[#0786a0]"
  },
  {
    icon: GraduationCap,
    labelKey: "landing.forWhom.places.education",
    tone: "bg-[#f0f8ed] text-[#4d8424]"
  }
] as const;

const teamFeatures = [
  {
    icon: UsersRound,
    surface: "bg-[#f4f0ff]",
    textKey: "landing.context.cards.staff",
    tone: "bg-[#6817FF] text-white"
  },
  {
    icon: BarChart3,
    surface: "bg-[#eef6ff]",
    textKey: "landing.context.cards.analytics",
    tone: "bg-[#0094fe] text-white"
  },
  {
    icon: ImagePlus,
    surface: "bg-[#eefbf4]",
    textKey: "landing.context.cards.photos",
    tone: "bg-[#34c759] text-white"
  }
] as const;

const ratingFlowLines = [
  {
    color: "text-[#6817FF]",
    icon: Bell,
    textKey: "landing.ratingFlow.lines.teamFirst"
  },
  {
    color: "text-[#ff3b30]",
    icon: MapPin,
    textKey: "landing.ratingFlow.lines.details"
  },
  {
    color: "text-[#0094fe]",
    icon: MessageSquare,
    textKey: "landing.ratingFlow.lines.resolve"
  },
  {
    color: "text-[#34c759]",
    icon: Star,
    textKey: "landing.ratingFlow.lines.publicReview"
  }
] as const;

const faqItems = [
  "install",
  "lowRating",
  "teamSees",
  "publicReviews",
  "notOnlyRestaurants"
] as const;

const faqSpringTransition = {
  damping: 34,
  mass: 0.72,
  stiffness: 430,
  type: "spring"
} as const;

const faqIconTransition = {
  damping: 28,
  mass: 0.45,
  stiffness: 680,
  type: "spring"
} as const;

const languageMenuTransition = {
  damping: 32,
  mass: 0.56,
  stiffness: 520,
  type: "spring"
} as const;

type FaqItem = {
  answer: string;
  question: string;
};

type HeroScrollProgress = ReturnType<typeof useScroll>["scrollYProgress"];

const setMetaContent = (
  attributeName: "name" | "property",
  attributeValue: string,
  content: string
) => {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attributeName}="${attributeValue}"]`
  );

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attributeName, attributeValue);
    document.head.appendChild(element);
  }

  element.content = content;
};

const setCanonicalHref = (href: string) => {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.appendChild(element);
  }

  element.href = href;
};

const heroCopyContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.08,
      staggerChildren: 0.085
    }
  }
} as const;

const heroCopyItemVariants = {
  hidden: {
    opacity: 0,
    scale: 0.985,
    y: 18
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      damping: 30,
      mass: 0.62,
      stiffness: 430,
      type: "spring"
    },
    y: 0
  }
} as const;

const heroMockupEnterTransition = {
  damping: 32,
  delay: 0.24,
  mass: 0.78,
  stiffness: 360,
  type: "spring"
} as const;

const heroEmojiEnterTransition = {
  damping: 22,
  mass: 0.58,
  stiffness: 300,
  type: "spring"
} as const;

const LandingWordmark = ({
  className = "w-[82px]",
  label
}: {
  className?: string;
  label: string;
}) => (
  <svg
    aria-label={label}
    className={`h-auto ${className}`}
    fill="none"
    role="img"
    viewBox={IZOH_WORDMARK_VIEW_BOX}
    xmlns="http://www.w3.org/2000/svg"
  >
    {IZOH_WORDMARK_PATHS.map((path) => (
      <path key={path} d={path} fill="currentColor" />
    ))}
  </svg>
);

const TelegramIcon = ({ className = "size-[22px]" }: { className?: string }) => (
  <span
    aria-hidden="true"
    className={`inline-block shrink-0 bg-current ${className}`}
    style={
      {
        WebkitMask: `url(${telegramIconPath}) center / contain no-repeat`,
        mask: `url(${telegramIconPath}) center / contain no-repeat`
      } as CSSProperties
    }
  />
);

const LandingLanguageSwitcher = () => {
  const { locale, setLocale, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [popoverOffset, setPopoverOffset] = useState(0);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setPopoverOffset(0);
      return;
    }

    const updatePopoverOffset = () => {
      const triggerElement = rootRef.current?.querySelector("button");
      const menuElement = menuRef.current;

      if (!triggerElement || !menuElement) {
        return;
      }

      const triggerRect = triggerElement.getBoundingClientRect();
      const menuRect = menuElement.getBoundingClientRect();
      const viewportInset = 20;
      const desiredLeft = triggerRect.left + triggerRect.width / 2 - menuRect.width / 2;
      const maxLeft = Math.max(viewportInset, window.innerWidth - menuRect.width - viewportInset);
      const clampedLeft = Math.min(Math.max(desiredLeft, viewportInset), maxLeft);

      setPopoverOffset(Math.round(clampedLeft - desiredLeft));
    };

    updatePopoverOffset();
    window.addEventListener("resize", updatePopoverOffset);

    return () => {
      window.removeEventListener("resize", updatePopoverOffset);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={t("landing.language.action")}
        className="grid size-10 place-items-center rounded-full bg-[#f5f1ff] text-[#6817FF] transition hover:bg-[#eee6ff]"
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        <Languages aria-hidden="true" className="size-[18px]" strokeWidth={2.2} />
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="absolute left-1/2 top-[calc(100%+10px)] z-50 w-[224px] max-w-[calc(100vw-40px)] -translate-x-1/2 overflow-hidden rounded-[24px] bg-white p-2 ring-1 ring-black/[0.08]"
            exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98, y: -6 }}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.98, y: -8 }}
            ref={menuRef}
            role="menu"
            style={{ marginLeft: popoverOffset }}
            transition={languageMenuTransition}
          >
            <div className="grid gap-0.5">
              {APP_LOCALES.map((item) => {
                const isActive = item === locale;

                return (
                  <button
                    aria-checked={isActive}
                    className={[
                      "flex min-h-[40px] w-full items-center justify-center rounded-[17px] px-3 py-2.5 text-center transition",
                      isActive ? "bg-[#f5f1ff] text-[#6817FF]" : "text-[#24202d] hover:bg-[#f7f7f8]"
                    ].join(" ")}
                    key={item}
                    onClick={() => {
                      if (!isActive) {
                        setLocale(item);
                      }

                      setIsOpen(false);
                    }}
                    role="menuitemradio"
                    type="button"
                  >
                    <span className="min-w-0 truncate text-[14px] font-semibold leading-[1.15]">
                      {t(`common.locales.${item}.label`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

const EmojiFloat = ({
  className,
  delay,
  drift,
  duration,
  index,
  rotate,
  scrollProgress,
  src
}: (typeof floatingEmoji)[number] & { index: number; scrollProgress: HeroScrollProgress }) => {
  const reduceMotion = useReducedMotion();
  const isLeftSide = className.includes("left-");
  const parallaxY = useTransform(scrollProgress, [0, 1], [0, index % 2 === 0 ? -76 : -54]);
  const parallaxX = useTransform(scrollProgress, [0, 1], [0, isLeftSide ? -20 : 20]);
  const parallaxOpacity = useTransform(scrollProgress, [0, 0.72], [1, 0.34]);
  const parallaxScale = useTransform(scrollProgress, [0, 1], [1, index < 2 ? 1.04 : 0.92]);

  return (
    <motion.div
      aria-hidden="true"
      className={`pointer-events-none absolute select-none will-change-transform ${className}`}
      style={
        reduceMotion
          ? undefined
          : { opacity: parallaxOpacity, scale: parallaxScale, x: parallaxX, y: parallaxY }
      }
    >
      <motion.div
        animate={reduceMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.72, y: 26 }}
        transition={{
          ...heroEmojiEnterTransition,
          delay: 0.22 + index * 0.045
        }}
      >
        <img
          alt=""
          className="landing-emoji-float h-auto w-full select-none"
          draggable={false}
          src={src}
          style={
            {
              "--landing-emoji-delay": delay,
              "--landing-emoji-drift": drift,
              "--landing-emoji-duration": duration,
              "--landing-emoji-rotate": rotate
            } as CSSProperties
          }
        />
      </motion.div>
    </motion.div>
  );
};

const PhoneMockup = ({
  alt,
  scrollProgress
}: {
  alt: string;
  scrollProgress: HeroScrollProgress;
}) => {
  const reduceMotion = useReducedMotion();
  const scrollY = useTransform(scrollProgress, [0, 1], [0, 108]);
  const scrollScale = useTransform(scrollProgress, [0, 1], [1, 0.965]);

  return (
    <motion.div
      className="relative mx-auto mt-[58px] w-[320px] max-w-[84vw] transform-gpu sm:mt-[64px] sm:w-[391px] lg:w-[420px]"
      style={reduceMotion ? undefined : { scale: scrollScale, y: scrollY }}
    >
      <motion.div
        animate={reduceMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.965, y: 64 }}
        transition={heroMockupEnterTransition}
      >
        <img
          alt={alt}
          className="h-auto w-full select-none"
          draggable={false}
          height={2748}
          src={heroMockupPath}
          width={1319}
        />
      </motion.div>
    </motion.div>
  );
};

const ValueLine = ({ accent, after, before, color, icon: Icon }: ValueLineItem) => (
  <h2 className="mx-auto max-w-[1030px] text-center text-[30px] font-medium leading-[1.26] tracking-normal text-[#17111f] sm:text-[40px] sm:leading-[1.35]">
    {before}{" "}
    <span className={color}>
      <Icon
        aria-hidden="true"
        className="mr-2 hidden size-[0.9em] align-[-0.12em] sm:inline-block"
        strokeWidth={2.4}
      />
      {accent}
    </span>{" "}
    {after ? after : null}
  </h2>
);

const FeatureHeader = ({
  body,
  icon: Icon,
  isWide,
  title,
  visual
}: FeatureBlockItem & { isWide: boolean }) => {
  const tone = featureToneByVisual[visual];

  return (
    <div className="relative z-10">
      <div
        className={`mb-7 grid size-[60px] place-items-center rounded-full sm:size-[68px] ${tone.icon}`}
      >
        <Icon aria-hidden="true" className="size-7 sm:size-8" strokeWidth={2.2} />
      </div>
      <h3
        className={[
          "font-medium leading-[1.18] tracking-normal text-[#17111f]",
          isWide
            ? "max-w-[470px] text-[30px] sm:text-[36px] sm:leading-[1.24]"
            : "max-w-[360px] text-[28px] sm:text-[32px] sm:leading-[1.2]"
        ].join(" ")}
      >
        {title}
      </h3>
      <p
        className={[
          "mt-4 text-[17px] leading-[1.45] text-[#4f5665] sm:text-[19px] sm:leading-[1.42]",
          isWide ? "max-w-[470px]" : "max-w-[340px]"
        ].join(" ")}
      >
        {body}
      </p>
    </div>
  );
};

const SoftEdgeBlur = ({
  direction,
  tintClass
}: {
  direction: "bottom" | "top";
  tintClass: string;
}) => {
  const fromBottom = direction === "bottom";
  const maskImage = fromBottom
    ? "linear-gradient(to top, black 0%, rgba(0,0,0,0.42) 52%, transparent 100%)"
    : "linear-gradient(to bottom, black 0%, rgba(0,0,0,0.42) 52%, transparent 100%)";

  return (
    <div
      aria-hidden="true"
      className={[
        "pointer-events-none absolute inset-x-0 z-10 h-[74px] overflow-hidden sm:h-[88px]",
        fromBottom ? "bottom-0" : "top-0"
      ].join(" ")}
      style={{ WebkitMaskImage: maskImage, maskImage }}
    >
      <div className={`absolute inset-0 ${tintClass}`} />
      <div className="absolute inset-0 backdrop-blur-[8px]" />
    </div>
  );
};

const FeatureVisual = ({ alt, visual }: { alt: string; visual: FeatureVisualKind }) => {
  if (visual === "guest") {
    return (
      <div className="w-full max-w-[292px] sm:max-w-[340px] md:max-w-[370px]">
        <img
          alt={alt}
          className="h-auto w-full select-none"
          draggable={false}
          height={1779}
          src={guestFeedbackMockupPath}
          width={1317}
        />
      </div>
    );
  }

  if (visual === "alert") {
    return (
      <div className="w-full max-w-[315px] sm:max-w-[370px]">
        <img
          alt={alt}
          className="h-auto w-full select-none"
          draggable={false}
          height={1779}
          src={complaintAlertMockupPath}
          width={1317}
        />
      </div>
    );
  }

  if (visual === "idea") {
    return (
      <div className="w-full max-w-[315px] sm:max-w-[370px]">
        <img
          alt={alt}
          className="h-auto w-full select-none"
          draggable={false}
          height={1779}
          src={suggestionIdeaMockupPath}
          width={1317}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[292px] sm:max-w-[340px] md:max-w-[370px]">
      <img
        alt={alt}
        className="h-auto w-full select-none"
        draggable={false}
        height={1779}
        src={publicReviewMockupPath}
        width={1317}
      />
    </div>
  );
};

const FeatureBlock = (item: FeatureBlockItem) => {
  const { layout, visual } = item;
  const isWide = layout === "wide";
  const isBottomEdgeMockup = visual === "alert" || visual === "idea";
  const isTopEdgeMockup = visual === "guest" || visual === "public";
  const tone = featureToneByVisual[visual];

  if (isBottomEdgeMockup) {
    return (
      <article
        className={[
          "relative flex min-h-[780px] flex-col overflow-hidden rounded-[32px] px-7 pt-7 sm:min-h-[860px] sm:px-8 sm:pt-8",
          tone.card
        ].join(" ")}
      >
        <FeatureHeader {...item} isWide={false} />

        <div className="mt-8 grid flex-1 items-end justify-items-center">
          <FeatureVisual alt={item.visualAlt} visual={visual} />
        </div>
        <SoftEdgeBlur direction="bottom" tintClass={tone.edgeTint} />
      </article>
    );
  }

  return (
    <article
      className={[
        "grid gap-8 rounded-[32px] p-7 sm:p-10",
        tone.card,
        isTopEdgeMockup ? "overflow-hidden md:min-h-[600px]" : "",
        isWide ? "md:grid-cols-[0.9fr_1.1fr] md:items-center lg:col-span-2" : "content-between"
      ].join(" ")}
    >
      <FeatureHeader {...item} isWide={isWide} />

      <div
        className={[
          isTopEdgeMockup
            ? `relative grid min-h-[430px] content-start justify-items-center self-start overflow-hidden rounded-[28px] ${tone.visualSurface} px-0 pb-4 pt-0 sm:min-h-[475px] sm:px-4 md:min-h-[500px]`
            : `grid place-items-center rounded-[28px] ${tone.visualSurface} p-4`,
          isTopEdgeMockup ? "" : isWide ? "min-h-[330px] md:min-h-[410px]" : "min-h-[260px]"
        ].join(" ")}
      >
        <div className={isTopEdgeMockup ? "-mt-2 sm:-mt-4 md:-mt-5" : ""}>
          <FeatureVisual alt={item.visualAlt} visual={visual} />
        </div>
        {isTopEdgeMockup ? <SoftEdgeBlur direction="top" tintClass={tone.edgeTint} /> : null}
      </div>
    </article>
  );
};

const FaqAccordionItem = ({
  index,
  isOpen,
  item,
  onToggle
}: {
  index: number;
  isOpen: boolean;
  item: FaqItem;
  onToggle: () => void;
}) => {
  const buttonId = `landing-faq-button-${index}`;
  const panelId = `landing-faq-panel-${index}`;

  return (
    <article className="overflow-hidden border-b border-[#e8eaf1] last:border-b-0">
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-5 px-1 py-5 text-left sm:px-0 sm:py-6"
        id={buttonId}
        type="button"
        onClick={onToggle}
      >
        <span className="text-[19px] font-medium leading-[1.25] tracking-normal text-[#17111f] sm:text-[22px]">
          {item.question}
        </span>
        <motion.span
          aria-hidden="true"
          className="relative grid size-8 shrink-0 place-items-center text-[#6817FF]"
        >
          <AnimatePresence initial={false}>
            {isOpen ? (
              <motion.span
                key="minus"
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                className="absolute inset-0 grid place-items-center"
                exit={{ opacity: 0, rotate: 90, scale: 0.82 }}
                initial={{ opacity: 0, rotate: -90, scale: 0.82 }}
                transition={faqIconTransition}
              >
                <Minus className="size-5" strokeWidth={2.5} />
              </motion.span>
            ) : (
              <motion.span
                key="plus"
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                className="absolute inset-0 grid place-items-center"
                exit={{ opacity: 0, rotate: 90, scale: 0.82 }}
                initial={{ opacity: 0, rotate: -90, scale: 0.82 }}
                transition={faqIconTransition}
              >
                <Plus className="size-5" strokeWidth={2.5} />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            aria-labelledby={buttonId}
            exit={{ height: 0, opacity: 0 }}
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            role="region"
            transition={faqSpringTransition}
          >
            <p className="px-1 pb-6 text-[16px] leading-[1.55] text-[#5d6472] sm:px-0 sm:pb-7 sm:pr-20 sm:text-[18px]">
              {item.answer}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </article>
  );
};

export const LandingPage = () => {
  const { locale, t } = useI18n();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const heroRef = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();
  const brandLabel = t("common.brand");
  const seoTitle = t("landing.seo.title");
  const seoDescription = t("landing.seo.description");
  const seoKeywords = t("landing.seo.keywords");
  const seoOgImageAlt = t("landing.seo.ogImageAlt");
  const { scrollYProgress: heroScrollProgress } = useScroll({
    offset: ["start start", "end start"],
    target: heroRef
  });
  const heroCopyY = useTransform(heroScrollProgress, [0, 1], [0, -58]);
  const heroCopyOpacity = useTransform(heroScrollProgress, [0, 0.56], [1, 0.38]);
  const getLineText = (key: string) => ({
    accent: t(`${key}.accent`),
    after: t(`${key}.after`),
    before: t(`${key}.before`)
  });

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      return;
    }

    const previousScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";

    return () => {
      document.documentElement.style.scrollBehavior = previousScrollBehavior;
    };
  }, []);

  useEffect(() => {
    document.title = seoTitle;
    setCanonicalHref(landingCanonicalUrl);
    setMetaContent("name", "description", seoDescription);
    setMetaContent("name", "keywords", seoKeywords);
    setMetaContent("name", "language", APP_INTL_LOCALE_BY_LOCALE[locale]);
    setMetaContent("name", "twitter:card", "summary_large_image");
    setMetaContent("name", "twitter:title", seoTitle);
    setMetaContent("name", "twitter:description", seoDescription);
    setMetaContent("name", "twitter:image", landingOgImageUrl);
    setMetaContent("name", "twitter:image:alt", seoOgImageAlt);
    setMetaContent("property", "og:type", "website");
    setMetaContent("property", "og:locale", APP_INTL_LOCALE_BY_LOCALE[locale].replace("-", "_"));
    setMetaContent("property", "og:site_name", brandLabel);
    setMetaContent("property", "og:url", landingCanonicalUrl);
    setMetaContent("property", "og:title", seoTitle);
    setMetaContent("property", "og:description", seoDescription);
    setMetaContent("property", "og:image", landingOgImageUrl);
    setMetaContent("property", "og:image:secure_url", landingOgImageUrl);
    setMetaContent("property", "og:image:width", "1200");
    setMetaContent("property", "og:image:height", "630");
    setMetaContent("property", "og:image:alt", seoOgImageAlt);
  }, [brandLabel, locale, seoDescription, seoKeywords, seoOgImageAlt, seoTitle]);

  return (
    <main className="min-h-screen overflow-hidden bg-white text-[#17111f] antialiased">
      <header className="fixed inset-x-0 top-0 z-50 bg-white">
        <div className="mx-auto flex h-[74px] w-full max-w-[1200px] items-center justify-between gap-5 px-5 sm:px-8 xl:px-0">
          <a aria-label={brandLabel} className="text-[#17111f]" href="/">
            <LandingWordmark className="w-[64px] sm:w-[70px]" label={brandLabel} />
          </a>

          <nav className="hidden items-center gap-10 text-[15px] font-semibold text-[#2d2d32] lg:flex">
            {navItems.map((item) => (
              <a className="transition hover:text-[#6817FF]" href={item.href} key={item.href}>
                {t(item.labelKey)}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <LandingLanguageSwitcher />
            <a
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#6817FF] py-2 pl-4 pr-5 text-[14px] font-semibold text-white transition hover:bg-[#5912df]"
              href={IZOH_TELEGRAM_URL}
            >
              <TelegramIcon />
              <span className="max-[374px]:hidden">{t("landing.cta.header")}</span>
            </a>
          </div>
        </div>
      </header>

      <section
        className="relative isolate min-h-[1080px] px-5 pb-0 pt-[96px] text-center sm:px-8 lg:min-h-[1210px] lg:pt-[150px]"
        ref={heroRef}
      >
        {floatingEmoji.map((emoji, index) => (
          <EmojiFloat
            {...emoji}
            index={index}
            key={emoji.src}
            scrollProgress={heroScrollProgress}
          />
        ))}

        <motion.div
          animate={reduceMotion ? undefined : "visible"}
          className="mx-auto max-w-[1030px] transform-gpu"
          initial={reduceMotion ? false : "hidden"}
          style={reduceMotion ? undefined : { opacity: heroCopyOpacity, y: heroCopyY }}
          variants={heroCopyContainerVariants}
        >
          <motion.p
            className="inline-flex rounded-full bg-[#eef4ff] px-4 py-2 text-[14px] font-semibold text-[#6817FF]"
            variants={heroCopyItemVariants}
          >
            {t("landing.hero.badge")}
          </motion.p>
          <motion.h1
            className="mx-auto mt-5 max-w-[760px] text-[40px] font-medium leading-[1.15] tracking-normal text-[#17111f] sm:text-[56px] sm:leading-[1.15]"
            variants={heroCopyItemVariants}
          >
            {t("landing.hero.title")}
          </motion.h1>
          <motion.p
            className="mx-auto mt-5 max-w-[690px] text-[18px] leading-[1.55] text-[#2f3138] sm:text-[21px]"
            variants={heroCopyItemVariants}
          >
            {t("landing.hero.subtitle")}
          </motion.p>
        </motion.div>

        <PhoneMockup alt={t("landing.hero.mockupAlt")} scrollProgress={heroScrollProgress} />
      </section>

      <section className="px-5 pb-24 pt-32 sm:px-8 sm:pb-32 sm:pt-40">
        <div
          className="mx-auto flex max-w-[1030px] scroll-mt-[96px] flex-col gap-12 sm:gap-14"
          id="how-it-works"
        >
          {valueLines.map((item) => (
            <ValueLine {...item} {...getLineText(item.textKey)} key={item.textKey} />
          ))}
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[1030px] scroll-mt-[96px]" id="features">
          <div className="mx-auto max-w-[760px] text-center">
            <h2 className="text-[34px] font-medium leading-[1.18] tracking-normal text-[#17111f] sm:text-[48px]">
              {t("landing.features.title")}
            </h2>
            <p className="mt-5 text-[18px] leading-[1.55] text-[#4f5665] sm:text-[22px]">
              {t("landing.features.subtitle")}
            </p>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            {featureBlocks.map((item) => (
              <FeatureBlock
                {...item}
                body={t(`${item.textKey}.body`)}
                key={item.visual}
                title={t(`${item.textKey}.title`)}
                visualAlt={t(`landing.features.visualAlt.${item.visual}`)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[1030px]">
          <div className="mx-auto max-w-[760px] text-center">
            <h2 className="text-[34px] font-medium leading-[1.18] tracking-normal text-[#17111f] sm:text-[48px]">
              {t("landing.context.title")}
            </h2>
            <p className="mt-5 text-[18px] leading-[1.55] text-[#4f5665] sm:text-[22px]">
              {t("landing.context.subtitle")}
            </p>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {teamFeatures.map(({ icon: Icon, surface, textKey, tone }) => (
              <article
                className={`rounded-[32px] p-7 sm:min-h-[300px] sm:p-8 ${surface}`}
                key={textKey}
              >
                <div className={`grid size-[64px] place-items-center rounded-full ${tone}`}>
                  <Icon aria-hidden="true" className="size-8" strokeWidth={2.2} />
                </div>
                <h3 className="mt-8 text-[28px] font-medium leading-[1.2] text-[#17111f]">
                  {t(`${textKey}.title`)}
                </h3>
                <p className="mt-4 text-[18px] leading-7 text-[#4f5665]">{t(`${textKey}.body`)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[1030px]">
          <div className="mx-auto max-w-[760px] text-center">
            <h2 className="text-[34px] font-medium leading-[1.18] tracking-normal text-[#17111f] sm:text-[48px]">
              {t("landing.ratingFlow.title")}
            </h2>
            <p className="mt-5 text-[18px] leading-[1.55] text-[#4f5665] sm:text-[22px]">
              {t("landing.ratingFlow.subtitle")}
            </p>
          </div>

          <div className="mx-auto mt-14 flex max-w-[1030px] flex-col gap-12 sm:gap-14">
            {ratingFlowLines.map((item) => (
              <ValueLine {...item} {...getLineText(item.textKey)} key={item.textKey} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-24">
        <div
          className="mx-auto grid max-w-[1030px] scroll-mt-[96px] gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center"
          id="for-whom"
        >
          <div>
            <h2 className="text-[34px] font-medium leading-[1.18] tracking-normal text-[#17111f] sm:text-[48px]">
              {t("landing.forWhom.title")}
            </h2>
            <p className="mt-5 text-[18px] leading-[1.55] text-[#4f5665] sm:text-[22px]">
              {t("landing.forWhom.subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {placeTypes.map(({ icon: Icon, labelKey, tone }) => (
              <div
                className={`grid min-h-[118px] place-items-center rounded-[26px] px-4 text-center text-[16px] font-semibold leading-6 ${tone}`}
                key={labelKey}
              >
                <div>
                  <Icon aria-hidden="true" className="mx-auto mb-3 size-7" strokeWidth={2.2} />
                  {t(labelKey)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-24">
        <div
          className="mx-auto grid max-w-[1030px] scroll-mt-[96px] gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center"
          id="faq"
        >
          <div>
            <h2 className="text-[34px] font-medium leading-[1.18] tracking-normal text-[#17111f] sm:text-[48px]">
              {t("landing.faq.title")}
            </h2>
            <p className="mt-5 text-[18px] leading-[1.55] text-[#4f5665] sm:text-[22px]">
              {t("landing.faq.subtitle")}
            </p>
          </div>

          <div className="rounded-[32px]">
            {faqItems.map((itemKey, index) => (
              <FaqAccordionItem
                index={index}
                isOpen={openFaqIndex === index}
                item={{
                  answer: t(`landing.faq.items.${itemKey}.answer`),
                  question: t(`landing.faq.items.${itemKey}.question`)
                }}
                key={itemKey}
                onToggle={() => {
                  setOpenFaqIndex((currentIndex) => (currentIndex === index ? null : index));
                }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-16 pt-10 sm:px-8 sm:pb-24">
        <div className="mx-auto max-w-[1030px] rounded-[32px] bg-[#6817FF] px-6 py-10 text-center text-white sm:px-10 sm:py-14">
          <LandingWordmark className="mx-auto w-[74px] text-white sm:w-[82px]" label={brandLabel} />
          <h2 className="mx-auto mt-7 max-w-[620px] text-[32px] font-medium leading-[1.16] tracking-normal sm:text-[48px]">
            {t("landing.footer.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-[560px] text-[17px] leading-[1.5] text-white/78 sm:text-[20px]">
            {t("landing.footer.subtitle")}
          </p>

          <a
            className="mt-8 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-white px-6 py-2 text-[15px] font-semibold text-[#6817FF] transition hover:bg-[#f7f3ff]"
            href={IZOH_TELEGRAM_URL}
          >
            <TelegramIcon className="size-[19px]" />
            {t("landing.cta.footer")}
          </a>
        </div>
      </section>
    </main>
  );
};
