export interface AadhaarData {
  aadhaarNumber: string;
  name: string;
  dob: string;
  gender: string;
  address: string;
  pincode: string;
}

export interface IOcrService {
  performOCR(imagePath: string): Promise<string>;
  extractAadhaarData(frontText: string, backText: string): AadhaarData;
  processAadhaarImages(files: Express.Multer.File[]): Promise<string>;
}