/**
 * @typedef {"instagram" | "facebook" | "tiktok"} SocialApp
 */

/**
 * @typedef {Record<SocialApp, string>} SocialData
 */

/**
 * @type {Record<SocialApp, function(string): string>}
 */
const socialUserToLink = {
  instagram: (username) => `https://www.instagram.com/${username.substring(1)}`,
  facebook: (username) => username,
  tiktok: (username) => `https://www.tiktok.com/@${username}`
}

export class Social {
  constructor(app, username) {
    this.app = app;
    this.username = username;
    this.link = socialUserToLink[app](username);
  }

  /**
   * Create a social list from data
   * @param {SocialData} [data]
   * @return {Social[], undefined}
   */
  static fromData(data) {
    return data ? Object.entries(data).map(([app, username]) => new Social(app, username)) : undefined;
  }
}
