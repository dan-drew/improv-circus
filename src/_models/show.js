import { Player } from "./player.js";
import { Theater } from "./theater.js";
import { Social } from "./social.js";
import { DateWithZone } from "./dateWithZone.js";
import { imageUrl } from "./modelUtils.js";

/**
 * @typedef {Object} ShowType
 * @property {string} name
 * @property {string} description
 * @property {string} headline
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
 * @property {string} [slug]
 * @property {string} [name]
 * @property {string} [description]
 * @property {string} [headline]
 * @property {string} [image]
 * @property {string} [banner_image]
 * @property {string} [when]
 * @property {string} theater
 * @property {string} [theater_show_link]
 * @property {string[]} players
 * @property {TicketData} [tickets]
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
    /** @type {DateWithZone} */
    this.when = new DateWithZone(data.when);
    this.slug = data.slug ?? Show.slug(data.type, this.when);
    this.name = data.name ?? type.name;
    this.headline = data.headline ?? type.headline
    this.description = data.description ?? type.description ?? '';
    this.image = imageUrl('shows', data.image ?? type.image);
    this.bannerImage = imageUrl('shows', data.banner_image ?? type.banner_image ?? data.image ?? type.image);
    this.theater = theaters[data.theater];
    this.theaterShowLink = data.theater_show_link;
    this.tickets = data.tickets;
    this.players = data.players.map(key => players[key]);
    this.pageLink = `/shows/${this.slug}`;
    this.permaLink = `${this.pageLink}/index.html`;
    this.title = `Improv Circus presents: ${this.name} - ${this.when.shortDateTime}`;

    this.meta = Social.meta(this, {
      title: this.title,
      location: this.theater.location,
      description: [
        this.description,
        this.tickets?.cost ? `🎟️ ${this.tickets.cost}` : undefined,
        `📍 ${this.theater.name}`,
      ].filter(it => !!it).join("\n"),
    })
  }

  /**
   * Build JSON-LD data for a show page
   * @param {{url: string, organization?: Record<string, any>}} site
   * @return {string}
   */
  jsonLD(site) {
    const baseUrl = site.url.replace(/\/$/, "");
    const eventUrl = `${baseUrl}${this.pageLink}`;
    const imageUrls = [this.bannerImage, this.image]
      .filter(Boolean)
      .map(path => `${baseUrl}${path}`);
    const postalAddress = {
      "@type": "PostalAddress",
      addressLocality: this.theater.location.city,
      addressRegion: this.theater.location.state,
      postalCode: this.theater.location.zip,
      streetAddress: this.theater.location.street,
      addressCountry: "US",
    };
    const location = {
      "@type": "Place",
      name: this.theater.name,
      url: this.theater.link,
      address: Object.fromEntries(Object.entries(postalAddress).filter(([, value]) => !!value)),
    };

    if (this.theater.location.lat !== undefined && this.theater.location.lng !== undefined) {
      location.geo = {
        "@type": "GeoCoordinates",
        latitude: this.theater.location.lat,
        longitude: this.theater.location.lng,
      };
    }

    const eventData = {
      "@context": "https://schema.org",
      "@type": "Event",
      "@id": `${eventUrl}#event`,
      url: eventUrl,
      name: this.name,
      description: this.description,
      image: imageUrls,
      organizer: site.organization ?? {
        "@type": "Organization",
        name: "Improv Circus",
        url: baseUrl,
        logo: `${baseUrl}/images/improv-circus.png`,
        email: "info@improv-circus.com",
      },
      startDate: this.when.iso,
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      audience: {
        "@type": "Audience",
        audienceType: "San Francisco Bay Area families, kids, teens, and adults",
      },
      location,
      performer: this.players.map(player => {
        const performer = {
          "@type": "Person",
          name: player.name,
          image: `${baseUrl}${player.image}`,
        };
        if (player.bioText) {
          performer.description = player.bioText;
        }
        return performer;
      }),
    };

    if (this.tickets?.link || this.tickets?.cost) {
      eventData.offers = {
        "@type": "Offer",
        url: this.tickets?.link ?? eventUrl,
        availability: "https://schema.org/InStock",
        ...(this.tickets?.cost ? { description: this.tickets.cost } : {}),
      };
    }

    return JSON.stringify(eventData, undefined, 2);
  }

  /**
   * Create a slug for a show
   * @param {string} type
   * @param {DateWithZone} when
   * @return {string}
   */
  static slug(type, when) {
    return `${type.replaceAll('_', '-')}-${when.isoDate}`
  }
}
