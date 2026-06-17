const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test, expect } = require('@playwright/test');

const appFile = path.resolve(__dirname, '..', '健美滷味_團購系統_優化版_修正版.html');
const appUrl = pathToFileURL(appFile).toString();

function collectPageIssues(page) {
  const issues = [];
  page.on('console', message => {
    if (message.type() === 'error') {
      const text = message.text();
      if (!text.includes('ERR_NETWORK_ACCESS_DENIED')) {
        issues.push(`console error: ${text}`);
      }
    }
  });
  page.on('pageerror', error => {
    issues.push(`page error: ${error.message}`);
  });
  return issues;
}

async function openOrderer(page) {
  await page.goto(appUrl);
  await expect(page.locator('#entry.active')).toBeVisible();
  await page.locator('#entry .et-btn').filter({ hasText: '訂購人' }).click();
  await expect(page.locator('#orderer.active')).toBeVisible();
  await expect(page.locator('#orderer.active #ordMenu .ordx-card').first()).toBeVisible();
}

async function productGridColumnCount(page) {
  return page.locator('#orderer.active #ordMenu').evaluate(element => {
    const columns = getComputedStyle(element).gridTemplateColumns.trim();
    return columns ? columns.split(/\s+/).length : 0;
  });
}

test.describe('訂購人頁面自動化驗證', () => {
  test('桌機寬度商品卡最多兩欄並可截圖', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    await openOrderer(page);

    await expect(page.locator('#orderer.active .ordx-shop')).toContainText('健美滷味');
    await expect(page.locator('#orderer.active #ordxCart')).toBeVisible();
    await expect(await productGridColumnCount(page)).toBeLessThanOrEqual(2);
    await page.screenshot({ path: testInfo.outputPath('orderer-desktop.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('手機寬度商品卡維持一欄且底部送出列可見', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await openOrderer(page);

    await expect(await productGridColumnCount(page)).toBe(1);
    await expect(page.locator('#ordPnav')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('orderer-mobile.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('訂購人可加入商品、開啟最後確認並送出成功', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openOrderer(page);

    await page.locator('#ordName').fill('自動測試訂購人');
    await page.locator('#orderer.active #ordMenu .ordx-card').first().click();
    await expect(page.locator('#ordCartN')).toHaveText('1');
    await expect(page.locator('#ocSubmit')).toBeEnabled();

    await page.locator('#ocSubmit').click();
    await expect(page.locator('#ordModal.show')).toBeVisible();
    await expect(page.getByText('最後確認你的訂單')).toBeVisible();
    await expect(page.locator('#cartList .cart-row')).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath('orderer-confirm.png'), fullPage: false });

    await page.locator('#ordModal .ord-submit').click();
    await expect(page.locator('#ordSuccess.show')).toBeVisible();
    await expect(page.locator('#osSummary')).toContainText('自動測試訂購人');
    await page.screenshot({ path: testInfo.outputPath('orderer-success.png'), fullPage: false });
    expect(issues).toEqual([]);
  });
});
