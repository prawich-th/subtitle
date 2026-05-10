import { Router } from "express";
import { getData, getSubtitleList, createSubtitle } from "./controller/data";
import {
  initSession,
  jumpToLine,
  nextLine,
  previousLine,
  currentIndex,
} from "./controller/subcontrol";
import { login, register, verify } from "./controller/verify";
import protect from "./helper/protect";

const router = Router();

router.get("/data", getData);
router.get("/subtitle-list", getSubtitleList);

router.post("/create-subtitle", protect, createSubtitle);

router.get("/subcontrol/init/:subId", initSession);
router.get("/subcontrol/next", nextLine);
router.get("/subcontrol/previous", previousLine);
router.get("/subcontrol/jump/:index", jumpToLine);
router.get("/subcontrol/current", currentIndex);

router.post("/verify", verify);
router.post("/register", register);
router.post("/login", login);

export default router;
