import { RequestHandler } from "express";
import { centralError } from "./error";

const ALLOWCODES = ["5679", "PRODS", "NOVA"];

export const verify: RequestHandler = async (req, res, next) => {
	try {
		const code = req.body.code;
		if (ALLOWCODES.includes(code)) {
			res.status(200).json({ message: "verified", verified: true });
		}
		return res.status(401).json({ message: "unauthorized", verified: false });
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
