const socialUserToLink = {
  instagram: (username) => `https://www.instagram.com/${username.substring(1)}`,
  facebook: (username) => username
}

export default {
  socialLink(app, username) {
    return socialUserToLink[app](username)
  }
}
