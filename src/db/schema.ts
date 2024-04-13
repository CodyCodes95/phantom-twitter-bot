import { integer, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

export const appTracking = pgTable("appTracking", {
  id: serial("id").primaryKey(),
  app: varchar("app", { length: 256 }),
  date: timestamp("date"),
  category: varchar("category", { length: 256 }),
  allRank: integer("allRank"),
  specificRank: integer("specificRank"),
});
