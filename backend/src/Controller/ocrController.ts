import { Request, Response, NextFunction } from 'express';
import { IOcrService } from '../service/interface/IocrService';
import { HTTP_STATUS } from '../constants/httpStatus';

export class OcrController {
  constructor(private ocrService: IOcrService) {}

  public processOCR = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let files: Express.Multer.File[] = [];

    if (req.files && !(req.files instanceof Array)) {
      files = Object.values(req.files).flat();
    } else if (Array.isArray(req.files)) {
      files = req.files;
    }

    if (!files.length) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'No files uploaded'
      });
      return;
      }
      const formattedData = await this.ocrService.processAadhaarImages(files);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    next(error);
  }
};

}
