import type { RequestHandler } from "express";
import { io } from "../app";
import { updateSubtitleData } from "../helper/updateSubtitleData";
import type { Subtitle } from "../type";
import { centralError } from "./error";
import { setCurrentSession } from "../helper/currentSession";

let subIndex = 0;
let cacheSubdata: Subtitle[] = [];

export const initSession: RequestHandler = async (req, res, next) => {
  try {
    const { subId } = req.params as { subId: string };
    const id = Number(subId);
    if (!Number.isFinite(id) || id <= 0) {
      return centralError(
        {
          statusCode: 400,
          message: "Invalid subtitle id",
          type: "general",
          modal: false,
          location: req.path,
        },
        req,
        res,
        next,
      );
    }

    subIndex = 0;
    const subdata = await updateSubtitleData(id);

    if (subdata === null || subdata instanceof Error) {
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

    setCurrentSession(id);
    cacheSubdata = subdata;
    io.emit("subIndex", { index: subIndex });
    io.emit("sessionInit", { subId: id, index: subIndex });
    return res.status(200).json({ index: subIndex });
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

export const currentIndex: RequestHandler = async (req, res, next) => {
  try {
    return res
      .status(200)
      .json({ index: subIndex, subtitle: cacheSubdata[subIndex] });
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

export const nextLine: RequestHandler = async (req, res, next) => {
  if (cacheSubdata.length <= 0) {
    return centralError(
      {
        statusCode: 400,
        message: "No subtitles found",
        type: "general",
        modal: false,
        location: req.path,
      },
      req,
      res,
      next,
    );
  }
  subIndex = subIndex + 1;

  if (subIndex >= cacheSubdata.length) {
    subIndex = 0;
  }
  console.log("Next Line:", subIndex);
  io.emit("subIndex", { index: subIndex });
  res.status(200).json({
    index: subIndex,
    subtitle: cacheSubdata[subIndex],
  });
};

export const previousLine: RequestHandler = async (req, res, next) => {
  subIndex--;
  if (subIndex < 0) {
    subIndex = cacheSubdata.length - 1;
  }
  io.emit("subIndex", { index: subIndex });
  res.status(200).json({
    index: subIndex,
    subtitle: cacheSubdata[subIndex],
  });
};

export const jumpToLine: RequestHandler = async (req, res, next) => {
  console.log("jumpToLine", req.params);
  const { index } = req.params;
  if (index !== undefined && index !== "" && !isNaN(Number(index))) {
    subIndex = parseInt(index as string);
    if (subIndex >= cacheSubdata.length) {
      subIndex = cacheSubdata.length - 1;
    }
    io.emit("subIndex", { index: subIndex });
    res.status(200).json({
      index: subIndex,
      subtitle: cacheSubdata[subIndex],
    });
  } else {
    return centralError(
      {
        statusCode: 400,
        message: "Invalid index",
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
