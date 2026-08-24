class Page {
  DAY_MS = 24 * 60 * 60 * 1000;
  DEFAULT_TIME_ZONE = 'America/Los_Angeles';
  MONTHS = [null, 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  TODAY_STR = 'Today';
  TOMORROW_STR = 'Tomorrow';
  PARTS_FORMATTERS = new Map();

  /**
   * Calculate the number of days since the epoch in the show's local timezone
   * @param info {{ year: number, month: number, day: number }}
   * @return {number}
   */
  dateLocalDays(info) {
    return Math.floor(Date.UTC(info.year, info.month - 1, info.day) / this.DAY_MS)
  }

  partsFormatter(timeZone) {
    if (!this.PARTS_FORMATTERS.has(timeZone)) {
      this.PARTS_FORMATTERS.set(timeZone, new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }))
    }
    return this.PARTS_FORMATTERS.get(timeZone)
  }

  dateParts(value, timeZone) {
    return Object.fromEntries(
      this.partsFormatter(timeZone).formatToParts(value ? new Date(value) : new Date()).map(part => [part.type, part.value])
    )
  }

  dateInfo(value = undefined, timeZone = this.DEFAULT_TIME_ZONE) {
    const date = value ? new Date(value) : new Date()
    const parts = this.dateParts(value, timeZone)
    const hour24 = Number(parts.hour)
    const hours = hour24 % 12;
    return {
      date,
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      days: this.dateLocalDays({
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day)
      }),
      hour: hours === 0 ? 12 : hours,
      minute: Number(parts.minute),
      ampm: hour24 >= 12 ? 'PM' : 'AM'
    }
  }

  shuffleChildren(parent) {
    const children = Array.from(parent.children);
    let i = children.length;

    while (i > 1) {
      const j = Math.floor(Math.random() * i--);
      parent.appendChild(children[j]);
      children[j] = children[i];
    }
  }

  /**
   * Update the show info
   * @param target {HTMLElement}
   */
  updateShowInfo(target) {
    const timeZone = target.dataset.showTz || this.DEFAULT_TIME_ZONE
    const show = this.dateInfo(target.dataset.showTime, timeZone)
    const today = this.dateInfo(undefined, timeZone)
    const dayElement = target.querySelector('.show_day')
    const timeElement = target.querySelector('.show_time')

    const daysDelta = show.days - today.days
    const temporalStatus = daysDelta < 0 ? 'past' : (daysDelta === 0 ? 'today' : (daysDelta === 1 ? 'tomorrow' : 'future'))
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

    target.dataset.showTemporal = temporalStatus
    target.dataset.showStatus = temporalStatus === 'past' ? 'past' : 'active'
  }

  trackEvent(eventName, params = {}) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, {
        page_location: window.location.pathname,
        ...params
      })
    }
  }

  bindTicketClicks() {
    document.querySelectorAll('.tickets.show_active[href]').forEach(link => {
      link.addEventListener('click', () => {
        this.trackEvent('tickets_click', {
          event_category: 'engagement',
          event_label: link.dataset.showName || 'tickets',
          show_name: link.dataset.showName || 'unknown',
          ticket_url: link.href
        })
      })
    })
  }

  bindSocialClicks() {
    document.querySelectorAll('.social_link[href]').forEach(link => {
      link.addEventListener('click', () => {
        this.trackEvent('social_click', {
          event_category: 'engagement',
          event_label: link.dataset.platform || 'social',
          platform: link.dataset.platform || 'unknown',
          destination: link.href
        })
      })
    })
  }

  bindContentToggles() {
    document.querySelectorAll('.card[data-truncate-content-at]').forEach((card, index) => {
      const content = card.querySelector(':scope > .card_content')
      const truncateAt = Number(card.dataset.truncateContentAt)
      const truncateOver = Number(card.dataset.truncateContentOver || truncateAt)

      if (!content || !Number.isInteger(truncateAt) || truncateAt < 1 || !Number.isInteger(truncateOver) || truncateOver < truncateAt) {
        return
      }

      const words = content.innerText.trim().split(/\s+/)
      if (words.length <= truncateOver) {
        return
      }

      const fullContent = document.createElement('div')
      fullContent.id = `truncated-card-content-${index}`
      fullContent.className = 'content_full'
      fullContent.append(...content.childNodes)

      const summary = document.createElement('span')
      summary.className = 'content_summary'
      summary.append(`${words.slice(0, truncateAt).join(' ')}… `)

      const createToggle = (label, expanded, onClick) => {
        const toggle = document.createElement('button')
        toggle.className = 'content_toggle'
        toggle.type = 'button'
        toggle.textContent = label
        toggle.setAttribute('aria-expanded', String(expanded))
        toggle.setAttribute('aria-controls', fullContent.id)
        toggle.addEventListener('click', event => {
          event.stopPropagation()
          onClick()
        })
        return toggle
      }

      let showMore
      let showLess
      showMore = createToggle('show more', false, () => {
        summary.hidden = true
        fullContent.hidden = false
        showLess.focus()
      })
      showLess = createToggle('show less', true, () => {
        fullContent.hidden = true
        summary.hidden = false
        showMore.focus()
      })

      summary.append(showMore)
      const lastBlock = fullContent.lastElementChild
      const toggleContainer = lastBlock?.tagName === 'P' ? lastBlock : fullContent
      toggleContainer.append(' ', showLess)
      fullContent.hidden = true
      content.append(summary, fullContent)
    })
  }

  initPage() {
    document.querySelectorAll('[data-show-time]').forEach(target => this.updateShowInfo(target))
    document.querySelectorAll('.person_gallery > .with-bio, .person_gallery > .without-bio').forEach(target => this.shuffleChildren(target))
    this.bindContentToggles()
    this.bindTicketClicks()
    this.bindSocialClicks()
  }
}

window.page = new Page();
document.addEventListener('DOMContentLoaded', () => window.page.initPage());
