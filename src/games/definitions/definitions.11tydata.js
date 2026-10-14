export default {
  layout: 'game.pug',
  templateEngineOverride: 'md',
  eleventyComputed: {
    game: data => data.games.bySlug[data.gameSlug],
    permalink: data => `/games/${data.gameSlug}/index.html`,
  },
};
