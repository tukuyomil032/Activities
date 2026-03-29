import { ActivityType, Assets } from 'premid'

const PresenceConstructor = (window as unknown as {
  Presence: new (presenceOptions: { clientId: string }) => any
}).Presence

const presence = new PresenceConstructor({
  clientId: '503557087041683458',
})

const activityStartTimestamp = Math.floor(Date.now() / 1000)
const activityLogo = 'https://imgsrc.dmm.com/dig/dmmtv/etc/apple-touch-icon/dmmtv.png'
const dmmTitleSuffixRegex = /\s*[|｜]\s*DMM TV.*$/u
const whitespaceRegex = /\s+/g
const episodeNumberRegex = /^(#\d+|S\d+E\d+|Episode\s*\d+|Ep\.?\s*\d+|第\s*\d+\s*話)/iu
const noiseIdentifierRegex = /^[a-z0-9]{16,}$/i
const titleSplitRegex = /\s*[|｜\-–—]\s*/u
const backgroundImageUrlRegex = /url\(["']?([^"')]+)["']?\)/i

async function getStrings() {
  return presence.getStrings(
    {
      play: 'general.playing',
      pause: 'general.paused',
      browsing: 'general.browsing',
      watching: 'general.watchingVid',
      buttonWatchVideo: 'general.buttonWatchVideo',
      buttonViewPage: 'general.buttonViewPage',
      viewSeries: 'general.buttonViewSeries',
    },
  )
}

let strings: Awaited<ReturnType<typeof getStrings>>
let oldLang: string | null = null

function cleanText(text: string | null | undefined): string | null {
  if (!text)
    return null

  const normalized = text
    .replace(whitespaceRegex, ' ')
    .replace(dmmTitleSuffixRegex, '')
    .trim()

  if (!normalized)
    return null

  if (
    normalized === 'DMM TV'
    || normalized.startsWith('非常識コスパ DMM TV')
    || normalized.includes('月額550円でアニメ')
  ) {
    return null
  }

  return normalized.slice(0, 128)
}

function truncateText(text: string, maxLength = 128): string {
  if (text.length <= maxLength)
    return text

  return `${text.slice(0, Math.max(0, maxLength - 1))}...`
}

function looksLikeEpisodeText(text: string): boolean {
  return episodeNumberRegex.test(text)
}

function looksLikeNoiseText(text: string): boolean {
  return noiseIdentifierRegex.test(text)
}

function fromSelectors(selectors: string[]): string | null {
  for (const selector of selectors) {
    const value = cleanText(
      document.querySelector<HTMLElement>(selector)?.textContent,
    )

    if (value)
      return value
  }

  return null
}

function getMetaContent(selector: string): string | null {
  const content = document.querySelector<HTMLMetaElement>(selector)?.content
  if (!content)
    return null

  const normalized = content.replace(/&amp;/g, '&').trim()
  return normalized.length > 0 ? normalized : null
}

function pickImageFromUnknown(value: unknown): string | null {
  if (!value)
    return null

  if (typeof value === 'string')
    return value

  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = pickImageFromUnknown(item)
      if (candidate)
        return candidate
    }
  }

  if (typeof value === 'object' && value !== null) {
    const objectValue = value as Record<string, unknown>
    return pickImageFromUnknown(objectValue.url ?? objectValue.contentUrl)
  }

  return null
}

function readStructuredData() {
  let seriesTitle: string | null = null
  let episodeSubtitle: string | null = null
  let episodeCover: string | null = null
  let seriesCover: string | null = null

  const scripts = document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')

  for (const script of scripts) {
    if (!script.textContent)
      continue

    let parsed: unknown
    try {
      parsed = JSON.parse(script.textContent)
    }
    catch {
      continue
    }

    const items = Array.isArray(parsed) ? parsed : [parsed]
    for (const item of items) {
      if (!item || typeof item !== 'object')
        continue

      const objectItem = item as Record<string, unknown>
      const itemType = String(objectItem['@type'] ?? '')
      const itemName = cleanText(typeof objectItem.name === 'string' ? objectItem.name : null)
      const itemImage = pickImageFromUnknown(objectItem.image)

      if (!episodeSubtitle && itemName && (itemType.includes('Episode') || looksLikeEpisodeText(itemName)))
        episodeSubtitle = itemName

      if (!seriesTitle && itemName && (itemType.includes('Series') || itemType.includes('TVSeries')))
        seriesTitle = itemName

      if (!episodeCover && itemImage && itemType.includes('Episode'))
        episodeCover = itemImage

      if (!seriesCover && itemImage && (itemType.includes('Series') || itemType.includes('TVSeries')))
        seriesCover = itemImage

      const partOfSeries = objectItem.partOfSeries as Record<string, unknown> | undefined
      if (partOfSeries) {
        const partSeriesName = cleanText(typeof partOfSeries.name === 'string' ? partOfSeries.name : null)
        if (!seriesTitle && partSeriesName)
          seriesTitle = partSeriesName

        const partSeriesImage = pickImageFromUnknown(partOfSeries.image)
        if (!seriesCover && partSeriesImage)
          seriesCover = partSeriesImage
      }

      if (!episodeCover && itemImage)
        episodeCover = itemImage
    }
  }

  return {
    seriesTitle,
    episodeSubtitle,
    episodeCover,
    seriesCover,
  }
}

function fromImageSelectors(selectors: string[]): string | null {
  for (const selector of selectors) {
    const element = document.querySelector<HTMLElement>(selector)
    if (!element)
      continue

    if (element instanceof HTMLImageElement && element.src)
      return element.src

    const sourceCandidate = element.getAttribute('src')
      || element.getAttribute('data-src')
      || element.getAttribute('data-lazy-src')
    if (sourceCandidate)
      return sourceCandidate

    const styleBackgroundImage = element.style.backgroundImage
    if (styleBackgroundImage) {
      const matchedUrl = styleBackgroundImage.match(backgroundImageUrlRegex)?.[1]
      if (matchedUrl)
        return matchedUrl
    }
  }

  return null
}

function getDocumentTitle(): string | null {
  return cleanText(document.title)
}

function parseTitleParts() {
  const rawTitle = getDocumentTitle()
  if (!rawTitle)
    return { seriesTitle: null, episodeSubtitle: null }

  const parts = rawTitle
    .split(titleSplitRegex)
    .map(part => cleanText(part))
    .filter((part): part is string => Boolean(part))
    .filter(part => !looksLikeNoiseText(part))

  const episodeSubtitle = parts.find(part => looksLikeEpisodeText(part)) ?? null
  const seriesTitle = parts.find(part => part !== episodeSubtitle) ?? null

  return { seriesTitle, episodeSubtitle }
}

function getSeriesTitle(structuredSeriesTitle: string | null): string | null {
  if (structuredSeriesTitle && !looksLikeNoiseText(structuredSeriesTitle))
    return structuredSeriesTitle

  const { seriesTitle } = parseTitleParts()
  const domCandidate = fromSelectors([
    '[href*="/vod/detail"] [class*="title"]',
    'a[href*="/vod/detail"] span',
    '[class*="series"] [class*="title"]',
    '[class*="Series"] [class*="Title"]',
    '[class*="program"] [class*="title"]',
    '[class*="TitleInfo"] [class*="Title"]',
    '[data-testid*="series"]',
    'main h1',
  ])

  if (domCandidate && !looksLikeEpisodeText(domCandidate) && !looksLikeNoiseText(domCandidate))
    return domCandidate

  return seriesTitle
}

function getEpisodeSubtitle(structuredEpisodeSubtitle: string | null): string | null {
  if (structuredEpisodeSubtitle && !looksLikeNoiseText(structuredEpisodeSubtitle))
    return structuredEpisodeSubtitle

  const { seriesTitle, episodeSubtitle } = parseTitleParts()
  const domCandidate = fromSelectors([
    '[href*="/vod/play"] [class*="title"]',
    '[href*="/vod/detail"] [class*="episode"]',
    '[class*="episode"] [class*="title"]',
    '[class*="Episode"] [class*="Title"]',
    '[class*="subtitle"]',
    'main h2',
    'main h1',
  ])

  if (domCandidate && !looksLikeNoiseText(domCandidate)) {
    if (looksLikeEpisodeText(domCandidate))
      return domCandidate

    if (episodeSubtitle && domCandidate !== seriesTitle)
      return domCandidate
  }

  return episodeSubtitle
}

function getRouteLabel(pathname: string): string | null {
  if (pathname.startsWith('/vod/detail'))
    return 'Title details'
  if (pathname.startsWith('/vod/play'))
    return 'Watching video'
  if (pathname.startsWith('/shorts/detail'))
    return 'Short details'
  if (pathname.startsWith('/vod/ranking'))
    return 'Ranking'
  if (pathname.startsWith('/vod/feature'))
    return 'Feature page'
  if (pathname.startsWith('/vod/search') || pathname.startsWith('/search'))
    return 'Search'
  if (pathname.startsWith('/my/item'))
    return 'My items'
  if (pathname.startsWith('/shorts'))
    return 'Shorts'
  if (pathname.startsWith('/vod') || pathname === '/')
    return 'Video catalog'

  return null
}

function getCoverImages(structuredEpisodeCover: string | null, structuredSeriesCover: string | null) {
  const episodeCover = structuredEpisodeCover
    ?? getMetaContent('meta[property="og:image"]')
    ?? fromImageSelectors([
      'a[href*="/vod/play"] img',
      'video + img',
      '[class*="episode"] img',
      '[class*="player"] img',
      'main img',
    ])

  const seriesCover = structuredSeriesCover
    ?? fromImageSelectors([
      'a[href*="/vod/detail"] img',
    '[class*="series"] img',
    '[class*="Series"] img',
    '[class*="poster"] img',
      '[class*="program"] img',
    '[class*="thumbnail"] img',
  ])
    ?? getMetaContent('meta[property="twitter:image"]')

  return {
    episodeCover,
    seriesCover,
  }
}

function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const remainingSeconds = safeSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

function buildProgressBar(currentTime: number, duration: number, segments = 10): string {
  if (!Number.isFinite(duration) || duration <= 0)
    return '[----------]'

  const ratio = Math.min(1, Math.max(0, currentTime / duration))
  const filledSegments = Math.round(ratio * segments)
  const emptySegments = Math.max(0, segments - filledSegments)

  return `[${'='.repeat(filledSegments)}${'-'.repeat(emptySegments)}]`
}

function buildProgressText(video: HTMLVideoElement): string {
  const current = Math.floor(video.currentTime)
  const duration = Math.floor(video.duration)
  const bar = buildProgressBar(current, duration)

  return truncateText(`${formatTime(current)} / ${formatTime(duration)} ${bar}`)
}

presence.on('UpdateData', async () => {
  const [lang, privacy, showTimestamp, showButtons, coverMode] = await Promise.all([
    presence.getSetting('lang').catch(() => 'en') as Promise<string>,
    presence.getSetting('privacy') as Promise<boolean>,
    presence.getSetting('timestamp') as Promise<boolean>,
    presence.getSetting('buttons') as Promise<boolean>,
    presence.getSetting('coverMode').catch(() => 0) as Promise<number>,
  ])

  if (oldLang !== lang || !strings) {
    oldLang = lang
    strings = await getStrings()
  }

  const { pathname, href } = document.location
  const routeLabel = getRouteLabel(pathname) ?? strings.browsing
  const structured = readStructuredData()
  const seriesTitle = getSeriesTitle(structured.seriesTitle) ?? 'DMM TV'
  const episodeSubtitle = getEpisodeSubtitle(structured.episodeSubtitle) ?? routeLabel
  const { episodeCover, seriesCover } = getCoverImages(structured.episodeCover, structured.seriesCover)
  const largeImageKey = coverMode === 1
    ? (seriesCover ?? episodeCover ?? activityLogo)
    : (episodeCover ?? seriesCover ?? activityLogo)

  const video = document.querySelector<HTMLVideoElement>('video')

  const presenceData: Record<string, unknown> = {
    type: ActivityType.Watching,
    largeImageKey,
    startTimestamp: activityStartTimestamp,
  }

  if (video && Number.isFinite(video.duration) && video.duration > 0) {
    if (privacy) {
      presenceData.details = strings.watching
    }
    else {
      presenceData.details = truncateText(seriesTitle)
      presenceData.state = truncateText(episodeSubtitle)
    }

    presenceData.smallImageKey = video.paused ? Assets.Pause : Assets.Play
    presenceData.smallImageText = video.paused ? strings.pause : strings.play

    if (!showTimestamp)
      delete presenceData.startTimestamp

    if (showButtons && !privacy) {
      presenceData.buttons = [
        {
          label: strings.buttonWatchVideo,
          url: href,
        },
      ]
    }

    if (!privacy) {
      const slideshow = presence.createSlideshow()
      slideshow.addSlide('episode', presenceData)

      const progressState = buildProgressText(video)
      if (progressState) {
        slideshow.addSlide('progress', {
          ...presenceData,
          state: progressState,
        })
      }

      return presence.setActivity(slideshow)
    }

    return presence.setActivity(presenceData)
  }

  presenceData.details = strings.browsing
  presenceData.startTimestamp = activityStartTimestamp
  presenceData.smallImageKey = Assets.Reading
  presenceData.smallImageText = strings.browsing

  if (!privacy) {
    presenceData.state = truncateText(routeLabel)

    if (
      showButtons
      && (pathname.startsWith('/vod/detail') || pathname.startsWith('/shorts/detail'))
    ) {
      presenceData.buttons = [
        {
          label: strings.buttonViewPage,
          url: href,
        },
        {
          label: strings.viewSeries,
          url: 'https://tv.dmm.com/vod/',
        },
      ]
    }
  }

  if (!showTimestamp)
    delete presenceData.startTimestamp

  return presence.setActivity(presenceData)
})
