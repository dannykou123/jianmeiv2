const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test, expect } = require('@playwright/test');

const projectRoot = path.resolve(__dirname, '..');
const appFileName = fs.readdirSync(projectRoot).find(name => name.endsWith('.html') && name !== 'index.html') || 'index.html';

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

async function openOrganizerList(page) {
  await openApp(page);
  await goScreen(page, 'organizer');
  await expect(page.locator('#organizer.active #teamList .tcard').first()).toBeVisible();
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

async function expectReachableControls(page, roots, options = {}) {
  const issues = await page.evaluate(({ roots, minSize }) => {
    const controlSelector = 'button:not([disabled]),a[href],[role="button"],[onclick]';
    const rootElements = roots
      .flatMap(selector => Array.from(document.querySelectorAll(selector)))
      .filter(Boolean);
    const controls = Array.from(new Set(rootElements.flatMap(root => Array.from(root.querySelectorAll(controlSelector)))));

    function isActuallyVisible(element) {
      if (element.tagName === 'BUTTON' && element.disabled) return false;
      if (element.hidden || element.closest('[hidden]')) return false;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const rect = element.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return false;
      if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= innerWidth || rect.top >= innerHeight) return false;
      return true;
    }

    function label(element) {
      if (!element) return 'nothing';
      if (element.id) return `#${element.id}`;
      const cls = element.className && typeof element.className === 'string'
        ? `.${element.className.trim().split(/\s+/).slice(0, 2).join('.')}`
        : element.tagName.toLowerCase();
      const text = (element.textContent || element.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
      return `${cls}${text ? ` "${text.slice(0, 28)}"` : ''}`;
    }

    return controls.flatMap(element => {
      if (!isActuallyVisible(element)) return [];
      const rect = element.getBoundingClientRect();
      const cx = Math.min(Math.max(rect.left + rect.width / 2, 1), innerWidth - 1);
      const cy = Math.min(Math.max(rect.top + rect.height / 2, 1), innerHeight - 1);
      const top = document.elementFromPoint(cx, cy);
      const topControl = top && top.closest ? top.closest(controlSelector) : null;
      const fixedBottomBlocker = top && top.closest ? top.closest('#orgPnav,#orgFoot') : null;
      const inModal = !!element.closest('.ord-modal,.date-modal,.set-modal,.style-modal,.theme-pick-modal,.status-modal');
      if (fixedBottomBlocker && !fixedBottomBlocker.contains(element) && !inModal) return [];
      const covered = !(top && (element === top || element.contains(top) || topControl === element));
      const tooSmall = rect.width < minSize || rect.height < minSize;
      const reasons = [];
      if (covered) reasons.push(`covered by ${label(top)}`);
      if (tooSmall) reasons.push(`small ${Math.round(rect.width)}x${Math.round(rect.height)}`);
      return reasons.length ? [`${label(element)}: ${reasons.join(', ')}`] : [];
    });
  }, { roots, minSize: options.minSize || 28 });

  expect(issues).toEqual([]);
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
    const doFieldsAlignWithProductColumns = await page.evaluate(() => {
      const nameField = document.querySelector('#orderer.active #ordName')?.getBoundingClientRect();
      const deptField = document.querySelector('#orderer.active #ordDept')?.getBoundingClientRect();
      const productCards = Array.from(document.querySelectorAll('#orderer.active #ordMenu .ordx-card'))
        .slice(0, 2)
        .map(element => element.getBoundingClientRect());
      const isClose = (actual, expected) => Math.abs(actual - expected) <= 2;

      if (!nameField || !deptField || productCards.length < 2) return false;

      return (
        isClose(nameField.left, productCards[0].left) &&
        isClose(nameField.right, productCards[0].right) &&
        isClose(deptField.left, productCards[1].left) &&
        isClose(deptField.right, productCards[1].right)
      );
    });
    expect(doFieldsAlignWithProductColumns).toBe(true);

    const categories = page.locator('#orderer.active #ordCats .ordx-cat');
    await expect(categories.first()).toBeVisible();
    if (await categories.count() > 1) {
      await categories.nth(1).click();
      await expect(categories.nth(1)).toHaveClass(/on/);
    }

    await page.screenshot({ path: testInfo.outputPath('orderer-desktop.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('desktop order summary floats at bottom right without covering products', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    await openOrderer(page);

    const height = await page.locator('#orderer.active #ordxCart').evaluate(element => element.getBoundingClientRect().height);
    expect(height).toBeLessThan(280);

    const cartBottomRight = await page.locator('#orderer.active #ordxCart').evaluate(element => {
      const cart = element.getBoundingClientRect();
      const productArea = document.querySelector('#orderer.active .ordx-pick')?.getBoundingClientRect();
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      if (!productArea) return { isBottomRight: false, avoidsProducts: false };
      return {
        isBottomRight: (
          Math.abs(viewport.height - cart.bottom - 16) <= 2 &&
          viewport.width - cart.right >= 12
        ),
        avoidsProducts: cart.left >= productArea.right + 12
      };
    });
    expect(cartBottomRight.isBottomRight).toBe(true);
    expect(cartBottomRight.avoidsProducts).toBe(true);

    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(100);
    const scrolledCartState = await page.locator('#orderer.active #ordxCart').evaluate(element => {
      const cart = element.getBoundingClientRect();
      const productArea = document.querySelector('#orderer.active .ordx-pick')?.getBoundingClientRect();
      if (!productArea) return { bottomGap: -1, avoidsProducts: false };
      return {
        bottomGap: Math.round(window.innerHeight - cart.bottom),
        avoidsProducts: cart.left >= productArea.right + 12
      };
    });
    expect(scrolledCartState.bottomGap).toBe(16);
    expect(scrolledCartState.avoidsProducts).toBe(true);

    await page.locator('#orderer.active #ordMenu .ordx-card').first().click();
    await expect(page.locator('#ordCartN')).toHaveText('1');
    await expect(page.locator('#orderer.active #ordCartMini')).toBeVisible();
    await expect(page.locator('#orderer.active #ocSubmit')).toBeVisible();
    const populatedCartState = await page.locator('#orderer.active #ordxCart').evaluate(element => {
      const cart = element.getBoundingClientRect();
      const submit = document.querySelector('#orderer.active #ocSubmit')?.getBoundingClientRect();
      return {
        bottomGap: Math.round(window.innerHeight - cart.bottom),
        submitInsideCart: !!submit && submit.bottom <= cart.bottom && submit.top >= cart.top
      };
    });
    expect(populatedCartState.bottomGap).toBe(16);
    expect(populatedCartState.submitInsideCart).toBe(true);

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

  test('store mobile nav badges sit on the top right of their icons', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await openApp(page);
    await goScreen(page, 'admin');
    await expect(page.locator('#admin.active #mTabbar')).toBeVisible();
    await page.evaluate(() => {
      window.eval(`
        if(!MESSAGES._general) MESSAGES._general=[];
        MESSAGES._general.push({from:'org',text:'測試未讀',ts:Date.now(),_seen:false});
        refreshChatBadges();
      `);
    });
    await expect(page.locator('#dashNavBadgeM')).toBeVisible();
    await expect(page.locator('#mChatBadge')).toBeVisible();

    const placements = await page.evaluate(() => {
      function check(tabSelector, badgeSelector) {
        const tab = document.querySelector(tabSelector);
        const icon = tab?.querySelector('.ico');
        const label = tab?.querySelector('.m-tab-label');
        const badge = document.querySelector(badgeSelector);
        const ir = icon?.getBoundingClientRect();
        const lr = label?.getBoundingClientRect();
        const br = badge?.getBoundingClientRect();
        return {
          badgeRightOfIcon: !!ir && !!br && br.left >= ir.left + ir.width * 0.52,
          badgeAtIconTop: !!ir && !!br && br.top <= ir.top + ir.height * 0.35,
          badgeAboveLabel: !!lr && !!br && br.bottom < lr.top,
        };
      }
      return {
        orders: check('#mTabbar .m-tab[data-go="dashboard"]', '#dashNavBadgeM'),
        chat: check('#mTabbar .m-tab[data-go="chat"]', '#mChatBadge'),
      };
    });

    expect(placements.orders).toEqual({
      badgeRightOfIcon: true,
      badgeAtIconTop: true,
      badgeAboveLabel: true,
    });
    expect(placements.chat).toEqual({
      badgeRightOfIcon: true,
      badgeAtIconTop: true,
      badgeAboveLabel: true,
    });

    await page.screenshot({ path: testInfo.outputPath('store-mobile-nav-badges.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('store chat shows unread counts per room and clears only the opened room', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 1024, height: 768 });

    await openApp(page);
    await goScreen(page, 'admin');
    const roomIds = await page.evaluate(() => {
      window.eval(`
        const now = Date.now();
        Object.values(MESSAGES).forEach(list => list.forEach(message => { message._seen = true; }));
        MESSAGES.qa_store_a = [
          {from:'org', text:'QA A first unread', ts: now - 2000, _seen:false},
          {from:'org', text:'QA A second unread', ts: now - 1000, _seen:false}
        ];
        MESSAGES.qa_store_b = [
          {from:'org', text:'QA B unread', ts: now - 500, _seen:false}
        ];
        chatRoomId = '_general';
        switchView('chat');
        renderChatList();
        refreshChatBadges();
      `);
      return ['qa_store_a', 'qa_store_b'];
    });

    const roomA = page.locator(`.cr-item[onclick="selectChatRoom('${roomIds[0]}')"]`);
    const roomB = page.locator(`.cr-item[onclick="selectChatRoom('${roomIds[1]}')"]`);
    await expect(roomA.locator('.cri-badge')).toHaveText('2');
    await expect(roomB.locator('.cri-badge')).toHaveText('1');
    await expect(page.locator('#chatNavBadge')).toHaveText('3');

    await roomB.click();
    await expect(roomB.locator('.cri-badge')).toHaveCount(0);
    await expect(roomA.locator('.cri-badge')).toHaveText('2');
    await expect(page.locator('#chatNavBadge')).toHaveText('2');

    await page.screenshot({ path: testInfo.outputPath('store-chat-room-unread.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('organizer chat tabs keep separate unread counts by team', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await openOrganizerList(page);
    const ids = await page.evaluate(() => {
      const first = TEAMS[0].id;
      const second = TEAMS[1].id;
      const now = Date.now();
      Object.values(MESSAGES).forEach(list => list.forEach(message => { message._seen = true; }));
      MESSAGES[first] = [
        {from:'shop', text:'QA first team unread', ts: now - 2000, _seen:false},
        {from:'shop', text:'QA first team unread again', ts: now - 1000, _seen:false}
      ];
      MESSAGES[second] = [
        {from:'shop', text:'QA second team unread', ts: now - 500, _seen:false}
      ];
      refreshChatBadges();
      return { first, second };
    });

    await page.locator('#orgTabChat').click();
    await expect(page.locator('#orgChat.open')).toBeVisible();
    const firstTab = page.locator(`#ocTabs .oc-tab[onclick="selectOcTeam('${ids.first}')"]`);
    const secondTab = page.locator(`#ocTabs .oc-tab[onclick="selectOcTeam('${ids.second}')"]`);
    await expect(firstTab.locator('.oc-tab-badge')).toHaveText('2');
    await expect(secondTab.locator('.oc-tab-badge')).toHaveText('1');
    await expect(page.locator('#orgNavChatBadge')).toHaveText('3');

    await secondTab.click();
    await expect(secondTab.locator('.oc-tab-badge')).toHaveCount(0);
    await expect(firstTab.locator('.oc-tab-badge')).toHaveText('2');
    await expect(page.locator('#orgNavChatBadge')).toHaveText('2');

    await page.screenshot({ path: testInfo.outputPath('organizer-chat-tab-unread.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('chat read receipts and shop activity are visible to organizer', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await openOrganizerList(page);
    const teamId = await page.evaluate(() => {
      const id = TEAMS[0].id;
      MESSAGES[id] = [];
      window.openOrgChat(id);
      return id;
    });
    await expect(page.locator('#orgChat.open')).toBeVisible();
    await page.locator('#ocInput').fill('QA read receipt check');
    await page.locator('#orgChat .oc-foot .cd-send').click();
    await expect(page.locator('#ocBody .chat-msg.me').last().locator('.cm-read')).toHaveText('未讀');

    await goScreen(page, 'admin');
    await page.evaluate(id => {
      switchView('chat');
      selectChatRoom(id);
    }, teamId);
    await expect(page.locator('#crBody')).toContainText('QA read receipt check');

    await goScreen(page, 'organizer');
    await page.evaluate(id => window.openOrgChat(id), teamId);
    await expect(page.locator('#ocBody .chat-msg.me').last().locator('.cm-read')).toHaveText('已讀');
    await expect(page.locator('#ocSub')).toContainText('店家剛剛在線');

    await page.screenshot({ path: testInfo.outputPath('organizer-chat-read-and-presence.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('organizer laptop opens chat as drawer and keeps modals above it', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 1024, height: 768 });

    await openOrganizerList(page);

    const initialLayout = await page.evaluate(() => {
      const chat = document.querySelector('#orgChat');
      const list = document.querySelector('#organizer.active #orgListView');
      const pnav = document.querySelector('#organizer.active #orgPnav');
      if (!chat || !list || !pnav) return { chatHidden: false, listFits: false, pnavVisible: false };
      const chatRect = chat.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      const pnavRect = pnav.getBoundingClientRect();
      return {
        chatHidden: getComputedStyle(chat).display === 'none' || chatRect.width === 0,
        listFits: listRect.right <= window.innerWidth,
        pnavVisible: getComputedStyle(pnav).display !== 'none' && pnavRect.height > 0
      };
    });
    expect(initialLayout.chatHidden).toBe(true);
    expect(initialLayout.listFits).toBe(true);
    expect(initialLayout.pnavVisible).toBe(true);

    await page.locator('#orgTabChat').click();
    await expect(page.locator('#orgChat.open')).toBeVisible();
    await expect(page.locator('#orgChat .oc-x')).toBeVisible();
    const drawerLayout = await page.locator('#orgChat').evaluate(element => {
      const rect = element.getBoundingClientRect();
      return {
        rightAligned: Math.abs(window.innerWidth - rect.right) <= 2,
        drawerWidth: Math.round(rect.width),
        notFullscreen: rect.width < window.innerWidth
      };
    });
    expect(drawerLayout.rightAligned).toBe(true);
    expect(drawerLayout.drawerWidth).toBeGreaterThanOrEqual(360);
    expect(drawerLayout.notFullscreen).toBe(true);

    await page.locator('#orgChat .oc-x').click();
    await expect(page.locator('#orgChat.open')).toHaveCount(0);

    await page.locator('#teamList .tcard').first().click();
    await expect(page.locator('#organizer.active #orgDetailView')).toBeVisible();
    await page.locator('#orgTabChat').click();
    await expect(page.locator('#orgChat.open')).toBeVisible();
    await page.evaluate(() => window.openLineShare());
    await expect(page.locator('#lineModal.show')).toBeVisible();
    const modalLayer = await page.evaluate(() => {
      const modal = document.querySelector('#lineModal');
      const chat = document.querySelector('#orgChat');
      const box = modal?.querySelector('.date-box');
      if (!modal || !chat || !box) return { modalAboveChat: false, modalNotCovered: false };
      const chatRect = chat.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      const overlapLeft = Math.max(chatRect.left, boxRect.left);
      const overlapRight = Math.min(chatRect.right, boxRect.right);
      const overlapTop = Math.max(chatRect.top, boxRect.top);
      const overlapBottom = Math.min(chatRect.bottom, boxRect.bottom);
      const hasOverlap = overlapLeft < overlapRight && overlapTop < overlapBottom;
      let modalNotCovered = true;
      if (hasOverlap) {
        const topElement = document.elementFromPoint(overlapLeft + 8, overlapTop + 8);
        modalNotCovered = !!topElement && modal.contains(topElement);
      }
      return {
        modalAboveChat: Number(getComputedStyle(modal).zIndex) > Number(getComputedStyle(chat).zIndex),
        modalNotCovered
      };
    });
    expect(modalLayer.modalAboveChat).toBe(true);
    expect(modalLayer.modalNotCovered).toBe(true);

    await page.screenshot({ path: testInfo.outputPath('organizer-laptop-chat-drawer.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('organizer desktop keeps chat docked beside team list', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    await openOrganizerList(page);

    const desktopLayout = await page.evaluate(() => {
      const chat = document.querySelector('#orgChat');
      const list = document.querySelector('#organizer.active #orgListView');
      const headChat = document.querySelector('#organizer.active .org-head-chat');
      if (!chat || !list) return { chatDocked: false, listAvoidsChat: false, headChatRemoved: false };
      const chatRect = chat.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      return {
        chatDocked: getComputedStyle(chat).display !== 'none' && Math.abs(window.innerWidth - chatRect.right) <= 2,
        listAvoidsChat: listRect.right <= chatRect.left - 12,
        headChatRemoved: !headChat
      };
    });
    expect(desktopLayout.chatDocked).toBe(true);
    expect(desktopLayout.listAvoidsChat).toBe(true);
    expect(desktopLayout.headChatRemoved).toBe(true);

    await page.screenshot({ path: testInfo.outputPath('organizer-desktop-docked-chat.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('organizer mobile chat keeps bottom navigation available', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await openOrganizerList(page);

    await expect(page.locator('#orgPnav')).toBeVisible();
    await expect(page.locator('#orgChat')).toBeHidden();
    await page.locator('#orgTabChat').click();
    await expect(page.locator('#orgChat.open')).toBeVisible();
    await expect(page.locator('#orgChat .oc-x')).toBeVisible();
    const mobileChat = await page.locator('#orgChat').evaluate(element => {
      const rect = element.getBoundingClientRect();
      const nav = document.querySelector('#orgPnav')?.getBoundingClientRect();
      const foot = element.querySelector('.oc-foot')?.getBoundingClientRect();
      const navCenter = nav ? document.elementFromPoint(nav.left + nav.width / 2, nav.top + nav.height / 2) : null;
      return {
        fillsWidth: Math.abs(rect.width - window.innerWidth) <= 2,
        leavesNavVisible: !!nav && rect.bottom <= nav.top + 1,
        inputAboveNav: !!nav && !!foot && foot.bottom <= nav.top + 1,
        navOnTop: !!navCenter && !!nav && !!document.querySelector('#orgPnav')?.contains(navCenter)
      };
    });
    expect(mobileChat.fillsWidth).toBe(true);
    expect(mobileChat.leavesNavVisible).toBe(true);
    expect(mobileChat.inputAboveNav).toBe(true);
    expect(mobileChat.navOnTop).toBe(true);

    await page.locator('#orgTabList').click();
    await expect(page.locator('#orgChat.open')).toHaveCount(0);
    await expect(page.locator('#organizer.active #orgListView')).toBeVisible();

    await page.screenshot({ path: testInfo.outputPath('organizer-mobile-chat.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('organizer tablet portrait uses full-page chat and returns to current team', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 768, height: 1024 });

    await openApp(page);
    await openOrganizerDetail(page);
    const teamTitle = (await page.locator('#orgTitle').innerText()).trim();

    await expect(page.locator('#orgPnav')).toBeVisible();
    await page.locator('#orgTabChat').click();
    await expect(page.locator('#orgChat.open')).toBeVisible();
    const tabletChat = await page.locator('#orgChat').evaluate(element => {
      const rect = element.getBoundingClientRect();
      const nav = document.querySelector('#orgPnav')?.getBoundingClientRect();
      const navCenter = nav ? document.elementFromPoint(nav.left + nav.width / 2, nav.top + nav.height / 2) : null;
      const cta = document.querySelector('#orgPnavCta');
      return {
        fillsWidth: Math.abs(rect.left) <= 2 && Math.abs(rect.width - window.innerWidth) <= 2,
        leavesNavVisible: !!nav && rect.bottom <= nav.top + 1,
        navOnTop: !!navCenter && !!document.querySelector('#orgPnav')?.contains(navCenter),
        ctaHidden: !!cta && getComputedStyle(cta).display === 'none',
        drawerHalfSplit: rect.width < window.innerWidth * 0.96,
      };
    });
    expect(tabletChat.fillsWidth).toBe(true);
    expect(tabletChat.leavesNavVisible).toBe(true);
    expect(tabletChat.navOnTop).toBe(true);
    expect(tabletChat.ctaHidden).toBe(true);
    expect(tabletChat.drawerHalfSplit).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('organizer-tablet-portrait-chat-open.png'), fullPage: false });

    await page.locator('#orgTabList').click();
    await expect(page.locator('#orgChat.open')).toHaveCount(0);
    await expect(page.locator('#organizer.active #orgDetailView')).toBeVisible();
    await expect(page.locator('#organizer.active #orgListView')).toBeHidden();
    await expect(page.locator('#orgTitle')).toHaveText(teamTitle);

    await page.screenshot({ path: testInfo.outputPath('organizer-tablet-portrait-full-chat.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('organizer profile panel is responsive and excludes identity switching', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await openApp(page);
    await openOrganizerDetail(page);

    await expect(page.locator('#orgProfileBtn')).toBeVisible();
    await expect(page.locator('#orgPnavCta')).toBeHidden();
    await page.locator('#orgProfileBtn').click();
    await expect(page.locator('#orgProfilePanel.show')).toBeVisible();
    await expect(page.locator('#orgProfilePanel')).toContainText('團主資訊');
    await expect(page.locator('#orgProfilePanel')).toContainText('團主代碼');
    await expect(page.locator('#organizer.active .org-head-chat')).toHaveCount(0);
    await expect(page.locator('#orgProfilePanel')).not.toContainText('通知設定');
    await expect(page.locator('#orgProfilePanel')).not.toContainText('切換身份');
    await expect(page.locator('#orgProfilePanel')).not.toContainText('登出');

    const mobilePanel = await page.locator('#orgProfileSheet').evaluate(element => {
      const rect = element.getBoundingClientRect();
      return {
        bottomSheet: Math.abs(window.innerHeight - rect.bottom) <= 2,
        nearFullWidth: rect.width >= window.innerWidth - 4,
        notDesktopPopover: rect.top > window.innerHeight * 0.35,
      };
    });
    expect(mobilePanel.bottomSheet).toBe(true);
    expect(mobilePanel.nearFullWidth).toBe(true);
    expect(mobilePanel.notDesktopPopover).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('organizer-profile-mobile-sheet.png'), fullPage: false });

    await page.locator('#orgProfileClose').click();
    await expect(page.locator('#orgProfilePanel.show')).toHaveCount(0);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(100);
    await page.locator('#orgProfileBtn').click();
    await expect(page.locator('#orgProfilePanel.show')).toBeVisible();
    const desktopPanel = await page.locator('#orgProfileSheet').evaluate(element => {
      const rect = element.getBoundingClientRect();
      return {
        popoverWidth: rect.width <= 440,
        nearTop: rect.top <= 120,
        nearRight: window.innerWidth - rect.right <= 28,
        notBottomSheet: window.innerHeight - rect.bottom > 80,
      };
    });
    expect(desktopPanel.popoverWidth).toBe(true);
    expect(desktopPanel.nearTop).toBe(true);
    expect(desktopPanel.nearRight).toBe(true);
    expect(desktopPanel.notBottomSheet).toBe(true);

    await page.screenshot({ path: testInfo.outputPath('organizer-profile-desktop-popover.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('organizer profile edits contact defaults and applies them to new teams', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await openOrganizerList(page);
    await page.evaluate(() => {
      localStorage.removeItem('jm_org_profile');
      if (typeof window.setMaxTeams === 'function') window.setMaxTeams(9);
    });

    await page.locator('#orgProfileBtn').click();
    await expect(page.locator('#orgProfilePanel.show')).toBeVisible();
    await page.locator('#orgProfileBasicToggle').click();
    await expect(page.locator('#orgProfileBasicFields')).toBeVisible();
    await expect(page.locator('#orgProfileCompanyInput')).toHaveCount(0);
    await expect(page.locator('#orgDefaultContactName')).toHaveCount(0);
    await expect(page.locator('#orgProfileBasicFields')).not.toContainText('顯示身分');
    await expect(page.locator('#orgProfileBasicFields')).not.toContainText('預設聯絡人');
    await page.locator('#orgProfileNameInput').fill('林小美');
    await page.locator('#orgDefaultAddress').fill('台北市南港區測試路 88 號');
    await page.locator('#orgDefaultContactPhone').fill('0912-345-678');
    await page.locator('#orgProfileBasicSave').click();
    await page.locator('#orgProfileClose').click();

    await page.locator('#orgProfileBtn').click();
    await expect(page.locator('#orgProfileName')).toContainText('林小美');
    await expect(page.locator('#orgProfileName')).not.toContainText('健美南港團主');
    await page.locator('#orgProfileBasicToggle').click();
    await expect(page.locator('#orgDefaultAddress')).toHaveValue('台北市南港區測試路 88 號');
    await page.locator('#orgProfileClose').click();

    await page.evaluate(() => window.openNewTeam());
    await expect(page.locator('#newTeamModal.show')).toBeVisible();
    await expect(page.locator('#ntAddress')).toHaveValue('台北市南港區測試路 88 號');
    await expect(page.locator('#ntContactName')).toHaveValue('林小美');
    await expect(page.locator('#ntContactPhone')).toHaveValue('0912-345-678');
    await page.locator('#ntAddress').fill('');
    await page.locator('#ntContactName').fill('');
    await page.locator('#ntContactPhone').fill('');
    await page.locator('#ntName').fill('可空白聯絡資料測試團');
    await page.evaluate(() => window.createTeam());
    await expect(page.locator('#newTeamModal.show')).toHaveCount(0);

    const createdTeam = await page.evaluate(() => TEAMS?.[0] || null);
    expect(createdTeam).toMatchObject({
      name: '可空白聯絡資料測試團',
      address: '',
      contactName: '',
      contactPhone: '',
    });

    await page.screenshot({ path: testInfo.outputPath('organizer-profile-contact-defaults.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('organizer profile theme is shared with orderer and does not change store theme', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 1024, height: 768 });

    await openOrganizerList(page);
    await page.evaluate(() => {
      localStorage.setItem('jm_theme_all', 'truffle');
      localStorage.removeItem('jm_theme_org_personal');
      localStorage.removeItem('jm_theme_buyer_personal');
      if (typeof window.applyScreenTheme === 'function') window.applyScreenTheme();
    });

    await page.locator('#orgProfileBtn').click();
    await page.locator('#orgProfileThemeToggle').click();
    await expect(page.locator('#orgProfileThemeFields')).toBeVisible();
    await page.locator('[data-org-theme="mint"]').click();

    const organizerTheme = await page.evaluate(() => ({
      global: localStorage.getItem('jm_theme_all'),
      org: localStorage.getItem('jm_theme_org_personal'),
      buyer: localStorage.getItem('jm_theme_buyer_personal'),
      bodyHasMint: document.body.classList.contains('ct-mint'),
    }));
    expect(organizerTheme).toEqual({
      global: 'truffle',
      org: 'mint',
      buyer: 'mint',
      bodyHasMint: true,
    });

    await page.locator('#orgProfileClose').click();
    await goScreen(page, 'orderer');
    await expect(page.locator('#orderer.active')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.classList.contains('ct-mint'))).toBe(true);

    await goScreen(page, 'admin');
    await expect(page.locator('#admin.active')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.classList.contains('ct-truffle'))).toBe(true);

    await page.screenshot({ path: testInfo.outputPath('organizer-shared-theme.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('organizer profile default payment applies to new teams without overwriting the profile', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await openOrganizerList(page);
    await page.evaluate(() => {
      localStorage.removeItem('jm_org_profile');
      if (typeof window.setMaxTeams === 'function') window.setMaxTeams(9);
    });

    await page.locator('#orgProfileBtn').click();
    await expect(page.locator('#orgProfilePanel.show')).toBeVisible();
    await page.locator('#orgProfilePayToggle').click();
    await expect(page.locator('#orgProfilePayFields')).toBeVisible();
    await expect(page.locator('#orgDefaultCash .pay-switch-dot')).toHaveCount(1);
    const profileCashSwitch = await page.locator('#orgDefaultCash').evaluate(element => {
      const dot = element.querySelector('.pay-switch-dot');
      const rect = element.getBoundingClientRect();
      const dotRect = dot?.getBoundingClientRect();
      const style = getComputedStyle(element);
      const dotStyle = dot ? getComputedStyle(dot) : null;
      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        hasGreenOnState: style.backgroundColor !== getComputedStyle(document.documentElement).getPropertyValue('--bg-0').trim(),
        dotIsRound: !!dotRect && Math.round(dotRect.width) === 20 && Math.round(dotRect.height) === 20 && dotStyle?.borderRadius === '50%',
        dotOnRight: !!dotRect && dotRect.left > rect.left + rect.width / 2 - 2,
      };
    });
    expect(profileCashSwitch).toEqual({
      width: 44,
      height: 26,
      hasGreenOnState: true,
      dotIsRound: true,
      dotOnRight: true,
    });
    await page.locator('#orgDefaultLineId').fill('org_default_tw');
    await page.locator('#orgDefaultBankCode').fill('013');
    await page.locator('#orgDefaultBankAcct').fill('9999-0000');
    await page.locator('#orgDefaultPaySave').click();
    await page.locator('#orgProfileClose').click();

    await page.evaluate(() => window.openNewTeam());
    await expect(page.locator('#newTeamModal.show')).toBeVisible();
    await page.locator('#ntName').fill('預設付款測試團');
    await page.evaluate(() => window.createTeam());
    await expect(page.locator('#newTeamModal.show')).toHaveCount(0);

    await page.locator('#teamList .tcard').first().click();
    await expect(page.locator('#organizer.active #orgDetailView')).toBeVisible();
    await page.locator('#orgActionPay').click();
    await page.locator('#orgPayMenu .org-action-menu-item', { hasText: '收款設定' }).click();
    await expect(page.locator('#paySetModal.show')).toBeVisible();
    await expect(page.locator('#paySetLineId')).toHaveValue('org_default_tw');
    await expect(page.locator('#paySetBankCode')).toHaveValue('013');
    await expect(page.locator('#paySetBankAcct')).toHaveValue('9999-0000');

    await page.locator('#paySetLineId').fill('team_only_line');
    await page.evaluate(() => window.closePaySetup());
    await page.locator('#orgProfileBtn').click();
    await page.locator('#orgProfilePayToggle').click();
    await expect(page.locator('#orgDefaultLineId')).toHaveValue('org_default_tw');

    await page.screenshot({ path: testInfo.outputPath('organizer-profile-default-payment.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('organizer detail uses compact bottom submit summary and add-order action on mobile', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await openApp(page);
    await openOrganizerDetail(page);

    await expect(page.locator('#orgPnav')).toBeVisible();
    await expect(page.locator('#orgHeroSubmit')).toHaveCount(0);
    await expect(page.locator('#orgFoot')).toBeVisible();
    await expect(page.locator('#orgPnavCta')).toBeHidden();
    const actionLabels = await page.locator('.org3-acts button').evaluateAll(buttons => buttons.map(button => {
      const clone = button.cloneNode(true);
      clone.querySelectorAll('.act-badge').forEach(node => node.remove());
      return clone.textContent.trim();
    }));
    expect(actionLabels).toEqual(['公告', '分享', '收款', '列印']);
    await expect(page.locator('.org3-acts > button', { hasText: '連結' })).toHaveCount(0);
    await expect(page.locator('.org3-acts > button', { hasText: 'LINE' })).toHaveCount(0);
    await expect(page.locator('.org3-acts > button', { hasText: '催款' })).toHaveCount(0);
    await expect(page.locator('.org3-acts button', { hasText: '備註' })).toHaveCount(0);
    await expect(page.locator('#orgActionPay #unpaidBadge')).toBeVisible();

    await page.locator('.org3-acts button', { hasText: '公告' }).click();
    await expect(page.locator('#teamNoteWrap.open')).toBeVisible();
    await expect(page.locator('#teamNoteWrap .tn-edit-h')).toHaveText('給訂購人看的公告');

    await page.locator('#orgActionShare').click();
    await expect(page.locator('#orgShareMenu')).toBeVisible();
    await expect(page.locator('#orgShareMenu .org-action-menu-item')).toHaveText(['複製連結', 'LINE 分享']);
    const shareMenuBox = await page.locator('#orgShareMenu').evaluate(menu => {
      const rect = menu.getBoundingClientRect();
      return {
        insideViewport: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
        aboveCard: (Number(getComputedStyle(menu).zIndex) || 0) >= 20,
      };
    });
    expect(shareMenuBox).toEqual({ insideViewport: true, aboveCard: true });
    await page.locator('#orgShareMenu .org-action-menu-item', { hasText: 'LINE 分享' }).click();
    await expect(page.locator('#lineModal.show')).toBeVisible();
    await page.evaluate(() => window.closeLineShare());

    await page.locator('#orgActionPay').click();
    await expect(page.locator('#orgPayMenu')).toBeVisible();
    await expect(page.locator('#orgPayMenu .org-action-menu-item')).toHaveText(['收款設定', '催未付款']);
    await page.locator('#orgPayMenu .org-action-menu-item', { hasText: '收款設定' }).click();
    await expect(page.locator('#paySetModal.show')).toBeVisible();
    await page.evaluate(() => window.closePaySetup());
    await expect(page.locator('.org3-acts > button', { hasText: '列印' })).toBeEnabled();

    const submitSummary = await page.evaluate(() => {
      const foot = document.querySelector('#orgFoot');
      const nav = document.querySelector('#orgPnav');
      const footRect = foot?.getBoundingClientRect();
      const navRect = nav?.getBoundingClientRect();
      const count = document.querySelector('#ffCount')?.textContent?.trim();
      const total = document.querySelector('#ffTotal')?.textContent?.trim();
      const people = document.querySelector('#osPeople')?.textContent?.trim();
      const orderTotal = document.querySelector('#osTotal')?.textContent?.trim();
      return {
        aboveNav: !!footRect && !!navRect && footRect.bottom <= navRect.top + 1,
        compact: !!footRect && footRect.height <= 92,
        syncsStats: count === people && total === orderTotal,
        buttonVisible: !!document.querySelector('#orgFootBtn') && getComputedStyle(document.querySelector('#orgFootBtn')).display !== 'none'
      };
    });
    expect(submitSummary.aboveNav).toBe(true);
    expect(submitSummary.compact).toBe(true);
    expect(submitSummary.syncsStats).toBe(true);
    expect(submitSummary.buttonVisible).toBe(true);

    await page.locator('#orgPeopleAdd').click();
    await expect(page.locator('#proxyModal.show')).toBeVisible();
    await expect(page.locator('#submitModal.show')).toHaveCount(0);
    await page.evaluate(() => window.closeProxyOrder());

    await page.locator('#orgFootBtn').click();
    await expect(page.locator('#submitModal.show')).toBeVisible();
    await page.evaluate(() => window.closeSubmitModal());

    await page.locator('#orgTabChat').click();
    await expect(page.locator('#orgChat.open')).toBeVisible();
    await expect(page.locator('#orgFoot')).toBeHidden();
    await page.locator('#orgChat .oc-x').click();
    await expect(page.locator('#orgChat.open')).toHaveCount(0);
    await expect(page.locator('#orgFoot')).toBeVisible();

    await page.screenshot({ path: testInfo.outputPath('organizer-mobile-actions.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('organizer team settings menu is not confined inside the overview card', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await openApp(page);
    await openOrganizerDetail(page);
    await page.locator('#teamStatusBtn').click();
    await expect(page.locator('#teamStatusMenu')).toBeVisible();

    const placement = await page.evaluate(() => {
      const menu = document.querySelector('#teamStatusMenu');
      const card = document.querySelector('#teamOpen');
      const menuRect = menu?.getBoundingClientRect();
      const cardRect = card?.getBoundingClientRect();
      return {
        parentIsBody: menu?.parentElement === document.body,
        coversViewport: !!menuRect &&
          menuRect.top <= 1 &&
          menuRect.left <= 1 &&
          menuRect.right >= window.innerWidth - 1 &&
          menuRect.bottom >= window.innerHeight - 1,
        tallerThanCard: !!menuRect && !!cardRect && menuRect.height > cardRect.height * 1.8,
      };
    });

    expect(placement).toEqual({
      parentIsBody: true,
      coversViewport: true,
      tallerThanCard: true,
    });
    await expect(page.locator('#teamStatusMenu .status-opt .so-t')).toHaveText([
      '編輯團購資料',
      '暫停收單',
      '關閉團購',
    ]);

    await page.screenshot({ path: testInfo.outputPath('organizer-team-settings-menu.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('organizer can edit pre-submit team details and clears delivery date', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await openApp(page);
    await openOrganizerDetail(page);
    await page.evaluate(() => {
      const t = TEAMS.find(team => team.id === currentTeamId);
      Object.assign(t, {
        name: '編輯前團購',
        address: '原本地址',
        contactName: '原本聯絡人',
        contactPhone: '0900-000-000',
        start: '2026-05-23',
        deadline: '2099-06-20T18:00',
        deptOptions: ['企劃部', '財務部'],
        pickupAt: '2099-06-21',
        deliverAt: '2099-06-20T12:00',
        submitStatus: null,
        open: true,
        paused: false,
      });
      enterTeam(t.id);
    });
    await expect(page.locator('#teamDeptWrap')).toHaveCount(0);
    await expect(page.locator('.org3-acts button', { hasText: '單位' })).toHaveCount(0);

    await page.locator('#teamStatusBtn').click();
    await page.locator('#teamEditDetailsBtn').click();
    await expect(page.locator('#newTeamModal.show')).toBeVisible();
    await expect(page.locator('#newTeamTitle')).toHaveText('編輯團購資料');
    await expect(page.locator('#ntStart')).toHaveCount(0);
    await expect(page.locator('#ntDeliver')).toHaveCount(0);
    await expect(page.locator('#ntDeptOptions')).toHaveCount(0);
    await expect(page.locator('#newTeamModal')).not.toContainText('開團日期');
    await expect(page.locator('#newTeamModal')).toContainText('取貨時間');
    await expect(page.locator('#ntDeptChips')).toBeVisible();
    await expect(page.locator('#ntDeptChips .team-dept-tag', { hasText: '企劃部' })).toBeVisible();
    await expect(page.locator('#ntDeptChips .team-dept-tag', { hasText: '財務部' })).toBeVisible();
    await expect(page.locator('#ntName')).toHaveValue('編輯前團購');
    await expect(page.locator('#ntAddress')).toHaveValue('原本地址');
    await expect(page.locator('#ntContactName')).toHaveValue('原本聯絡人');
    await expect(page.locator('#ntContactPhone')).toHaveValue('0900-000-000');
    await expect(page.locator('#ntDeadline')).toHaveValue('2099-06-20T18:00');
    await expect(page.locator('#ntPickup')).toHaveAttribute('type', 'datetime-local');
    await expect(page.locator('#ntPickup')).toHaveValue('2099-06-21T12:00');
    const contactFieldLayout = await page.evaluate(() => {
      const name = document.querySelector('#ntContactName')?.closest('label')?.getBoundingClientRect();
      const phone = document.querySelector('#ntContactPhone')?.closest('label')?.getBoundingClientRect();
      const box = document.querySelector('#newTeamModal.show .date-box')?.getBoundingClientRect();
      return {
        phoneStartsOnNextLine: !!name && !!phone && phone.top >= name.bottom + 8,
        phoneFitsModal: !!phone && !!box && phone.left >= box.left + 16 && phone.right <= box.right - 16,
      };
    });
    expect(contactFieldLayout).toEqual({
      phoneStartsOnNextLine: true,
      phoneFitsModal: true,
    });

    await page.locator('#ntName').fill('編輯後下午茶團');
    await page.locator('#ntAddress').fill('新地址 88 號');
    await page.locator('#ntContactName').fill('新聯絡人');
    await page.locator('#ntContactPhone').fill('0912-345-678');
    await page.locator('#ntDeadline').fill('2099-06-23T17:30');
    await page.locator('#ntDeptChips button[aria-label="移除 企劃部"]').click();
    await page.locator('#ntDeptInput').fill('研發部');
    await page.locator('#ntDeptAdd').click();
    await page.locator('#ntPickup').fill('2099-06-24T15:45');
    await page.locator('#newTeamApply').click();

    await expect(page.locator('#newTeamModal.show')).toHaveCount(0);
    const editedTeam = await page.evaluate(() => {
      const t = TEAMS.find(team => team.id === currentTeamId);
      return {
        name: t.name,
        address: t.address,
        contactName: t.contactName,
        contactPhone: t.contactPhone,
        start: t.start,
        deadline: t.deadline,
        deptOptions: t.deptOptions,
        pickupAt: t.pickupAt,
        deliverAt: t.deliverAt || '',
      };
    });
    expect(editedTeam).toMatchObject({
      name: '編輯後下午茶團',
      address: '新地址 88 號',
      contactName: '新聯絡人',
      contactPhone: '0912-345-678',
      start: '2026-05-23',
      deadline: '2099-06-23T17:30',
      pickupAt: '2099-06-24T15:45',
      deliverAt: '',
    });
    expect(editedTeam.deptOptions).toEqual(expect.arrayContaining(['財務部', '研發部']));
    expect(editedTeam.deptOptions).not.toContain('企劃部');
    await expect(page.locator('#orgTitle')).toHaveText('編輯後下午茶團');
    await goScreen(page, 'orderer');
    const ordererDeptOptions = await page.locator('#ordDept option').evaluateAll(options => options.map(option => option.value));
    expect(ordererDeptOptions).toEqual(expect.arrayContaining(['財務部', '研發部']));
    expect(ordererDeptOptions).not.toContain('企劃部');
    await goScreen(page, 'organizer');
    await page.evaluate(() => enterTeam(currentTeamId));
    await expect(page.locator('#organizer.active #orgDetailView')).toBeVisible();

    await page.evaluate(() => {
      const t = TEAMS.find(team => team.id === currentTeamId);
      t.submitStatus = 'pending';
      enterTeam(t.id);
    });
    await page.locator('#teamStatusBtn').click();
    await page.locator('#teamEditDetailsBtn').click();
    await expect(page.locator('#newTeamModal.show')).toHaveCount(0);

    await page.screenshot({ path: testInfo.outputPath('organizer-edit-team-details.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('new teams and shop submission use pickup time without delivery date', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await openApp(page);
    await openOrganizerList(page);
    await page.evaluate(() => {
      if (typeof window.setMaxTeams === 'function') window.setMaxTeams(9);
    });

    await page.evaluate(() => window.openNewTeam());
    await expect(page.locator('#newTeamModal.show')).toBeVisible();
    await expect(page.locator('#newTeamTitle')).toHaveText('開新團');
    await expect(page.locator('#ntStart')).toHaveCount(0);
    await expect(page.locator('#ntDeliver')).toHaveCount(0);
    await expect(page.locator('#ntDeptOptions')).toHaveCount(0);
    await expect(page.locator('#newTeamModal')).not.toContainText('開團日期');
    await expect(page.locator('#newTeamModal')).toContainText('取貨時間');
    await expect(page.locator('#ntDeptChips')).toBeVisible();
    await expect(page.locator('#ntPickup')).toHaveAttribute('type', 'datetime-local');
    await page.locator('#ntName').fill('只用取貨時間測試團');
    await page.locator('#ntDeptInput').fill('客服部、門市部');
    await page.locator('#ntDeptAdd').click();
    await page.locator('#ntPickup').fill('2099-06-25T12:30');
    await page.locator('#newTeamApply').click();
    await expect(page.locator('#newTeamModal.show')).toHaveCount(0);

    const createdTeam = await page.evaluate(() => ({
      name: TEAMS[0].name,
      deptOptions: TEAMS[0].deptOptions,
      pickupAt: TEAMS[0].pickupAt,
      deliverAt: TEAMS[0].deliverAt || '',
    }));
    expect(createdTeam).toEqual({
      name: '只用取貨時間測試團',
      deptOptions: expect.arrayContaining(['客服部', '門市部']),
      pickupAt: '2099-06-25T12:30',
      deliverAt: '',
    });

    await page.locator('#teamList .tcard').first().click();
    await page.evaluate(() => window.submitToShop());
    await expect(page.locator('#submitModal.show')).toBeVisible();
    await expect(page.locator('#submitPickupAt')).toBeVisible();
    await expect(page.locator('#submitModal')).toContainText('取貨時間');
    await page.locator('#submitPickupAt').fill('2099-06-25T12:30');
    await page.evaluate(() => window.confirmSubmitToShop());
    await expect(page.locator('#submitModal.show')).toHaveCount(0);

    const submittedTeam = await page.evaluate(() => ({
      submitStatus: TEAMS[0].submitStatus,
      pickupAt: TEAMS[0].pickupAt,
      deliverAt: TEAMS[0].deliverAt || '',
      open: TEAMS[0].open,
    }));
    expect(submittedTeam).toEqual({
      submitStatus: 'pending',
      pickupAt: '2099-06-25T12:30',
      deliverAt: '',
      open: false,
    });

    await page.screenshot({ path: testInfo.outputPath('organizer-new-team-pickup-only.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('organizer detail keeps add order in the people toolbar on desktop', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 1024, height: 768 });

    await openApp(page);
    await openOrganizerDetail(page);

    await expect(page.locator('#orgPeopleTools')).toBeVisible();
    await expect(page.locator('#orgPeopleAdd')).toBeVisible();
    const toolbarLayout = await page.evaluate(() => {
      const toolbar = document.querySelector('#orgPeopleTools');
      const add = document.querySelector('#orgPeopleAdd');
      const group = document.querySelector('#orgPeople .dept-group');
      if (!toolbar || !add || !group) return { addOnRight: false, toolbarAligned: false };
      const toolbarRect = toolbar.getBoundingClientRect();
      const addRect = add.getBoundingClientRect();
      const groupRect = group.getBoundingClientRect();
      return {
        addOnRight: addRect.left > toolbarRect.left + toolbarRect.width / 2,
        toolbarAligned: Math.abs(toolbarRect.left - groupRect.left) <= 2 && Math.abs(toolbarRect.right - groupRect.right) <= 2
      };
    });
    expect(toolbarLayout.addOnRight).toBe(true);
    expect(toolbarLayout.toolbarAligned).toBe(true);

    await page.locator('#orgPeopleAdd').click();
    await expect(page.locator('#proxyModal.show')).toBeVisible();

    await page.screenshot({ path: testInfo.outputPath('organizer-people-toolbar.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('organizer remove confirmation stays above expanded member card', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await openApp(page);
    await openOrganizerDetail(page);

    const secondCard = page.locator('#orgPeople .person-card').nth(1);
    await secondCard.locator('.person-h').click();
    await expect(secondCard.locator('.person-ops')).toBeVisible();
    await secondCard.locator('.person-del-btn').click();
    await expect(page.locator('#uiConfirmModal.show')).toBeVisible();

    await expectReachableControls(page, ['#uiConfirmModal']);
    const modalLayer = await page.evaluate(() => {
      const modal = document.querySelector('#uiConfirmModal');
      const box = modal?.querySelector('.ui-dialog-box');
      const ok = document.querySelector('#uiConfirmOk');
      const card = document.querySelector('#orgPeople .person-card.open');
      if (!modal || !box || !ok || !card) {
        return { modalAboveOrganizer: false, okClickable: false, boxOnTop: false };
      }
      const okRect = ok.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      const okTop = document.elementFromPoint(okRect.left + okRect.width / 2, okRect.top + okRect.height / 2);
      const boxTop = document.elementFromPoint(boxRect.left + boxRect.width / 2, boxRect.top + boxRect.height / 2);
      const modalZ = Number(getComputedStyle(modal).zIndex) || 0;
      const organizerZ = Number(getComputedStyle(document.querySelector('#organizer')).zIndex) || 0;
      return {
        modalAboveOrganizer: modalZ > organizerZ,
        okClickable: !!okTop && (ok === okTop || ok.contains(okTop)),
        boxOnTop: !!boxTop && (box === boxTop || box.contains(boxTop)),
      };
    });
    expect(modalLayer.modalAboveOrganizer).toBe(true);
    expect(modalLayer.okClickable).toBe(true);
    expect(modalLayer.boxOnTop).toBe(true);

    await page.screenshot({ path: testInfo.outputPath('organizer-remove-confirm-on-top.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('organizer edit order modal footer stays reachable after scrolling', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await openApp(page);
    await openOrganizerDetail(page);

    const secondCard = page.locator('#orgPeople .person-card').nth(1);
    await secondCard.locator('.person-h').click();
    await expect(secondCard.locator('.person-ops')).toBeVisible();
    await secondCard.locator('.person-edit').click();
    await expect(page.locator('#proxyModal.show')).toBeVisible();

    await page.locator('#proxyModal .ord-modal-body').evaluate(element => {
      element.scrollTop = element.scrollHeight;
    });
    await page.waitForTimeout(100);

    await expectReachableControls(page, ['#proxyModal .ord-modal-foot']);
    const modalFooterLayer = await page.evaluate(() => {
      const modal = document.querySelector('#proxyModal');
      const save = document.querySelector('#pxSaveBtn');
      const foot = document.querySelector('#orgFoot');
      const nav = document.querySelector('#orgPnav');
      if (!modal || !save) return { saveClickable: false, modalAboveFoot: false, modalAboveNav: false };
      const rect = save.getBoundingClientRect();
      const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const modalZ = Number(getComputedStyle(modal).zIndex) || 0;
      const footZ = foot ? Number(getComputedStyle(foot).zIndex) || 0 : 0;
      const navZ = nav ? Number(getComputedStyle(nav).zIndex) || 0 : 0;
      return {
        saveClickable: !!top && (save === top || save.contains(top)),
        modalAboveFoot: modalZ > footZ,
        modalAboveNav: modalZ > navZ,
      };
    });
    expect(modalFooterLayer.saveClickable).toBe(true);
    expect(modalFooterLayer.modalAboveFoot).toBe(true);
    expect(modalFooterLayer.modalAboveNav).toBe(true);

    await page.screenshot({ path: testInfo.outputPath('organizer-edit-modal-footer-reachable.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('organizer visible controls stay reachable across common viewports', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    const viewports = [
      { name: 'mobile', width: 390, height: 844 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'laptop', width: 1024, height: 768 },
      { name: 'desktop', width: 1440, height: 900 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openOrganizerList(page);
      await expectReachableControls(page, ['#organizer.active', '#orgPnav']);

      await openOrganizerDetail(page);
      await expectReachableControls(page, ['#organizer.active', '#orgPnav', '#orgFoot']);
      const actionFit = await page.locator('.org3-acts').evaluate(actions => {
        const buttons = Array.from(actions.querySelectorAll(':scope > button'));
        const rect = actions.getBoundingClientRect();
        return {
          count: buttons.length,
          labels: buttons.map(button => {
            const clone = button.cloneNode(true);
            clone.querySelectorAll('.act-badge').forEach(node => node.remove());
            return clone.textContent.trim();
          }),
          allInside: buttons.every(button => {
            const b = button.getBoundingClientRect();
            return b.left >= rect.left - 1 && b.right <= rect.right + 1 && b.width >= 54;
          }),
          noWrap: buttons.every(button => button.scrollWidth <= button.clientWidth + 1),
        };
      });
      expect(actionFit).toEqual({
        count: 4,
        labels: ['公告', '分享', '收款', '列印'],
        allInside: true,
        noWrap: true,
      });

      const firstCard = page.locator('#orgPeople .person-card').first();
      await firstCard.locator('.person-h').click();
      await expect(firstCard.locator('.person-ops')).toBeVisible();
      await page.waitForTimeout(420);
      await expectReachableControls(page, ['#organizer.active', '#orgPnav', '#orgFoot']);

      await page.locator('#orgPeopleAdd').click();
      await expect(page.locator('#proxyModal.show')).toBeVisible();
      await expectReachableControls(page, [
        '#proxyModal .ord-modal-h',
        '#pxMenuTabs',
        '#proxyModal .ord-modal-foot',
      ]);
      await page.evaluate(() => window.closeProxyOrder());

      if (viewport.width < 1180) {
        await page.locator('#orgTabChat').click();
        await expect(page.locator('#orgChat.open')).toBeVisible();
        await expectReachableControls(page, ['#orgChat', '#orgPnav']);
        await page.locator('#orgChat .oc-x').click();
        await expect(page.locator('#orgChat.open')).toHaveCount(0);
      }
    }

    await page.screenshot({ path: testInfo.outputPath('organizer-controls-reachable.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('organizer person cards prioritize notes and keep items collapsed', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 1024, height: 768 });

    await openApp(page);
    await openOrganizerDetail(page);
    await page.evaluate(() => {
      window.eval("ORDERS[0].note='下午 3 點前請先收款'; renderPeople();");
    });

    const firstGroup = page.locator('#orgPeople .dept-group[data-dept="行政部"]');
    await expect(firstGroup.locator('.dept-group-h')).toContainText('行政部');
    await expect(firstGroup.locator('.dept-group-h .dg-meta')).toContainText('2 人');

    const firstCard = page.locator('#orgPeople .person-card').first();
    await expect(firstCard.locator('.person-dept')).toHaveCount(0);
    await expect(firstCard.locator('.person-note-preview')).toBeVisible();
    await expect(firstCard.locator('.person-note-preview')).toContainText('下午 3 點前請先收款');
    await expect(firstCard.locator('.person-items')).toBeHidden();
    const collapsedSummary = await firstCard.locator('.person-summary').innerText();
    expect(collapsedSummary).toBe('7 項商品');
    expect(collapsedSummary).not.toContain('展開看明細');
    expect(collapsedSummary).not.toContain('大綜合');

    await firstCard.locator('.person-h').click();
    await expect(firstCard.locator('.person-items')).toBeVisible();
    await expect(firstCard.locator('.person-tag').first()).toBeVisible();
    await expect(firstCard.locator('.person-note-preview')).toBeVisible();

    await page.screenshot({ path: testInfo.outputPath('organizer-note-priority.png'), fullPage: false });
    expect(issues).toEqual([]);
  });

  test('organizer department groups can collapse independently', async ({ page }, testInfo) => {
    const issues = collectPageIssues(page);
    await page.setViewportSize({ width: 1024, height: 768 });

    await openApp(page);
    await openOrganizerDetail(page);

    const adminGroup = page.locator('#orgPeople .dept-group[data-dept="行政部"]');
    const financeGroup = page.locator('#orgPeople .dept-group[data-dept="財務部"]');
    await expect(adminGroup.locator('.dept-group-h')).toContainText('行政部');
    await expect(adminGroup.locator('.dept-group-h .dg-meta')).toContainText('2 人');

    await expect(adminGroup.locator('.person-card')).toHaveCount(2);
    await expect(adminGroup.locator('.person-card').first()).toBeVisible();
    await expect(financeGroup.locator('.person-card')).toHaveCount(1);
    await expect(financeGroup.locator('.person-card').first()).toBeVisible();

    await adminGroup.locator('.dept-group-h').click();
    await expect(adminGroup).toHaveClass(/is-collapsed/);
    await expect(adminGroup.locator('.dept-group-h')).toHaveAttribute('aria-expanded', 'false');
    await expect(adminGroup.locator('.person-card').first()).toBeHidden();
    await expect(financeGroup.locator('.person-card').first()).toBeVisible();

    await page.evaluate(() => window.renderPeople());
    await expect(adminGroup).toHaveClass(/is-collapsed/);
    await expect(adminGroup.locator('.person-card').first()).toBeHidden();

    await adminGroup.locator('.dept-group-h').click();
    await expect(adminGroup).not.toHaveClass(/is-collapsed/);
    await expect(adminGroup.locator('.dept-group-h')).toHaveAttribute('aria-expanded', 'true');
    await expect(adminGroup.locator('.person-card').first()).toBeVisible();

    await adminGroup.locator('.person-card').first().locator('.person-h').click();
    await expect(adminGroup.locator('.person-card').first().locator('.person-items')).toBeVisible();

    await page.screenshot({ path: testInfo.outputPath('organizer-dept-collapse.png'), fullPage: false });
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
