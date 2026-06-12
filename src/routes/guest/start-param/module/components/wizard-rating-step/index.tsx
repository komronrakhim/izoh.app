import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import * as React from "react";

import { cn } from "~/common/utils";

import {
  getRatingSceneEmojis,
  ratingConfettiPositions,
  ratingOptions,
  ratingScenePositions
} from "../../constants";
import type { CustomerWizardTranslate } from "../../types";

type WizardRatingStepProps = {
  onRatingChange: (rating: number) => void;
  rating: number;
  selectedRatingEmoji: string;
  selectedRatingLabel: string;
  t: CustomerWizardTranslate;
  shouldAllowPersonOrTeamPraise: boolean;
};

export const WizardRatingStep = ({
  onRatingChange,
  rating,
  selectedRatingEmoji,
  selectedRatingLabel,
  shouldAllowPersonOrTeamPraise,
  t
}: WizardRatingStepProps) => {
  const shouldReduceMotion = useReducedMotion();
  const [confettiRunId, setConfettiRunId] = React.useState(0);
  const [pickerRun, setPickerRun] = React.useState({ id: 0, value: rating });
  const selectedRatingSceneEmojis = getRatingSceneEmojis(rating);
  const orbitEmojis = selectedRatingSceneEmojis.slice(0, ratingScenePositions.length);
  const ratingHint =
    rating === 5 && !shouldAllowPersonOrTeamPraise
      ? t("customer.wizard.rating.hints.5_noSpecificTargets")
      : t(`customer.wizard.rating.hints.${rating}`);

  const handleRatingClick = (value: number) => {
    onRatingChange(value);

    if (!shouldReduceMotion) {
      setConfettiRunId((current) => current + 1);
      setPickerRun((current) => ({
        id: current.id + 1,
        value
      }));
    }
  };

  return (
    <div className="grid gap-4">
      <div className="relative grid justify-items-center gap-1 overflow-hidden px-2 pt-2 text-center">
        <div
          className="relative h-[clamp(156px,30dvh,218px)] w-full max-w-[420px] overflow-hidden"
          aria-hidden="true"
        >
          <AnimatePresence mode="popLayout" initial>
            {orbitEmojis.map((emoji, index) => {
              const position = ratingScenePositions[index];

              return (
                <motion.span
                  key={`${rating}-${emoji}`}
                  className="absolute z-0 leading-none"
                  initial={{
                    opacity: 0,
                    scale: 0.72,
                    x: "-50%",
                    y: "-50%"
                  }}
                  animate={{
                    opacity: position.opacity,
                    scale: 1,
                    x: "-50%",
                    y: "-50%"
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.82,
                    x: "-50%",
                    y: "-50%"
                  }}
                  transition={{
                    delay: position.delay,
                    duration: shouldReduceMotion ? 0.12 : 0.3,
                    ease: [0.16, 1, 0.3, 1]
                  }}
                  style={{
                    fontSize: position.size,
                    left: `${position.x}%`,
                    top: `${position.y}%`
                  }}
                >
                  <motion.span
                    className="block"
                    animate={
                      shouldReduceMotion
                        ? {
                            rotate: position.rotate,
                            x: 0,
                            y: 0
                          }
                        : {
                            rotate: [
                              position.rotate,
                              position.rotate + (index % 2 === 0 ? 4 : -4),
                              position.rotate
                            ],
                            x: [0, position.floatX, 0],
                            y: [0, position.floatY, 0]
                          }
                    }
                    transition={{
                      delay: position.delay + 0.2,
                      duration: 2.6 + index * 0.08,
                      ease: "easeInOut",
                      repeat: shouldReduceMotion ? 0 : Infinity
                    }}
                  >
                    {emoji}
                  </motion.span>
                </motion.span>
              );
            })}
          </AnimatePresence>

          {confettiRunId > 0 && !shouldReduceMotion ? (
            <AnimatePresence initial={false}>
              {ratingConfettiPositions.map((position, index) => (
                <span
                  key={`confetti-anchor-${confettiRunId}-${index}`}
                  className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
                >
                  <motion.span
                    className="block leading-none"
                    initial={{
                      opacity: 0,
                      rotate: 0,
                      scale: 0.5,
                      x: 0,
                      y: 0
                    }}
                    animate={{
                      opacity: [0, 0.9, 0],
                      rotate: position.rotate,
                      scale: [0.58, 1, 0.82],
                      x: position.x,
                      y: position.y
                    }}
                    exit={{
                      opacity: 0
                    }}
                    transition={{
                      delay: position.delay,
                      duration: 0.64,
                      ease: [0.16, 1, 0.3, 1],
                      times: [0, 0.28, 1]
                    }}
                    style={{
                      fontSize: position.size
                    }}
                  >
                    {selectedRatingSceneEmojis[(index + 2) % selectedRatingSceneEmojis.length]}
                  </motion.span>
                </span>
              ))}
            </AnimatePresence>
          ) : null}

          <div className="absolute inset-0 z-20 grid place-items-center">
            <AnimatePresence mode="wait" initial>
              <motion.span
                key={`rating-scene-${rating}`}
                className="text-[86px] leading-none sm:text-[98px]"
                initial={{
                  opacity: shouldReduceMotion ? 1 : 0.88,
                  rotate: shouldReduceMotion ? 0 : -6,
                  scale: shouldReduceMotion ? 1 : 0.78,
                  y: shouldReduceMotion ? 0 : 12
                }}
                animate={{ opacity: 1, rotate: 0, scale: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  scale: 0.84,
                  y: -8
                }}
                transition={{
                  delay: shouldReduceMotion ? 0 : 0.01,
                  duration: shouldReduceMotion ? 0.16 : 0.24,
                  ease: shouldReduceMotion ? [0.22, 1, 0.36, 1] : [0.16, 1, 0.3, 1],
                  type: "tween"
                }}
              >
                {selectedRatingEmoji}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        <div className="relative z-10 grid max-w-[330px] justify-items-center gap-1.5">
          <motion.p
            key={`label-${rating}`}
            className="ios-title-3 font-semibold text-foreground"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {selectedRatingLabel}
          </motion.p>
          <motion.p
            key={`hint-${rating}`}
            className="ios-footnote text-muted"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04, duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {ratingHint}
          </motion.p>
        </div>
      </div>

      <LayoutGroup id="wizard-rating-picker">
        <div className="grid grid-cols-5 gap-1.5 rounded-[26px] bg-surface-2 p-1.5 ring-1 ring-foreground/[0.05]">
          {ratingOptions.map(({ emoji, value }) => {
            const isSelected = value === rating;
            const shouldPulse =
              isSelected && pickerRun.value === value && pickerRun.id > 0 && !shouldReduceMotion;

            return (
              <motion.button
                key={value}
                type="button"
                aria-label={t(`customer.wizard.rating.labels.${value}`)}
                aria-pressed={isSelected}
                onClick={() => handleRatingClick(value)}
                whileTap={
                  shouldReduceMotion
                    ? undefined
                    : {
                        scale: 0.94,
                        transition: {
                          type: "tween",
                          duration: 0.12,
                          ease: [0.22, 1, 0.36, 1]
                        }
                      }
                }
                whileHover={
                  shouldReduceMotion
                    ? undefined
                    : {
                        y: -1,
                        transition: {
                          type: "tween",
                          duration: 0.18,
                          ease: [0.22, 1, 0.36, 1]
                        }
                      }
                }
                transition={{
                  type: "tween",
                  duration: 0.2,
                  ease: [0.22, 1, 0.36, 1]
                }}
                className={cn(
                  "ios-touch-target relative z-10 grid h-14 place-items-center rounded-[20px] text-[28px] leading-none transition-[opacity,transform] active:scale-95 sm:h-16 sm:text-[30px]",
                  isSelected ? "opacity-100" : "opacity-[0.58]"
                )}
              >
                {isSelected ? (
                  <motion.span
                    className="absolute inset-0 rounded-[20px] bg-surface shadow-[0_8px_22px_rgba(15,23,42,0.1)] ring-1 ring-foreground/[0.07] dark:bg-surface-3 dark:shadow-none"
                    layoutId="wizard-rating-active-pill"
                    transition={{
                      type: "tween",
                      duration: 0.18,
                      ease: [0.22, 1, 0.36, 1]
                    }}
                  />
                ) : null}
                {shouldPulse ? (
                  <span
                    key={`rating-tap-${value}-${pickerRun.id}`}
                    className="iz-rating-picker-ripple absolute inset-1 rounded-[16px] bg-[var(--wizard-accent)]"
                  />
                ) : null}
                <span
                  key={isSelected ? `selected-${value}-${pickerRun.id}` : `option-${value}`}
                  aria-hidden="true"
                  className={cn(
                    "relative z-10 origin-[50%_70%] transition-[opacity,transform] duration-200 ease-out",
                    isSelected
                      ? "translate-y-0 scale-[1.16] opacity-100"
                      : "translate-y-0 scale-100 opacity-[0.78]",
                    shouldPulse && "iz-rating-picker-pop"
                  )}
                  style={{
                    transformOrigin: "50% 70%"
                  }}
                >
                  {emoji}
                </span>
              </motion.button>
            );
          })}
        </div>
      </LayoutGroup>
    </div>
  );
};
