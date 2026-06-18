import axios from 'axios'
import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import { assertSafeUrl } from '../../lib/ssrfGuard.js'

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function fetchAndExtract(url) {
  await assertSafeUrl(url)

  let lastError
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(1000 * Math.pow(2, attempt - 1))
      }
      const response = await axios.get(url, {
        timeout: 10000,
        maxContentLength: 5000000,
        responseType: 'text',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Pursuit/1.0)' },
      })
      const dom = new JSDOM(response.data, { url })
      const reader = new Readability(dom.window.document)
      const article = reader.parse()
      if (article) {
        return { rawText: article.textContent.trim(), title: article.title }
      }
      // Fallback: strip HTML tags
      const rawText = response.data
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      return { rawText, title: dom.window.document.title || '' }
    } catch (e) {
      lastError = e
    }
  }
  throw lastError
}
