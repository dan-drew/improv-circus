/**
 * @typedef {Object} WhenData
 * @property {string} date Date in YYYY-MM-DD format
 * @property {string} time Time in HH:MM format
 * @property {string} [timeZone] Optional IANA time zone
 */


export class DateWithZone {
  static DEFAULT_TIME_ZONE = "America/Los_Angeles";
  static LOCALE = "en-US";
  static _shortDateTimeFormats = new Map();

  static shortDateTimeFormat(timeZone) {
    if (!DateWithZone._shortDateTimeFormats.has(timeZone)) {
      DateWithZone._shortDateTimeFormats.set(timeZone, new Intl.DateTimeFormat(DateWithZone.LOCALE, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone,
      }));
    }
    return DateWithZone._shortDateTimeFormats.get(timeZone);
  }

  static shortDateParts(date, timeZone) {
    return Object.fromEntries(DateWithZone.shortDateTimeFormat(timeZone).formatToParts(date).map(part => [part.type, part.value]));
  }

  static pad2(num) {
    return String(num).padStart(2, "0");
  }

  /**
   * Create a new DateWithZone instance
   * @param {WhenData} when
   */
  constructor({date, time, timeZone = DateWithZone.DEFAULT_TIME_ZONE}) {
    this.zonedDateTime = Temporal.PlainDateTime
      .from(`${date}T${time}:00`)
      .toZonedDateTime(timeZone);
    const utcDate = new Date(this.zonedDateTime.epochMilliseconds);
    const parts = DateWithZone.shortDateParts(utcDate, timeZone);

    this.iso = utcDate.toISOString();
    this.year = this.zonedDateTime.year;
    this.month = this.zonedDateTime.month;
    this.day = this.zonedDateTime.day;
    this.hour24 = this.zonedDateTime.hour;
    this.minute = this.zonedDateTime.minute;
    this.timeZone = timeZone;
    this.shortDateTime = `${parts.month} ${parts.day} ${parts.hour}:${parts.minute}${parts.dayPeriod}`
    this.isoDate = `${this.year.toString().padStart(4, "0")}-${this.month.toString().padStart(2, "0")}-${this.day.toString().padStart(2, "0")}`;

    this.ampm = this.hour24 >= 12 ? "PM" : "AM";
    this.hour = this.hour24 % 12;
    if (this.hour === 0) this.hour = 12;

    Object.freeze(this);
  }

  /**
   * Create a new DateWithZone shifted by a number of minutes.
   * @param {number} minutes
   * @returns {DateWithZone}
   */
  add(minutes) {
    const shifted = this.zonedDateTime.add({ minutes });
    return new DateWithZone({
      date: shifted.toPlainDate().toString(),
      time: `${DateWithZone.pad2(shifted.hour)}:${DateWithZone.pad2(shifted.minute)}`,
      timeZone: this.timeZone,
    });
  }

  toString() {
    return this.iso;
  }
}
