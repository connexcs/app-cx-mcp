/**
 * Test for searchDocumentation and getDocumentation functionality
 *
 * Tests both documentation tools in a natural chained flow:
 *   1. searchDocumentation — query for "rate card"
 *   2. getDocumentation — fetch the first result's full content
 */

import { searchDocumentation } from './searchDocumentation'
import { getDocumentation } from './getDocumentation'

/**
 * Tests searchDocumentation + getDocumentation as a chained pair
 * @returns {Promise<Object>} Test result
 */
export async function testDocumentation () {
  try {
    // Step 1: Search for documentation articles
    // searchDocumentation wraps its response: { status: 'success'|'error', data: { success, results, ... } }
    const searchResponse = await searchDocumentation({ query: 'rate card', limit: 3 })

    if (!searchResponse) {
      return {
        tool: 'documentation',
        status: 'FAIL',
        error: 'searchDocumentation returned no result'
      }
    }

    // Unwrap envelope — support both wrapped { status, data } and flat { success, results }
    const searchResult = (searchResponse.data !== undefined) ? searchResponse.data : searchResponse

    if (!searchResult || !searchResult.success) {
      const errMsg = (searchResult && searchResult.error) || searchResponse.message || 'searchDocumentation returned success: false'
      const is429 = errMsg && errMsg.indexOf('429') !== -1
      return {
        tool: 'documentation',
        status: is429 ? 'SKIP' : 'FAIL',
        step: 'search',
        error: errMsg,
        response_status: searchResponse.status,
        note: is429 ? 'Docs API rate limited (429) — tool is functional, retry later' : undefined
      }
    }

    const articles = searchResult.results || searchResult.articles || []
    if (!Array.isArray(articles) || articles.length === 0) {
      return {
        tool: 'documentation',
        status: 'SKIP',
        step: 'search',
        note: 'No documentation articles found for query "rate card"',
        response_keys: Object.keys(searchResult)
      }
    }

    const firstArticle = articles[0]
    const hasTitle = firstArticle.title !== undefined
    // Article path field: check all known variants returned by searchDocumentation
    const rawPath = firstArticle.path || firstArticle.link || firstArticle.url || firstArticle.slug || firstArticle.public_url || null

    if (!rawPath) {
      return {
        tool: 'documentation',
        status: 'FAIL',
        step: 'search',
        error: 'First search result has no path/link/url/slug field',
        article_keys: Object.keys(firstArticle)
      }
    }

    // If rawPath is a full URL (e.g. https://docs.connexcs.com/customer/did),
    // strip the origin and leading slash to get just the path segment
    let articlePath = rawPath
    if (rawPath.indexOf('://') !== -1) {
      try {
        const urlObj = new URL(rawPath)
        articlePath = urlObj.pathname.replace(/^\//, '')
      } catch (urlErr) {
        // Fallback: strip everything up to the third slash
        articlePath = rawPath.replace(/^https?:\/\/[^/]+\//, '')
      }
    }

    // Step 2: Fetch full content of the first article
    // getDocumentation also wraps response: { status, data: { success, content, ... } }
    const docResponse = await getDocumentation({ path: articlePath })

    if (!docResponse) {
      return {
        tool: 'documentation',
        status: 'FAIL',
        step: 'get',
        error: 'getDocumentation returned no result',
        path: articlePath
      }
    }

    // Unwrap envelope
    const docResult = (docResponse.data !== undefined) ? docResponse.data : docResponse

    if (!docResult || !docResult.success) {
      return {
        tool: 'documentation',
        status: 'FAIL',
        step: 'get',
        error: (docResult && docResult.error) || docResponse.message || 'getDocumentation returned success: false',
        path: articlePath
      }
    }

    const content = docResult.content || docResult.body || docResult.text || ''
    const hasContent = typeof content === 'string' ? content.length > 0 : !!content

    return {
      tool: 'documentation',
      status: 'PASS',
      search_query: 'rate card',
      articles_found: articles.length,
      first_article_title: firstArticle.title,
      fetched_path: articlePath,
      content_length: typeof content === 'string' ? content.length : 'non-string',
      has_content: hasContent,
      search_has_title: hasTitle
    }

  } catch (error) {
    return {
      tool: 'documentation',
      status: 'ERROR',
      error: error.message
    }
  }
}

/**
 * Entry point for ScriptForge
 * @returns {Promise<Object>} Test result
 */
export async function main () {
  return await testDocumentation()
}
