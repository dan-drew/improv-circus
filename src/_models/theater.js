/**
 * @typedef {Object} LocationData
 * @property {string} city
 * @property {string} state
 * @property {string} [street]
 * @property {string} [zip]
 * @property {number} [lat]
 * @property {number} [lng]
 */

/**
 * @typedef {Object} TheaterData
 * @property {string} name
 * @property {LocationData} location
 * @property {string} link
 */
import {imageUrl} from "./modelUtils.js";

export class Theater {
  /**
   * Create a new theater
   * @param {string} key
   * @param {TheaterData} data
   */
  constructor(key, data) {
    this.key = key;
    this.name = data.name;
    this.location = data.location
    this.link = data.link
    this.logo = imageUrl('theaters', `${key}.png`)
  }
}
