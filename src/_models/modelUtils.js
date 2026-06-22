import markdownIt from "markdown-it";
import { readFileSync } from "node:fs";
import YAML from "yaml";

const _markdown = markdownIt('commonmark')
const shortDateTime = new Intl.DateTimeFormat(navigator.languages, { dateStyle: 'medium', timeStyle: 'short' })

/**
 *
 * @param {"people", "shows", "theaters"} type
 * @param {string} name
 * @returns {string}
 */
export function imageUrl(type, name) {
  return `/images/${type}/${name}`
}

export function markdown(val) {
  return _markdown.render(val)
}

export function loadYaml(relativePath) {
  return YAML.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

function padZero(num, size) {
  return String(num).padStart(size, '0')
}

export function isoDate(date) {
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1, 2)}-${padZero(date.getDate(), 2)}`
}

export function shortDateParts(date) {
  return Object.fromEntries(shortDateTime.formatToParts(date).map(part => [part.type, part.value]))
}

export function shortDate(date) {
  const parts = shortDateParts(date)
  return `${parts.month} ${parts.day} ${parts.hour}:${parts.minute}${parts.dayPeriod}`
}
