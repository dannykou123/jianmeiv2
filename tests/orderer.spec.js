const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test, expect } = require('@playwright/test');

const projectRoot = path.resolve(__dirname, '..');
const appFileName = fs.readdirSync(projectRoot).find(name => name.endsWith('.html') && name !== 'index.html');

if (!appFileName) {
  throw new Error('Cannot find the legacy app HTML file.');
}

const appUrl = pathToFileURL(path.join(projectRoot, appFileName)).toString();

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

async function openApp(page) {
  await page.goto(appUrl);
  await expect(page.locator('#entry.active')).toBeVisible();
}

async function goScreen(page, screenId) {
  await page.evaluate(id => {
    if (typeof window.go === 'function') {
      window.go(id);
      return;
    }
    const button = document.querySelector(`button[onclick="go('${id}')"]`);
    if (button) button.click();
  }, screenId);
  await expect(page.locator(`#${screenId}.active`)).toBeVisible();
}

async function openOrderer(page) {
  await openApp(page);
  await goScreen(page, 'orderer');
  await expect(page.locator('#orderer.active #ordMenu .ordx-card').first()).toBeVisible();
}

async function openOrganizer(page) {
  await openApp(page);
  await goScreen(page, 'organizer');
  await expect(page.locator('#organizer.active #orgPeople')).toBeVisible();
}

async function openOrganizerDetail(page) {
  await goScreen(page, 'organizer');
  await page.locator('#teamList .tcard').first().click();
  await expect(page.locator('#organizer.active #orgDetailView')).toBeVisible();
  await expect(page.locator('#organizer.active #orgPeople .dept-group').first()).toBeVisible();
}

async function productGridColumnCount(page) {
  return page.locator('#orderer.active #ordMenu').evaluate(element => {
    const columns = getComputedStyle(element).gridTemplateColumns.trim();
    return columns ? columns.split(/\s+/).length : 0;
  });
}

async function addFirstProductAndSubmit(page, name) {
  await page.locator('#ordName').fill(name);
  await page.locator('#orderer.active #ordMenu .ordx-card').first().click();
  await expect(page.locator('#ordCartN')).toHaveText('1');
  await expect(page.locator('#ocSubmit')).toBeEnabled();
  await page.locator('#ocSubmit').click();
  await expect(page.locator('#ordModal.show')).toBeVisible();
  await expect(page.locator('#cartList .cart-row')).toHaveCount(1);
  await page.locator('#ordModal .ord-submit').click();
  await expect(page.locator('#ordSuccess.show')).toBeVisible();
}

test.describe('orderer page automation', () => {
  test('desktop product grid is tidy and product search is removed', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    await openOrderer(page);

    await expect(page.locator('#orderer.active .ordx-shop')).toBeVisible();
    await expect(page.locator('#orderer.active #ordxCart')).toBeVisible();
    await expect(page.locator('#orderer.active #ordSearch')).toHaveCount(0);
    await expect(await productGridColumnCount(page)).toBeLessThanOrEqual(2);
    const doesHeaderAvoidCart = await page.evaluate(() => {
      const fields = document.querySelector('#orderer.active .ordx-me')?.getBoundingClientRect();
      const cart = document.querySelector('#orderer.active #ordxCart')?.getBoundingClientRect();
      return !!fields && !!cart && fields.right <= cart.left - 12;
    });
    expect(doesHeaderAvoidCart).toBe(true);

    const categories = page.locator('#orderer.active #ordCats .ordx-cat');
    await expect(categories.first()).toBeVisible();
    if (await categories.count() > 1) {
      await categories.nth(1).click();
      await expect(categories.nth(1)).toHaveClass(/on/);
    }

    await page.screenshot({ path: testInfo.outputPath('orderer-desktop.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('empty desktop order summary stays compact while scrolling', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    await openOrderer(page);

    const height = await page.locator('#orderer.active #ordxCart').evaluate(element => element.getBoundingClientRect().height);
    expect(height).toBeLessThan(280);

    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(100);
    const top = await page.locator('#orderer.active #ordxCart').evaluate(element => element.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top).toBeLessThan(40);

    await page.screenshot({ path: testInfo.outputPath('orderer-empty-cart-scrolled.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('mobile product grid remains one column', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await openOrderer(page);

    await expect(await productGridColumnCount(page)).toBe(1);
    await expect(page.locator('#ordPnav')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('orderer-mobile.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('preset department order is grouped in organizer view', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openOrderer(page);

    await page.locator('#ordDept').selectOption('財務部');
    await addFirstProductAndSubmit(page, '測試財務訂購人');
    await openOrganizerDetail(page);

    const group = page.locator('.dept-group[data-dept="財務部"]');
    await expect(group).toBeVisible();
    await expect(group.locator('.person-nm', { hasText: '測試財務訂購人' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('organizer-preset-dept.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('custom department order is grouped in organizer view', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openOrderer(page);

    await page.locator('#ordDept').selectOption('__other__');
    await expect(page.locator('#ordDeptCustom')).toBeVisible();
    await page.locator('#ordDeptCustom').fill('設計部');
    await addFirstProductAndSubmit(page, '測試設計訂購人');
    await openOrganizerDetail(page);

    const group = page.locator('.dept-group[data-dept="設計部"]');
    await expect(group).toBeVisible();
    await expect(group.locator('.person-nm', { hasText: '測試設計訂購人' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('organizer-custom-dept.png'), fullPage: false });
    expect(issues).toEqual([]);
  });
});
