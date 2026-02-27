import chalk, { Chalk } from "chalk";
import { PALM_PALETTE } from "./palette.js";

const hasForceColor =
  typeof process.env.FORCE_COLOR === "string" &&
  process.env.FORCE_COLOR.trim().length > 0 &&
  process.env.FORCE_COLOR.trim() !== "0";

const baseChalk = process.env.NO_COLOR && !hasForceColor ? new Chalk({ level: 0 }) : chalk;

const hex = (value: string) => baseChalk.hex(value);

export const theme = {
  accent: hex(PALM_PALETTE.accent),
  accentBright: hex(PALM_PALETTE.accentBright),
  accentDim: hex(PALM_PALETTE.accentDim),
  info: hex(PALM_PALETTE.info),
  success: hex(PALM_PALETTE.success),
  warn: hex(PALM_PALETTE.warn),
  error: hex(PALM_PALETTE.error),
  muted: hex(PALM_PALETTE.muted),
  heading: baseChalk.bold.hex(PALM_PALETTE.accent),
  command: hex(PALM_PALETTE.accentBright),
  option: hex(PALM_PALETTE.warn),
} as const;

export const isRich = () => Boolean(baseChalk.level > 0);

export const colorize = (rich: boolean, color: (value: string) => string, value: string) =>
  rich ? color(value) : value;
