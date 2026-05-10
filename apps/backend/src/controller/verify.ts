import type { RequestHandler } from "express";
import { centralError } from "./error";
import db from "../db/drizzle";
import { users } from "../db/schema";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const ALLOWCODES = ["5679", "PRODS", "NOVA"];

export const register: RequestHandler = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await db.query.users.findFirst({
      where: {
        email: email,
      },
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ message: "user already exists", registered: false });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await db.insert(users).values({
      name: name,
      email: email,
      password: hashedPassword,
    });

    return res
      .status(200)
      .json({ message: "registered", registered: true, user: newUser });
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

export const login: RequestHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const existingUser = await db.query.users.findFirst({
      where: {
        email: email,
      },
    });

    if (!existingUser) {
      return res
        .status(400)
        .json({ message: "user not found", loggedIn: false });
    }

    const isPasswordValid = bcrypt.compare(password, existingUser.password);
    if (!isPasswordValid) {
      return res
        .status(400)
        .json({ message: "invalid password", loggedIn: false });
    }

    const token = jwt.sign(
      { userId: existingUser.id, name: existingUser.name },
      process.env.JWT_SECRET!,
      {
        expiresIn: "1d",
      },
    );

    return res.status(200).json({
      message: "logged in",
      loggedIn: true,
      user: existingUser,
      token: token,
    });
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
        location: req.path,
      },
      req,
      res,
      next,
    );
  }
};
