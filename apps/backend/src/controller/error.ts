import { ErrorRequestHandler, RequestHandler } from "express";

export const notFound404: RequestHandler = (req, res, next) => {
  res.status(404).json({
    message: "Can't find service you have requested.",
    requestedService: req.path,
    method: req.method,
  });
};

export const centralError: ErrorRequestHandler = (err, req, res, next) => {
  const code = err.statusCode || 500;
  console.log(`${err.statusCode} - ${err.message}`);

  res.status(code).json({
    type: err.type || "general",
    modal: err.modal,
    location: err.location,
    message: err.message,
  });
};