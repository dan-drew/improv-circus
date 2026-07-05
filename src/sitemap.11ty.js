import { SitemapStream, streamToPromise } from "sitemap";

function isHtmlPage(item) {
  return item.outputPath?.endsWith(".html");
}

function isSitemapIgnored(item) {
  return item.data?.sitemap?.ignore === true;
}

function pageUrl(item) {
  return item.data?.page?.url ?? item.url;
}

function normalizeUrl(url) {
  if (!url || url === "/") {
    return url;
  }
  if (url.endsWith("/")) {
    return url;
  }
  const tail = url.split("/").pop();
  return tail?.includes(".") ? url : `${url}/`;
}

export default class SitemapTemplate {
  data() {
    return {
      permalink: "/sitemap.xml",
      eleventyExcludeFromCollections: true,
    };
  }

  async render({ collections, site, build, shows = [] }) {
    const stream = new SitemapStream({ hostname: site.url });
    const urls = new Set();
    const writeUrl = (url) => {
      const normalized = normalizeUrl(url);
      if (!normalized || urls.has(normalized)) {
        return;
      }
      urls.add(normalized);
      stream.write({
        url: normalized,
        lastmod: build.timestamp,
      });
    };

    collections.all
      .filter(isHtmlPage)
      .filter((item) => !isSitemapIgnored(item))
      .forEach((item) => {
        writeUrl(pageUrl(item));
      });

    shows.forEach((show) => writeUrl(show.pageLink));

    stream.end();
    return (await streamToPromise(stream)).toString();
  }
}
