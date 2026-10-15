import * as yc from './yc.js'
import * as greenhouse from './greenhouse.js'
import * as lever from './lever.js'
import * as ashby from './ashby.js'
import * as remotive from './remotive.js'
import * as adzuna from './adzuna.js'
import * as arbeitnow from './arbeitnow.js'

// Wellfound (wellfound.js) is an HTML / __NEXT_DATA__ scrape with a Chrome UA
// and no official API. It is kept in the tree but not enabled.

export const GLOBAL_SOURCE_NAMES = ['yc', 'remotive', 'adzuna', 'arbeitnow']
export const COMPANY_KEYED_SOURCE_NAMES = ['greenhouse', 'lever', 'ashby']

export const GLOBAL_SOURCES = [yc, remotive, adzuna, arbeitnow]
export const COMPANY_KEYED_SOURCES = [greenhouse, lever, ashby]
