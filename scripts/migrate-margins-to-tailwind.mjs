#!/usr/bin/env node
/**
 * Replace raw margin declarations in css/main.css with Tailwind @apply utilities.
 * Processes innermost CSS rule blocks first (including inside @media).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mainCss = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "css", "main.css");
let css = fs.readFileSync(mainCss, "utf8");

/** @param {string} v */
function norm(v) {
  return v.trim().replace(/\s+/g, " ");
}

/** @param {string} value */
function remToTw(value) {
  const m = /^([\d.]+)rem$/.exec(value);
  if (!m) return null;
  const rem = Number(m[1]);
  const map = [
    [0, "0"],
    [0.125, "0.5"],
    [0.25, "1"],
    [0.375, "1.5"],
    [0.5, "2"],
    [0.625, "2.5"],
    [0.75, "3"],
    [0.875, "3.5"],
    [1, "4"],
    [1.125, "4.5"],
    [1.25, "5"],
    [1.5, "6"],
    [1.625, "6.5"],
    [1.75, "7"],
    [2, "8"],
  ];
  let best = null;
  let bestDiff = Infinity;
  for (const [r, tw] of map) {
    const d = Math.abs(rem - r);
    if (d < bestDiff) {
      bestDiff = d;
      best = tw;
    }
  }
  return bestDiff <= 0.06 ? best : `[${value}]`;
}

/** @param {string} value */
function pxToTw(value) {
  const m = /^(\d+)px$/.exec(value);
  if (!m) return null;
  const px = Number(m[1]);
  const map = [
    [0, "0"],
    [1, "px"],
    [2, "0.5"],
    [4, "1"],
    [6, "1.5"],
    [8, "2"],
    [10, "2.5"],
    [12, "3"],
    [14, "3.5"],
    [16, "4"],
    [18, "4.5"],
    [20, "5"],
    [24, "6"],
    [26, "6.5"],
    [28, "7"],
    [32, "8"],
    [40, "10"],
  ];
  for (const [p, tw] of map) {
    if (p === px) return tw;
  }
  return `[${value}]`;
}

/** @param {string} token */
function tokenToTw(token) {
  const t = norm(token);
  if (t === "0") return "0";
  if (t === "auto") return "auto";
  if (t === "-1px") return "px";
  if (t.startsWith("var(") || t.startsWith("clamp(") || t.startsWith("calc(")) {
    return `[${t.replace(/\s+/g, "")}]`;
  }
  const px = pxToTw(t);
  if (px) return px;
  const rem = remToTw(t);
  if (rem) return rem;
  return `[${t}]`;
}

/** @param {string} prop @param {string} value */
function marginPropToApply(prop, value) {
  const v = norm(value);
  if (prop === "margin-inline-start" || prop === "margin-inline-end") {
    const side = prop === "margin-inline-start" ? "s" : "e";
    if (v === "auto") return [`m${side}-auto`];
    return [`m${side}-${tokenToTw(v)}`];
  }
  if (prop === "margin-inline") {
    if (v === "auto") return ["mx-auto"];
    const parts = v.split(/\s+/);
    if (parts.length === 1) return [`mx-${tokenToTw(parts[0])}`];
    return [`ms-${tokenToTw(parts[0])}`, `me-${tokenToTw(parts[1])}`];
  }
  if (prop === "margin") {
    const parts = v.split(/\s+/);
    if (parts.length === 1) {
      if (parts[0] === "0") return ["m-0"];
      if (parts[0] === "auto") return ["m-auto"];
      if (parts[0] === "-1px") return ["-m-px"];
      return [`m-${tokenToTw(parts[0])}`];
    }
    if (parts.length === 2 && parts[0] === "0" && parts[1] === "auto") return ["mx-auto"];
    if (parts.length === 2) {
      const out = [];
      if (parts[0] !== "0") out.push(`my-${tokenToTw(parts[0])}`);
      if (parts[1] !== "0") out.push(`mx-${tokenToTw(parts[1])}`);
      return out;
    }
    if (parts.length === 3) {
      const out = [];
      if (parts[0] !== "0") out.push(`mt-${tokenToTw(parts[0])}`);
      if (parts[1] !== "0") out.push(`mx-${tokenToTw(parts[1])}`);
      if (parts[2] !== "0") out.push(`mb-${tokenToTw(parts[2])}`);
      return out;
    }
    if (parts.length === 4) {
      const out = [];
      if (parts[0] !== "0") out.push(`mt-${tokenToTw(parts[0])}`);
      if (parts[1] !== "0") out.push(`mr-${tokenToTw(parts[1])}`);
      if (parts[2] !== "0") out.push(`mb-${tokenToTw(parts[2])}`);
      if (parts[3] !== "0") out.push(`ml-${tokenToTw(parts[3])}`);
      return out;
    }
  }
  const side = {
    "margin-top": "t",
    "margin-bottom": "b",
    "margin-left": "l",
    "margin-right": "r",
  }[prop];
  if (!side) return [];
  if (v === "0") return [`m${side}-0`];
  if (v === "auto") return [`m${side}-auto`];
  return [`m${side}-${tokenToTw(v)}`];
}

const marginRe =
  /^\s*(margin(?:-(?:top|bottom|left|right|inline-start|inline-end|inline|block))?)\s*:\s*([^;]+);?\s*$/;
const ruleRe = /([^{}]+)\{([^{}]*)\}/g;

let changed = 0;
let pass = 0;

while (pass < 50) {
  let passChanged = 0;
  css = css.replace(ruleRe, (full, selector, body) => {
    if (body.includes("{")) return full;

    const lines = body.split("\n");
    /** @type {string[]} */
    const apply = [];
    /** @type {string[]} */
    const kept = [];
    let existingApply = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        kept.push(line);
        continue;
      }
      const applyMatch = /^\s*@apply\s+([^;]+);/.exec(line);
      if (applyMatch) {
        existingApply = applyMatch[1].trim();
        continue;
      }
      const m = marginRe.exec(line);
      if (m) {
        apply.push(...marginPropToApply(m[1], m[2]));
        passChanged++;
        continue;
      }
      kept.push(line);
    }

    if (!apply.length) return full;

    const merged = [...new Set([...(existingApply ? existingApply.split(/\s+/) : []), ...apply])];
    const applyLine = `  @apply ${merged.join(" ")};`;
    const insertAt = kept.findIndex((l) => l.trim());
    if (insertAt >= 0) kept.splice(insertAt, 0, applyLine);
    else kept.unshift(applyLine);

    return `${selector}{${kept.join("\n")}}`;
  });
  changed += passChanged;
  if (!passChanged) break;
  pass++;
}

fs.writeFileSync(mainCss, css);
console.log(`Migrated ${changed} margin declarations → @apply in css/main.css`);
