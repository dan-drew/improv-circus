import markdownIt from "markdown-it";
import { readFileSync } from "node:fs";
import YAML from "yaml";

const _markdown = markdownIt('commonmark')
const SHORT_DATE_TIME_FORMAT = new Intl.DateTimeFormat(navigator.languages, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })

/**
 *
 * @param {"people" | "shows" | "theaters"} type
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

/**
 * 
 * @param {Date|number} date 
 * @returns {Record<string, string>} An object mapping date part types to their values
 */
export function shortDateParts(date) {
  return Object.fromEntries(SHORT_DATE_TIME_FORMAT.formatToParts(date).map(part => [part.type, part.value]))
}

/**
 * 
 * @param {Date} date 
 * @returns 
 */
export function shortDate(date) {
  const parts = shortDateParts(date)
  return `${parts.month} ${parts.day} ${parts.hour}:${parts.minute}${parts.dayPeriod}`
}
