const { chromium } = require('playwright');
const SCRATCHPAD = 'C:/Users/Bernadette Bongar/AppData/Local/Temp/claude/c--Users-Bernadette-Bongar-Documents-claude-cc-app/75a519e9-55b6-42d1-b68e-7c6e748039b3/scratchpad';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('http://localhost:5174/', { waitUntil: 'networkidle', timeout: 20000 });
  console.log('Loaded:', page.url());
  console.log('Title:', await page.title());
  await page.screenshot({ path: SCRATCHPAD + '/screen1-home.png' });
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
