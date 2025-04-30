import { Router } from 'express';
import { handleFileUpload } from '../middleware/fileUpload';
import { OcrService } from '../service/implimentions/ocrService';
import { OcrController } from '../Controller/ocrController';

const ocrRoutes = Router();

const ocrService = new OcrService();
const ocrController = new OcrController(ocrService);

ocrRoutes.post('/aadhaar', handleFileUpload, ocrController.processOCR);

export default ocrRoutes;