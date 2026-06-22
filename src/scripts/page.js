class Page {
  MINUTE_MS = 60 * 1000;
  DAY_MINUTES = 24 * 60;
  MONTHS = [null, 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  TODAY_STR = 'Today';
  TOMORROW_STR = 'Tomorrow';
  TODAY = this.dateInfo();

  /**
   * Calculate the number of days since the epoch in local timezone
   * @param date {Date}
   * @return {number}
   */
  dateLocalDays(date) {
    return Math.floor(((date.getTime() / this.MINUTE_MS) - date.getTimezoneOffset()) / this.DAY_MINUTES)
  }

  dateInfo(value = undefined) {
    const date = value ? new Date(value) : new Date()
    const hours = date.getHours() % 12;
    return {
      date,
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      days: this.dateLocalDays(date),
      hour: hours === 0 ? 12 : hours,
      minute: date.getMinutes(),
      ampm: date.getHours() >= 12 ? 'PM' : 'AM'
    }
  }


  /**
   * Update the show info
   * @param target {HTMLElement}
   */
  updateShowInfo(target) {
    const show = this.dateInfo(target.dataset.showTime)
    const dayElement = target.querySelector('.show_day')
    const timeElement = target.querySelector('.show_time')

    const daysDelta = show.days - this.TODAY.days
    if (daysDelta === 0) {
      dayElement.textContent = this.TODAY_STR
    } else if (daysDelta === 1) {
      dayElement.textContent = this.TOMORROW_STR
    } else {
      dayElement.textContent = `${this.MONTHS[show.month]} ${show.day}`
    }

    const hourHtml = `<div class="hour">${show.hour}</div>`
    const minutesHtml = `<div class="divider">&nbsp;</div><div class="minutes">${show.minute.toString().padStart(2, '0')}</div>`
    const ampmHtml = `<div class="ampm">${show.ampm}</div>`
    timeElement.innerHTML = hourHtml + minutesHtml + ampmHtml

    target.dataset.showStatus = daysDelta >= 0 ? 'active' : 'past'
  }

  initPage() {
    document.querySelectorAll('[data-show-time]').forEach(target => this.updateShowInfo(target))
  }
}

window.page = new Page();
document.addEventListener('DOMContentLoaded', () => window.page.initPage());
