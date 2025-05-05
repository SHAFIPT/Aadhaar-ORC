import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction): void => {
    console.error("Error:", err);

    // Default values
    let statusCode = 500;
    let message = "Internal Server Error";

    // Check for specific error types
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
    } else if (err instanceof Error) {
        message = err.message;
    }

    // If token-related error, clear cookies
    if (message.includes("Invalid Token") || message.includes("Unauthorized")) {      
        res.clearCookie("accessToken", { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
        res.clearCookie("refreshToken", { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    }

    // Send the response
    res.status(statusCode).json({
        success: false,
        message: message
    });
};