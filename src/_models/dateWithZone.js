/**
 * @typedef {Object} WhenData
 * @property {string} date Date in YYYY-MM-DD format
 * @property {string} time Time in HH:MM format
 * @property {string} [timeZone] Optional IANA time zone
 */


export class DateWithZone {
  static DEFAULT_TIME_ZONE = "America/Los_Angeles";
  static LOCALE = "en-US";
  static DAY_MS = 24 * 60 * 60 * 1000;
  static MINUTE_MS = 60 * 1000;
  static _localShortDateTimeFormat = new Intl.DateTimeFormat(DateWithZone.LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DateWithZone.DEFAULT_TIME_ZONE,
  });
  static _localOffsetFormat = new Intl.DateTimeFormat(DateWithZone.LOCALE, {
    timeZone: DateWithZone.DEFAULT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "shortOffset",
  });

  static localShortDateParts(date) {
    return Object.fromEntries(DateWithZone._localShortDateTimeFormat.formatToParts(date).map(part => [part.type, part.value]));
  }

  static parseOffsetMinutes(timeZoneName) {
    if (timeZoneName === "GMT" || timeZoneName === "UTC") {
      return 0;
    }
    const match = timeZoneName.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
    if (!match) {
      throw new Error(`Unsupported offset format: ${timeZoneName}`);
    }
    const sign = match[1] === "+" ? 1 : -1;
    const hours = Number(match[2]);
    const minutes = Number(match[3] ?? "0");
    return sign * ((hours * 60) + minutes);
  }

  static localOffsetMinutes(date) {
    const timeZoneName = DateWithZone._localOffsetFormat.formatToParts(date).find(part => part.type === "timeZoneName")?.value;
    if (!timeZoneName) {
      throw new Error("Missing local timezone offset");
    }
    return DateWithZone.parseOffsetMinutes(timeZoneName);
  }

  static utcDateForLocalDateTime(year, month, day, hour, minute) {
    const localAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    let utcMs = localAsUtcMs;
    for (let i = 0; i < 4; i += 1) {
      const offsetMinutes = DateWithZone.localOffsetMinutes(new Date(utcMs));
      const nextUtcMs = localAsUtcMs - (offsetMinutes * DateWithZone.MINUTE_MS);
      if (nextUtcMs === utcMs) break;
      utcMs = nextUtcMs;
    }
    return new Date(utcMs);
  }

  /**
   * Create a new DateWithZone instance
   * @param {WhenData} when
   */
  constructor({date, time, timeZone = DateWithZone.DEFAULT_TIME_ZONE}) {
    const [year, month, day] = date.split("-").map(Number);
    const [hour24, minute] = time.split(":").map(Number);
    const utcDate = DateWithZone.utcDateForLocalDateTime(year, month, day, hour24, minute);
    const parts = DateWithZone.localShortDateParts(utcDate);

    this.iso = utcDate.toISOString();
    this._utcDate = utcDate;
    this.year = year;
    this.month = month;
    this.day = day;
    this.hour24 = hour24;
    this.minute = minute;
    this.timeZone = timeZone;
    this.shortDateTime = `${parts.month} ${parts.day} ${parts.hour}:${parts.minute}${parts.dayPeriod}`
    this.isoDate = `${this.year.toString().padStart(4, "0")}-${this.month.toString().padStart(2, "0")}-${this.day.toString().padStart(2, "0")}`;

    this.ampm = this.hour24 >= 12 ? "PM" : "AM";
    this.hour = this.hour24 % 12;
    if (this.hour === 0) this.hour = 12;

    Object.freeze(this);
  }

  toString() {
    return this.iso;
  }
}
