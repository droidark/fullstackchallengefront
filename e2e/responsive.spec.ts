import { expect, test } from '@playwright/test'
import { assertNoBrowserMock, hasNoHorizontalOverflow, monitorRuntime } from './support/quoteFlow'

const viewports = [
  { width: 320, height: 800 },
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const

for (const viewport of viewports) {
  test(`Personal Information is bounded and understandable at ${String(viewport.width)}x${String(viewport.height)}`, async ({ page }) => {
    const runtimeIssues = monitorRuntime(page)
    await page.setViewportSize(viewport)
    await page.goto('/')
    await assertNoBrowserMock(page)

    await expect(page.getByRole('heading', { level: 1, name: 'Insurance quote' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Personal Information' })).toBeVisible()
    expect(await hasNoHorizontalOverflow(page)).toBe(true)

    const mainBox = await page.getByRole('main').boundingBox()
    const inputBox = await page.getByLabel(/^Email/).boundingBox()
    expect(mainBox).not.toBeNull()
    expect(inputBox).not.toBeNull()
    if (mainBox !== null) expect(mainBox.width).toBeLessThanOrEqual(viewport.width)
    if (inputBox !== null) {
      expect(inputBox.x).toBeGreaterThanOrEqual(0)
      expect(inputBox.x + inputBox.width).toBeLessThanOrEqual(viewport.width)
    }

    if (viewport.width < 600) {
      await expect(page.getByText('Step 1 of 3')).toBeVisible()
      await expect(page.getByRole('progressbar', { name: /Quote progress/ })).toBeVisible()
    } else {
      await expect(page.getByText('Step 1 of 3')).toBeHidden()
      await expect(page.getByText('Review and Submit')).toBeVisible()
    }
    expect(runtimeIssues).toEqual([])
  })
}
