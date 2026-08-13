import { afterEach, describe, expect, it } from 'vitest'
import { loadConfigFromFile } from 'vite'

const originalGitHubPages = process.env.GITHUB_PAGES

afterEach(() => {
  if (originalGitHubPages === undefined) {
    delete process.env.GITHUB_PAGES
  } else {
    process.env.GITHUB_PAGES = originalGitHubPages
  }
})

describe('production deployment', () => {
  it('builds assets for the custom-domain root', async () => {
    process.env.GITHUB_PAGES = 'true'

    const loaded = await loadConfigFromFile(
      { command: 'build', mode: 'production' },
      new URL('../../../vite.config.ts', import.meta.url).pathname,
    )

    expect(loaded?.config.base).toBe('/')
  })
})
