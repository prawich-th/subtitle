import { RequestHandler } from "express";
import { centralError } from "./error";
import { Subtitle } from "../type";
import { updateSubtitleData } from "../helper/updateSubtitleData";
import { io } from "../app";

let cacheSubdata: Subtitle[] = [];

export const getData: RequestHandler = async (req, res, next) => {
	try {
		console.info("Incoming request for data");
		let subdata: Subtitle[] = [];

		if (cacheSubdata.length > 0) {
			subdata = cacheSubdata;
		} else {
			const subdataResult = await updateSubtitleData();
			if (subdataResult && !(subdataResult instanceof Error)) {
				subdata = subdataResult;
				cacheSubdata = subdata;
			}
		}

		io.emit("subtitle", { data: subdata });
		return res.status(200).json(subdata);
	} catch (error) {
		return centralError(
			{
				statusCode: 500,
				message: "Internal server error",
				type: "general",
				modal: false,
				location: req.path
			},
			req,
			res,
			next
		);
	}
};

export const forceUpdateSubtitles: RequestHandler = async (req, res, next) => {
	try {
		const subdata = await updateSubtitleData();
		if (subdata && !(subdata instanceof Error)) {
			cacheSubdata = subdata;
		}
		return res.status(200).json({ message: "Subtitles updated successfully" });
	} catch (error) {
		console.error("Error force updating subtitles:", error);
		return centralError(
			{
				statusCode: 500,
				message: "Cannot Update Subtitles",
				type: "general",
				modal: false,
				location: req.path
			},
			req,
			res,
			next
		);
	}
};
