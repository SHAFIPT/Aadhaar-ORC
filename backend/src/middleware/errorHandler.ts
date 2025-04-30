import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS } from '../constants/httpStatus';
import { MESSAGES } from '../constants/messages';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error:', err.stack);

  // Remove any uploaded files if there's an error
  if (req.files) {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    for (const fieldName in files) {
      files[fieldName].forEach((file) => {
        try {
          fs.unlinkSync(file.path);
        } catch (error) {
          console.error(`Failed to delete file ${file.path}:`, error);
        }
      });
    }
  }

  const statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = err.message || MESSAGES.ERROR.SERVER_ERROR;

  res.status(statusCode).json({
    success: false,
    message: message,
  });
};
