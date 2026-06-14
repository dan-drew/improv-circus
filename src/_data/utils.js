import markdownIt from 'markdown-it';

const socialUserToLink = {
  instagram: (username) => `https://www.instagram.com/${username.substring(1)}`,
  facebook: (username) => username
}

const markdown = markdownIt('commonmark')

export default {
  socialLink(app, username) {
    return socialUserToLink[app](username)
  },
  markdown(val) {
    return markdown.render(val)
  },
  image(...parts) {
    return `/images/${parts.join('/')}`
  }
}
