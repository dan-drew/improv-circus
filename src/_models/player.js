import { Theater} from "./theater.js";
import { Social } from "./social.js";
import {imageUrl, markdown} from "./modelUtils.js";

/**
 * @typedef {Object} PlayerData
 * @property {string} name
 * @property {string} [nickname]
 * @property {string} [bio]
 * @property {string} [image]
 * @property {string[]} [theaters]
 * @property {SocialData} [social]
 */

export class Player {
  /**
   * Create a new player
   * @param {string} key
   * @param {PlayerData} data
   * @param {object} globalData
   * @param {Record<string, Theater>} globalData.theaters
   */
  constructor(key, data, {theaters}) {
    this.key = key;
    this.name = data.name;
    this.nickname = data.nickname ?? data.name.split(' ')[0];
    this.bio = data.bio ? markdown(data.bio) : undefined;
    this.image = imageUrl('people', data.image ?? 'default.png');
    this.theaters = data.theaters ? data.theaters.map(key => theaters[key]) : [];
    this.social = Social.fromData(data.social)
    console.info(this.name, ' social ', data.social, this.social)
  }
}
