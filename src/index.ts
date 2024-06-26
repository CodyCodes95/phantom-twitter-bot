import puppeteer from "puppeteer";

import * as schema from "./db/schema";
import { TwitterApi } from "twitter-api-v2";
import { desc, eq } from "drizzle-orm";
import cron from "node-cron";
import { db } from "./db/db";

// Types

type App = {
  name: string;
  url: string;
  category: string;
};

type AppRanks = {
  allRank: number;
  specificRank: number;
};

type MostRecentRank = {
  date: Date | null;
  id: number;
  app: string | null;
  category: string | null;
  allRank: number | null;
  specificRank: number | null;
};

type WriteLogOptions = {
  type: string;
  message: string;
};

type GenerateTweetOptions = {
  allRank: number;
  specificRank: number;
  mostRecentRank: MostRecentRank;
  appName: string;
  category: string;
  emoji: string;
};

const getAppsToTrack = (yesterdaysDate: string) => {
  return [
    {
      name: "Phantom",
      url: `https://app.sensortower.com/category-rankings?os=ios&app_id=1598432977&start_date=${yesterdaysDate}&end_date=${yesterdaysDate}&countries=US&category=6015&category=36&category=0&category=6002&chart_type=free&device=iphone&hourly=false&selected_tab=charts&date=${yesterdaysDate}&summary_chart_type=topfreeapplications`,
      category: "Utilities",
      emoji: "👻",
    },
    {
      name: "Coinbase Wallet",
      url: `https://app.sensortower.com/category-rankings?os=ios&app_id=1278383455&start_date=${yesterdaysDate}&end_date=${yesterdaysDate}&countries=US&category=6015&category=0&category=36&chart_type=free&chart_type=paid&device=iphone&hourly=false&selected_tab=charts&date=${yesterdaysDate}&summary_chart_type=topfreeapplications`,
      category: "Finance",
      emoji: "🪙",
    },
  ];
};

const scrapeAppRankings = async (app: App) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Navigate the page to a URL
  await page.goto(app.url);
  // Set screen size
  await page.setViewport({ width: 1080, height: 1024 });
  const tableSelector = await page.waitForSelector("#category-ranking-table tbody");
  const appRanks = await tableSelector?.evaluate((el) => {
    const rows = Array.from(el.children);
    return rows
      .map((row: any) => {
        return {
          category: row.children[3].textContent,
          rank: row.children[4].textContent,
        };
      })
      .filter((row: any) => row.category === "Apps" || row.category === "Utilities" || row.category === "Finance")
      .reduce((acc, cur) => {
        if (cur.category === "Apps") {
          acc.allRank = Number(cur.rank);
        }
        if (cur.category === "Utilities") {
          acc.specificRank = Number(cur.rank);
        }
        if (cur.category === "Finance") {
          acc.specificRank = Number(cur.rank);
        }
        return acc;
      }, {} as AppRanks);
  });
  await browser.close();
  return appRanks;
};

const generateTweet = async (options: GenerateTweetOptions) => {
  const { allRank, specificRank, mostRecentRank, appName, category, emoji } = options;
  const generateAllTrend = () => {
    if (!mostRecentRank?.allRank) return;
    if (mostRecentRank.allRank === allRank) return `📊 ${allRank} (+0)`;
    if (mostRecentRank.allRank < allRank) return `📉 ${allRank} (-${allRank - mostRecentRank.allRank})`;
    if (mostRecentRank.allRank > allRank) return `📈 ${allRank} (+${mostRecentRank.allRank - allRank})`;
  };

  const generateSpecificTrend = () => {
    if (!mostRecentRank?.specificRank) return;
    if (mostRecentRank.specificRank === specificRank) return `📊 ${specificRank} (+0)`;
    if (mostRecentRank.specificRank < specificRank)
      return `📉 ${specificRank} (-${specificRank - mostRecentRank.specificRank})`;
    if (mostRecentRank.specificRank > specificRank)
      return `📈 ${specificRank} (+${mostRecentRank.specificRank - specificRank})`;
  };

  return `
   ${emoji} ${appName} App Rank
  📅 ${new Date().getDate()} ${new Date().toLocaleString("en-AU", { month: "short" })} 8${new Date().getUTCHours() / 12 >= 1 ? "PM" : "AM"}
    
  🌎 All apps
  ${generateAllTrend()} 
    
  🏦 ${category}
  ${generateSpecificTrend()}
  `;
};

const sendTweet = async (tweet: string) => {
  const client = new TwitterApi({
    appKey: process.env.TWITTER_CONSUMER_KEY as string,
    appSecret: process.env.TWITTER_CONSUMER_SECRET as string,
    accessToken: process.env.TWITTER_ACCESS_TOKEN as string,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });
  await client.v2.tweet(tweet);
};

const writeLog = async (options: WriteLogOptions) => {
  const { type, message } = options;
  await db.insert(schema.logs).values({
    type,
    message,
    createdOn: new Date(),
  });
};

const main = async () => {
  try {
    await writeLog({ type: "log", message: "Started" });

    const yesterdaysDate = new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split("T")[0];
    const appsToTrack = getAppsToTrack(yesterdaysDate);

    for (const app of appsToTrack) {
      const mostRecentRank = await db.query.appTracking.findFirst({
        orderBy: desc(schema.appTracking.date),
        where: eq(schema.appTracking.app, app.name),
      });
      if (!mostRecentRank) throw new Error("Could not fetch most recent ranking from db");

      const appRanks = await scrapeAppRankings(app);
      if (!appRanks) throw new Error("Retrived invalid app rankings");
      if (isNaN(appRanks.allRank) || isNaN(appRanks.specificRank)) throw new Error("Retrived invalid app rankings");

      const tweet = await generateTweet({
        allRank: appRanks.allRank,
        specificRank: appRanks.specificRank,
        mostRecentRank,
        appName: app.name,
        category: app.category,
        emoji: app.emoji,
      });
      await sendTweet(tweet);
      await db.insert(schema.appTracking).values({
        app: app.name,
        date: new Date(),
        category: app.category,
        allRank: Number(appRanks.allRank),
        specificRank: Number(appRanks.specificRank),
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      await writeLog({
        type: "error",
        message: error.message,
      });
      console.error(error);
    }
  }
};

cron.schedule("0 8 * * *", main);

// main();
