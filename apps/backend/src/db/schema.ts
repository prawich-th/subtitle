import { pgTable, jsonb, integer, text } from "drizzle-orm/pg-core";
import type { Subtitle } from "../type";

export const subtitles = pgTable("subtitles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  subtitles: jsonb("subtitles").array().$type<Subtitle>(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  srcs: text("srcs").array(),
});

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name"),
  email: text("email").notNull(),
  password: text("password").notNull(),
});
