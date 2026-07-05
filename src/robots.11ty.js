export default class RobotsTemplate {
  data() {
    return {
      permalink: "/robots.txt",
      eleventyExcludeFromCollections: true,
    };
  }

  render({ site }) {
    return `User-agent: *
Allow: /
Disallow: /join/

Sitemap: ${site.url}/sitemap.xml
`;
  }
}
