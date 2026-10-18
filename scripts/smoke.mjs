import puppeteer from "puppeteer-core";
import fs from "node:fs";

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu"],
});
const page = await browser.newPage();
page.setViewport({ width: 1440, height: 900 });
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

const dir = "/tmp/foc-shots";
fs.mkdirSync(dir, { recursive: true });
const shot = async (name) => page.screenshot({ path: `${dir}/${name}.png` });

await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle0" });
await shot("01-title");
const title = await page.$eval("h1", (el) => el.innerText);
if (!title.includes("Front Office")) throw new Error(`title missing: ${title}`);

await page.click("[data-act=goto-new]");
await page.waitForSelector("#gm-name");
await page.click("[data-act=pick-diff][data-id=standard]");
await page.click("[data-act=pick-sit][data-id=contender]");
await page.click("[data-act=pick-team][data-id=gulls]");
await shot("02-new");
await page.click("[data-act=begin]");
await page.waitForSelector(".paper");
await shot("03-desk-tutorial");
await page.click("[data-act=tutorial-skip]");
await page.waitForSelector(".actionbar");
await shot("04-desk");

const paper = await page.$eval(".paper h3", (el) => el.innerText);
if (!paper) throw new Error("empty paper");

await page.click("[data-act=open-season]");
await page.waitForFunction(() => document.body.innerText.includes("Week 1"));
await page.click("[data-act=sim-week]");
await page.waitForFunction(() => /Week 2/.test(document.body.innerText));
await shot("05-after-series");
const record = await page.$eval(".identity p", (el) => el.innerText);
if (!/\d+-\d+/.test(record) || record.includes("0-0")) throw new Error(`record did not move: ${record}`);

await page.click("[data-act=nav][data-view=roster]");
await page.waitForSelector(".grid");
await shot("06-roster");
await page.click(".grid .linkish");
await page.waitForSelector(".dossier");
await shot("07-player");
await page.click("[data-act=nav][data-view=roster]");
await page.waitForSelector("[data-act=lineup]");
const beforeLineup = await page.$$eval("[data-act=lineup]", (els) => els.map((el) => el.value));
await page.select("[data-act=lineup][data-index='0']", beforeLineup[1]);
const afterLineup = await page.$$eval("[data-act=lineup]", (els) => els.map((el) => el.value));
if (afterLineup[0] !== beforeLineup[1] || afterLineup[1] !== beforeLineup[0]) {
  throw new Error(`lineup did not swap ${beforeLineup.join(",")} -> ${afterLineup.join(",")}`);
}

await page.click("[data-act=nav][data-view=standings]");
await page.waitForSelector("table");
await page.click("[data-act=nav][data-view=market]");
await shot("08-market");
await page.click("[data-act=nav][data-view=books]");
await page.waitForSelector(".track i");
const barWidth = await page.$eval(".track i", (el) => el.getBoundingClientRect().width);
if (barWidth < 8) throw new Error(`book bar too small: ${barWidth}`);
await shot("09-books");
await page.click("[data-act=nav][data-view=wire]");
await page.click("[data-act=nav][data-view=scores]");
await shot("10-scores");

await page.click("[data-act=sim-october]");
await page.waitForSelector(".modal");
await page.click("[data-act=modal-yes]");
await page.waitForFunction(() => /October|Season review|Dismissed/.test(document.body.innerText), { timeout: 15000 });
await shot("11-october-or-review");

if (await page.$("[data-act=sim-october-rest]")) {
  await page.click("[data-act=sim-october-rest]");
  await page.waitForFunction(() => /Season review|Dismissed|Open the winter/.test(document.body.innerText), { timeout: 15000 });
}
await shot("12-review");

if (await page.$("[data-act=ack-recap]")) {
  const review = await page.$eval("body", (el) => el.innerText);
  if (!/Season review/.test(review)) throw new Error("season review did not take the desk");
  await page.click("[data-act=ack-recap]");
  await page.waitForFunction(() => /Tender or walk|Arbitration|File tenders/.test(document.body.innerText));
  if (await page.$("[data-act=file-tenders]")) await page.click("[data-act=file-tenders]");
  await page.waitForFunction(() => /Open market/.test(document.body.innerText));
  await shot("13-fa");
  for (let i = 0; i < 4; i += 1) {
    if (!(await page.$("[data-act=advance-fa]"))) break;
    await page.click("[data-act=advance-fa]");
    await page.waitForFunction(() => /Open market|Draft room|Report to camp/.test(document.body.innerText), { timeout: 15000 });
  }
  await page.waitForFunction(() => /Draft room/.test(document.body.innerText));
  await shot("14-draft");
  if (await page.$("[data-act=draft]")) await page.click("[data-act=draft]");
  else if (await page.$("[data-act=draft-best]")) await page.click("[data-act=draft-best]");
  await page.waitForFunction(() => /Recent picks|is choosing|Draft room/.test(document.body.innerText));
}

await page.click("[data-act=menu]");
await page.waitForSelector("[data-act=goto-settings]");
await page.click("[data-act=goto-settings]");
await page.waitForSelector("input[type=range]");
await page.click("[data-act=back-manual]");
await page.click("[data-act=menu]");
await page.click("[data-act=goto-manual]");
await page.waitForFunction(() => /How the league works/.test(document.body.innerText));
await page.click("[data-act=back-manual]");

await page.setViewport({ width: 1280, height: 720 });
await page.click("[data-act=menu]");
await page.waitForSelector("[data-act=export]");
await shot("15-office");

if (errors.length) {
  console.error(errors.join("\n"));
  throw new Error(`page errors: ${errors.length}`);
}
console.log("smoke ok", record);
await browser.close();
