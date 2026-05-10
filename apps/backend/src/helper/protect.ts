import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export default function protect(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.log("protect");

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
    userId: number;
    name: string;
  };

  req.user = {
    userId: decoded.userId,
    name: decoded.name,
  };
  next();
}
