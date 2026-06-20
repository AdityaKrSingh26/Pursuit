import React from 'react'
import { renderToBuffer, Document, Page, View, Text } from '@react-pdf/renderer'

const SECTION_ORDER = ['EXPERIENCE', 'PROJECTS', 'SKILLS', 'EDUCATION']

export async function renderResumePdf(blocks, userInfo) {
  // Group blocks by section in defined order
  const grouped = {}
  for (const section of SECTION_ORDER) {
    grouped[section] = blocks.filter((b) => b.section?.toUpperCase() === section)
  }
  // Also collect any sections not in the defined order
  const otherSections = [...new Set(blocks.map((b) => b.section?.toUpperCase()))]
    .filter((s) => !SECTION_ORDER.includes(s))
  for (const s of otherSections) {
    grouped[s] = blocks.filter((b) => b.section?.toUpperCase() === s)
  }

  const allSections = [...SECTION_ORDER, ...otherSections].filter(
    (s) => grouped[s]?.length > 0
  )

  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      {
        size: 'A4',
        style: { padding: 40, fontFamily: 'Helvetica', fontSize: 11, color: '#222' }
      },
      React.createElement(
        View,
        { style: { marginBottom: 20, borderBottom: '1pt solid #ccc', paddingBottom: 8 } },
        React.createElement(
          Text,
          { style: { fontSize: 18, fontFamily: 'Helvetica-Bold' } },
          userInfo.email
        )
      ),
      ...allSections.map((section) =>
        React.createElement(
          View,
          { key: section, style: { marginBottom: 16 } },
          React.createElement(
            Text,
            {
              style: {
                fontSize: 12,
                fontFamily: 'Helvetica-Bold',
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 6,
                color: '#444',
              }
            },
            section
          ),
          ...grouped[section].map((block, i) =>
            React.createElement(
              View,
              { key: block.id ?? i, style: { marginBottom: 6 } },
              React.createElement(
                Text,
                { style: { lineHeight: 1.5 } },
                block.content
              ),
              block.skillTags?.length > 0
                ? React.createElement(
                    Text,
                    { style: { fontSize: 9, color: '#666', marginTop: 2 } },
                    block.skillTags.join(' · ')
                  )
                : null
            )
          )
        )
      )
    )
  )

  const buf = await renderToBuffer(doc)
  return Buffer.from(buf)
}

export async function renderResumePdfFallback(blocks, userInfo) {
  const { default: puppeteer } = await import('puppeteer')

  const SECTION_ORDER_FB = ['EXPERIENCE', 'PROJECTS', 'SKILLS', 'EDUCATION']
  const grouped = {}
  for (const s of SECTION_ORDER_FB) grouped[s] = []
  for (const b of blocks) {
    const s = b.section?.toUpperCase() ?? 'OTHER'
    if (!grouped[s]) grouped[s] = []
    grouped[s].push(b)
  }

  const sectionsHtml = Object.entries(grouped)
    .filter(([, bs]) => bs.length > 0)
    .map(
      ([section, bs]) => `
      <section>
        <h2>${section}</h2>
        ${bs.map((b) => `<p>${b.content}</p>${b.skillTags?.length ? `<small>${b.skillTags.join(' · ')}</small>` : ''}`).join('')}
      </section>`
    )
    .join('')

  const html = `<!DOCTYPE html><html><head><style>
    body { font-family: Helvetica, Arial, sans-serif; padding: 40px; font-size: 11pt; color: #222; }
    h1 { font-size: 18pt; border-bottom: 1px solid #ccc; padding-bottom: 8px; margin-bottom: 20px; }
    h2 { font-size: 12pt; text-transform: uppercase; letter-spacing: 1px; color: #444; margin: 16px 0 6px; }
    p { margin: 0 0 6px; line-height: 1.5; }
    small { font-size: 9pt; color: #666; }
  </style></head><body>
    <h1>${userInfo.email}</h1>
    ${sectionsHtml}
  </body></html>`

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({ format: 'A4' })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
