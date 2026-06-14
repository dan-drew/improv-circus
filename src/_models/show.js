import { Player } from "./player.js";
import { Theater } from "./theater.js";
import {imageUrl, markdown} from "./modelUtils.js";

/**
 * @typedef {Object} ShowType
 * @property {string} name
 * @property {string} description
 * @property {string} image
 * @property {string} banner_image
 */

/**
 * @typedef {Object} TicketData
 * @property {string} cost
 * @property {string} [link]
 */

/**
 * @typedef {Object} ShowData
 * @property {string} type
 * @property {string} slug
 * @property {string} [name]
 * @property {string} [description]
 * @property {string} [image]
 * @property {string} [banner_image]
 * @property {string} [when]
 * @property {string} theater
 * @property {string} [theater_show_link]
 * @property {string[]} players
 */

export class Show {
  /**
   * Create a new show
   * @param {ShowData} data
   * @param {object} globalData
   * @param {Record<string, ShowType>} globalData.showTypes
   * @param {Record<string, Theater>} globalData.theaters
   * @param {Record<string, Player>} globalData.players
   */
  constructor(data, {showTypes, theaters, players}) {
    const type = showTypes[data.type];
    this.slug = data.slug;
    this.name = data.name ?? type.name;
    this.description = markdown(data.description ?? type.description ?? '');
    this.image = imageUrl('shows', data.image ?? type.image);
    this.bannerImage = imageUrl('shows', data.banner_image ?? type.banner_image ?? data.image ?? type.image);
    this.when = new Date(data.when);
    this.theater = theaters[data.theater];
    this.theaterShowLink = data.theater_show_link;
    this.tickets = data.tickets;
    this.players = data.players.map(key => players[key]);
    this.pageLink = `/shows/${this.slug}`;
    this.permaLink = `${this.pageLink}/index.html`;
  }
}
