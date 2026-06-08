import pugPlugin from '@11ty/eleventy-plugin-pug';
import { EleventyHtmlBasePlugin } from "@11ty/eleventy";
import YAML from "yaml";

// function pagePrefix() {
//   let value = process.envPAGE_PREFIX
//   if (value && value.length > 0) {
//     return `/${value}/`.replace('//', '/')
//   }
//   return '/'
// }

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(pugPlugin);
  eleventyConfig.addPlugin(EleventyHtmlBasePlugin);
  eleventyConfig.setTemplateFormats('pug,md');
  eleventyConfig.setInputDirectory('src');
  // eleventyConfig.setPathPrefix(pagePrefix());
  eleventyConfig.addPassthroughCopy('src/css')
  eleventyConfig.addPassthroughCopy('src/images')
  eleventyConfig.addPassthroughCopy('src/scripts')
  eleventyConfig.setOutputDirectory('dist')
	eleventyConfig.addDataExtension("yaml", (contents) => YAML.parse(contents));
}
