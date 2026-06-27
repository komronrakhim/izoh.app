import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { IZOH_WORDMARK_PATHS } from "../src/shared/brand";

const require = createRequire(import.meta.url);
const fontkit = require("fontkit") as {
  openSync: (filePath: string) => OpenRundeFont;
};

type OpenRundeFont = {
  layout: (text: string) => {
    glyphs: Array<{
      path: {
        toSVG: () => string;
      };
    }>;
    positions: Array<{
      xAdvance: number;
      xOffset?: number;
      yOffset?: number;
    }>;
  };
  unitsPerEm: number;
};

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(rootDir, "public/meta/og");
const outputSvgPath = path.join(outputDir, "izoh-og.svg");
const outputPngPath = path.join(outputDir, "izoh-og.png");
const guestFeedbackMockupPath = path.join(rootDir, "public/landing/mockups/guest-feedback.png");

const fontPaths = {
  bold: path.join(rootDir, "src/assets/fonts/open-runde/OpenRunde-Bold.woff2"),
  medium: path.join(rootDir, "src/assets/fonts/open-runde/OpenRunde-Medium.woff2"),
  regular: path.join(rootDir, "src/assets/fonts/open-runde/OpenRunde-Regular.woff2"),
  semibold: path.join(rootDir, "src/assets/fonts/open-runde/OpenRunde-Semibold.woff2")
};

const fonts = {
  bold: fontkit.openSync(fontPaths.bold),
  medium: fontkit.openSync(fontPaths.medium),
  regular: fontkit.openSync(fontPaths.regular),
  semibold: fontkit.openSync(fontPaths.semibold)
};

const toDataUri = async (filePath: string, mimeType: string) => {
  const file = await readFile(filePath);

  return `data:${mimeType};base64,${file.toString("base64")}`;
};

const createWordmark = () =>
  IZOH_WORDMARK_PATHS.map((pathData) => `<path d="${pathData}" fill="currentColor"/>`).join("");

const formatNumber = (value: number) => Number(value.toFixed(3)).toString();

const createTextPath = ({
  fill,
  size,
  text,
  weight,
  x,
  y
}: {
  fill: string;
  size: number;
  text: string;
  weight: keyof typeof fonts;
  x: number;
  y: number;
}) => {
  const font = fonts[weight];
  const run = font.layout(text);
  const scale = size / font.unitsPerEm;
  let cursorX = 0;

  const paths = run.glyphs
    .map((glyph, index) => {
      const position = run.positions[index] ?? { xAdvance: 0 };
      const glyphX = x + (cursorX + (position.xOffset ?? 0)) * scale;
      const glyphY = y - (position.yOffset ?? 0) * scale;
      cursorX += position.xAdvance;

      return `<path d="${glyph.path.toSVG()}" transform="translate(${formatNumber(
        glyphX
      )} ${formatNumber(glyphY)}) scale(${formatNumber(scale)} -${formatNumber(scale)})"/>`;
    })
    .join("");

  return `<g fill="${fill}">${paths}</g>`;
};

const createSvg = ({
  guestFeedbackMockup
}: {
  guestFeedbackMockup: string;
}) => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="background" x1="0" x2="1200" y1="0" y2="630" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#F8F5FF"/>
    </linearGradient>
    <radialGradient id="purpleGlow" cx="0" cy="0" r="1" gradientTransform="translate(958 106) rotate(112) scale(438 488)" gradientUnits="userSpaceOnUse">
      <stop stop-color="#E7DAFF"/>
      <stop offset="0.65" stop-color="#F5F0FF"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="greenGlow" cx="0" cy="0" r="1" gradientTransform="translate(150 560) rotate(-35) scale(340 240)" gradientUnits="userSpaceOnUse">
      <stop stop-color="#DDF9E8"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <filter id="softShadow" x="625" y="-80" width="640" height="820" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="26" flood-color="#25143D" flood-opacity="0.16" stdDeviation="34"/>
    </filter>
  </defs>

  <rect width="1200" height="630" fill="url(#background)"/>
  <rect width="1200" height="630" fill="url(#purpleGlow)"/>
  <rect width="1200" height="630" fill="url(#greenGlow)"/>
  <circle cx="1088" cy="98" r="158" fill="#6817FF" opacity="0.09"/>
  <circle cx="101" cy="569" r="144" fill="#34C759" opacity="0.12"/>

  <g color="#17111F" transform="translate(80 70) scale(0.25)">
    ${createWordmark()}
  </g>

  ${createTextPath({ fill: "#17111F", size: 66, text: "Слушайте гостей", weight: "bold", x: 80, y: 272 })}
  ${createTextPath({ fill: "#17111F", size: 66, text: "вовремя", weight: "bold", x: 80, y: 348 })}
  ${createTextPath({
    fill: "#62596F",
    size: 31,
    text: "Гость делится впечатлением,",
    weight: "regular",
    x: 82,
    y: 416
  })}
  ${createTextPath({
    fill: "#62596F",
    size: 31,
    text: "а команда видит, что важно",
    weight: "regular",
    x: 82,
    y: 457
  })}

  <g filter="url(#softShadow)">
    <image href="${guestFeedbackMockup}" x="704" y="-18" width="452" height="610" preserveAspectRatio="xMidYMid meet"/>
  </g>
</svg>
`;

const main = async () => {
  const guestFeedbackMockup = await toDataUri(guestFeedbackMockupPath, "image/png");

  const renderSvg = createSvg({
    guestFeedbackMockup
  });
  const sourceSvg = createSvg({
    guestFeedbackMockup: "../../landing/mockups/guest-feedback.png"
  });

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputSvgPath, sourceSvg);
  await sharp(Buffer.from(renderSvg)).png({ compressionLevel: 9 }).toFile(outputPngPath);

  const metadata = await sharp(outputPngPath).metadata();
  console.log(
    `Generated ${path.relative(rootDir, outputPngPath)} (${metadata.width}x${metadata.height})`
  );
};

await main();
