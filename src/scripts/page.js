const MINUTE_MS = 60 * 1000;
const DAY_MINUTES = 24 * 60;
const MONTHS = [null, 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const TODAY_STR = 'Today';
const TOMORROW_STR = 'Tomorrow';

/**
 * Calculate the number of days since the epoch in local timezone
 * @param date {Date}
 * @return {number}
 */
function dateLocalDays(date) {
  return Math.floor(((date.getTime() / MINUTE_MS) - date.getTimezoneOffset()) / DAY_MINUTES)
}

function dateInfo(value = undefined) {
  const date = value ? new Date(value) : new Date()
  const hours = date.getHours() % 12;
  return {
    date,
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    days: dateLocalDays(date),
    hour: hours === 0 ? 12 : hours,
    minute: date.getMinutes(),
    ampm: date.getHours() >= 12 ? 'PM' : 'AM'
  }
}

const TODAY = dateInfo();

/**
 * Update the show info
 * @param target {HTMLElement}
 */
function updateShowInfo(target) {
  const show = dateInfo(target.dataset.showTime)
  const dayElement = target.querySelector('.show_day')
  const timeElement = target.querySelector('.show_time')

  const daysDelta = show.days - TODAY.days
  if (daysDelta === 0) {
    dayElement.textContent = TODAY_STR
  } else if (daysDelta === 1) {
    dayElement.textContent = TOMORROW_STR
  } else {
    dayElement.textContent = `${MONTHS[show.month]} ${show.day}`
  }

  if (show.minute === 0) {
    timeElement.textContent = `${show.hour}${show.ampm}`
  } else {
    timeElement.textContent = `${show.hour}:${show.minute}${show.ampm}`
  }

  if (daysDelta < 0) {
    target.classList.add('show_past')
  } else {
    target.classList.add('show_active')
  }
}

function initPage() {
  document.querySelectorAll('.show_card').forEach(updateShowInfo)
}

document.addEventListener('DOMContentLoaded', initPage);
