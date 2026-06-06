import pugPlugin from '@11ty/eleventy-plugin-pug';
import YAML from "yaml";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(pugPlugin);
  eleventyConfig.setTemplateFormats('pug,md');
  eleventyConfig.setInputDirectory('src');
  eleventyConfig.addPassthroughCopy('src/css')
  eleventyConfig.addPassthroughCopy('src/images')
  eleventyConfig.addPassthroughCopy('src/js')
  eleventyConfig.setOutputDirectory('dist')
	eleventyConfig.addDataExtension("yaml", (contents) => YAML.parse(contents));
}
