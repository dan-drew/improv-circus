/**
 * @typedef {"instagram" | "facebook" | "tiktok" | "x"} SocialApp
 */

/**
 * @typedef {Record<SocialApp, string>} SocialData
 */

/**
 * @typedef {Object} MetaData
 * @property {string} [title]
 * @property {string} [description]
 * @property {string} [image]
 * @property {LocationData} [location]
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

  /**
   *
   * @param {MetaData} target
   * @param {MetaData} [metaData]
   * @return {Record<string, string>}
   */
  static meta(target, metaData = {}) {
    // @type {Record<string, string>}
    let result = {
      'og:type': 'website',
      'og:locale': 'en_US',
      'geo.region': 'US-CA',
      'twitter:card': 'summary_large_image'
    }

    for (const prefix of ['og:', 'twitter:']) {
      result[`${prefix}title`] = metaData.title || target.title || 'Improv Circus'
      result[`${prefix}description`] = metaData.description || target.description
      result[`${prefix}image`] = `baseUri:${metaData.image || target.image || '/images/improv-circus.png'}`
    }

    Object.assign(result, Social._locationMeta(metaData.location || target.location))

    return result
  }

  /**
   * Create location meta data
   * @param {LocationData, undefined} location
   * @private
   */
  static _locationMeta(location) {
    return location ? {
      'geo.placename': `${location.city}, ${location.state}`,
      'geo.position': `${location.lat};${location.lng}`,
      'ICBM': `${location.lat}, ${location.lng}`
    } : {}
  }
}
