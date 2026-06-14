export default {
  pagination: {
    data: 'shows',
    size: 1,
    alias: 'show'
  },
  permalink: ({show}) => `shows/${ show.slug }/index.html`
}
