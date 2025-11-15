import { Router } from "express";
import { getData } from "./controller/data";
import {
	initSession,
	jumpToLine,
	nextLine,
	previousLine,
	currentIndex
} from "./controller/subcontrol";
import { verify } from "./controller/verify";
const router = Router();

router.get("/data", getData);

router.get("/subcontrol/init", initSession);
router.get("/subcontrol/next", nextLine);
router.get("/subcontrol/previous", previousLine);
router.get("/subcontrol/jump/:index", jumpToLine);
router.get("/subcontrol/current", currentIndex);

router.post("/verify", verify);

export default router;
