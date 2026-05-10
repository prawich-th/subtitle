import type { RequestHandler } from "express";
import { centralError } from "./error";
import type { Subtitle } from "../type";
import { updateSubtitleData } from "../helper/updateSubtitleData";
import { io } from "../app";
import db from "../db/drizzle";
import { subtitles } from "../db/schema";
import { getCurrentSession } from "../helper/currentSession";

export const getSubtitleList: RequestHandler = async (req, res, next) => {
  try {
    const subtitleList = await db.query.subtitles.findMany({
      columns: {
        id: true,
        userId: true,
      },
      with: {
        user: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });
    return res.status(200).json({ subtitleList });
  } catch (error) {
    return centralError(
      {
        statusCode: 500,
        message: "Internal server error",
        type: "general",
        modal: false,
        location: req.path,
      },
      req,
      res,
      next,
    );
  }
};

export const getData: RequestHandler = async (req, res, next) => {
  try {
    const { subtitleID } = getCurrentSession();
    console.info("Incoming request for data", subtitleID);

    if (subtitleID === 0) {
      return res.status(200).json({
        subtitle: [
          {
            act: 0,
            scene: 0,
            char: "NOT STARTED",
            eng: "Session Not Started",
            thai: "",
            isLyric: false,
            remark: "",
            display: "full-screen",
          },
        ],
        srcs: [],
      });
    }

    const subtitleData = await db.query.subtitles.findFirst({
      where: {
        id: subtitleID,
      },
    });

    if (!subtitleData) {
      return centralError(
        {
          statusCode: 404,
          message: "Subtitle not found",
          type: "general",
          modal: false,
          location: req.path,
        },
        req,
        res,
        next,
      );
    }

    io.emit("subtitle", { data: subtitleData.subtitles });
    return res
      .status(200)
      .json({ subtitle: subtitleData.subtitles, srcs: subtitleData.srcs });
  } catch (error) {
    return centralError(
      {
        statusCode: 500,
        message: "Internal server error",
        type: "general",
        modal: false,
        location: req.path,
      },
      req,
      res,
      next,
    );
  }
};

export const createSubtitle: RequestHandler = async (req, res, next) => {
  try {
    console.log("createSubtitle");
    console.log(req.user);
    const { userId } = req.user as { userId: number };
    const { data } = req.body as { data: Subtitle[] };

    console.log(userId, data);
    const subtitle = await db
      .insert(subtitles)
      .values({
        subtitles: data,
        userId: userId,
      })
      .returning({
        id: subtitles.id,
        userId: subtitles.userId,
        subtitles: subtitles.subtitles,
      });

    return res
      .status(200)
      .json({ message: "Subtitle created successfully", subtitle });
  } catch (error) {
    return centralError(
      {
        statusCode: 500,
        message: "Cannot Create Subtitle",
        type: "general",
        modal: false,
        location: req.path,
      },
      req,
      res,
      next,
    );
  }
};
