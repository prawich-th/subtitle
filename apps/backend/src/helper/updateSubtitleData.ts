import type { Subtitle } from "../type";
import fs from "fs";
import path from "path";
import db from "../db/drizzle";

export const updateSubtitleData = async (
  subId: number,
): Promise<Subtitle[] | [] | Error | null> => {
  try {
    console.info("Updating subtitles");
    const subtitle = await db.query.subtitles.findFirst({
      where: {
        id: subId,
      },
    });

    if (!subtitle) {
      return null;
    }

    return subtitle.subtitles;
  } catch (error) {
    console.error("Error updating subdata:", error);
    return Promise.reject(error as Error);
  }
};
