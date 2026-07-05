import pugPlugin from '@11ty/eleventy-plugin-pug';
import { EleventyHtmlBasePlugin } from "@11ty/eleventy";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(pugPlugin);
  eleventyConfig.addPlugin(EleventyHtmlBasePlugin);
  eleventyConfig.setTemplateFormats('pug,md,11ty.js');
  eleventyConfig.setInputDirectory('src');
  eleventyConfig.addPassthroughCopy('src/css')
  eleventyConfig.addPassthroughCopy('src/images')
  eleventyConfig.addPassthroughCopy('src/scripts')
  eleventyConfig.setOutputDirectory('dist')
  eleventyConfig.addWatchTarget('src/_models/', { resetConfig: true })
  eleventyConfig.addWatchTarget('src/_models/data/', { resetConfig: true })
}
