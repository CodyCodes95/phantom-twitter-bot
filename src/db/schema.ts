import { integer, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

export const appTracking = pgTable("appTracking", {
  id: serial("id").primaryKey(),
  app: varchar("app", { length: 256 }),
  date: timestamp("date"),
  category: varchar("category", { length: 256 }),
  allRank: integer("allRank"),
  specificRank: integer("specificRank"),
});

export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 256 }),
  message: varchar("message", { length: 256 }),
  createdOn: timestamp("createdOn"),
});
