import { RequestHandler } from "express";
import { io } from "../app";
import { updateSubtitleData } from "../helper/updateSubtitleData";
import { Subtitle } from "../type";
import { centralError } from "./error";

let subIndex = 0;
let cacheSubdata: Subtitle[] = [];

export const initSession: RequestHandler = async (req, res, next) => {
	subIndex = 0;
	const subdata = await updateSubtitleData();
	if (subdata && !(subdata instanceof Error)) {
		cacheSubdata = subdata;
	}
	io.emit("subIndex", { index: subIndex });
	io.on("connection", (socket) => {
		io.emit("subIndex", { index: subIndex });
	});
	res.status(200).json({ index: subIndex });
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
				location: req.path
			},
			req,
			res,
			next
		);
	}
};

export const nextLine: RequestHandler = async (req, res, next) => {
	if (cacheSubdata.length === 0) {
		const subdata = await updateSubtitleData();
		if (subdata && !(subdata instanceof Error)) {
			cacheSubdata = subdata;
		}
	}
	subIndex = subIndex + 1;

	if (subIndex >= cacheSubdata.length) {
		subIndex = 0;
	}
	console.log("Next Line:", subIndex);
	io.emit("subIndex", { index: subIndex });
	res.status(200).json({
		index: subIndex,
		subtitle: cacheSubdata[subIndex]
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
		subtitle: cacheSubdata[subIndex]
	});
};

export const jumpToLine: RequestHandler = async (req, res, next) => {
	const { index } = req.params;
	if (index && !isNaN(Number(index))) {
		subIndex = parseInt(index);
		if (subIndex >= cacheSubdata.length) {
			subIndex = cacheSubdata.length - 1;
		}
		io.emit("subIndex", { index: subIndex });
		res.status(200).json({
			index: subIndex,
			subtitle: cacheSubdata[subIndex]
		});
	} else {
		return centralError(
			{
				statusCode: 400,
				message: "Invalid index",
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
