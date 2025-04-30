import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS } from '../constants/httpStatus'; // adjust path as needed
import {  MESSAGES } from '../constants/messages'; // adjust path as needed
import config from '../config';

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', config.UPLOAD_PATH);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// File filter to validate file type
const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (config.ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(MESSAGES.ERROR.INVALID_FILE_TYPE));
  }
};

// Multer instance
const upload = multer({
  storage,
  limits: { fileSize: config.FILE_SIZE_LIMIT },
  fileFilter
});

// Middleware
export const handleFileUpload = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const uploadFields = upload.fields([
    { name: 'front', maxCount: 1 },
    { name: 'back', maxCount: 1 }
  ]);

  uploadFields(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: MESSAGES.ERROR.FILE_TOO_LARGE
        });
      }

      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: err.message || MESSAGES.ERROR.SERVER_ERROR
      });
    }

    // Ensure both files are uploaded
    if (!req.files || !('front' in req.files) || !('back' in req.files)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.ERROR.BOTH_IMAGES_REQUIRED
      });
    }

    next();
  });
};
