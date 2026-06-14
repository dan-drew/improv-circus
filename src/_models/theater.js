/**
 * @typedef {Object} TheaterData
 * @property {string} name
 * @property {string} location
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
