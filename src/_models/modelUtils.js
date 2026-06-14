import markdownIt from "markdown-it";
import { readFileSync } from "node:fs";
import YAML from "yaml";

const _markdown = markdownIt('commonmark')

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
