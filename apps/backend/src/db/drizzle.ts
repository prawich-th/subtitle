import { defineRelations } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { subtitles, users } from "./schema";
import * as schema from "./schema";

const relations = defineRelations({ subtitles, users }, (r) => ({
  users: {
    subtitles: r.many.subtitles(),
  },
  subtitles: {
    user: r.one.users({
      from: r.subtitles.userId,
      to: r.users.id,
    }),
  },
}));

const db = drizzle(process.env.DATABASE_URL!, {
  schema,
  relations,
});

export default db;
