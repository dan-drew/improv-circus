/**
 * @typedef {Object} LocationData
 * @property {string} [name]
 * @property {string} [link]
 * @property {string} city
 * @property {string} state
 * @property {string} [street]
 * @property {string} [zip]
 * @property {number} [lat]
 * @property {number} [lng]
 */

/**
 @typedef {Object} Location
 @property {string} [name]
 @property {string} [link]
 @property {string} city
 @property {string} state
 @property {string} [street]
 @property {string} [zip]
 @property {number} [lat]
 @property {number} [lng]
 @property {string} full
 @property {string} [link]
 */
export class Location {
  /**
   * @param {LocationData} data
   */
  constructor(data) {
    Object.assign(this, data)

    if (this.street && this.zip) {
      this.full = `${this.street}, ${this.city} ${this.state}, ${this.zip}`
    } else {
      this.full = `${this.city}, ${this.state}`
    }

    if (!this.link && this.lat) {
      this.link = `https://www.google.com/maps/@${this.lat},${this.lng}`
    }
  }
}