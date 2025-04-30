import fs from 'fs';
import { createWorker } from 'tesseract.js';
import { AadhaarData, IOcrService } from '../interface/IocrService';
import config from '../../config';

export class OcrService implements IOcrService {
  async performOCR(imagePath: string): Promise<string> {
    try {
      const worker = await createWorker(config.OCR_LANGUAGE);
      const { data: { text } } = await worker.recognize(imagePath);
      await worker.terminate();
      return text;
    } catch (error) {
      console.error('OCR processing error:', error);
      throw new Error('Failed to process image with OCR');
    }
  }

  extractAadhaarData(frontText: string, backText: string): AadhaarData {
    const data: AadhaarData = {
      aadhaarNumber: '',
      name: '',
      dob: '',
      gender: '',
      address: '',
      pincode: ''
    };

    // Extract Aadhaar number
    const aadhaarRegex = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
    const aadhaarMatch = frontText.match(aadhaarRegex);
    if (aadhaarMatch) data.aadhaarNumber = aadhaarMatch[0];

    // Improved name extraction
    // Look for name patterns in different formats
    let nameMatch = null;

    // Try to find a name that appears near "DOB" or gender indicators
    const nameBeforeDobRegex = /([A-Za-z\s]+)\s+(?:DOB|Date of Birth)\s*:/i;
    nameMatch = frontText.match(nameBeforeDobRegex);
    
    // If that fails, try to find a name pattern between common markers
    if (!nameMatch || !nameMatch[1] || nameMatch[1].trim().length < 3) {
      const fullNameRegex = /(?:[^\w\n]|^)([A-Za-z][A-Za-z\s]+(?:\s[A-Za-z]+){1,3})(?=\s+(?:DOB|Male|Female|S\/O|D\/O|W\/O|Year|\d{2}\/\d{2}\/\d{4}))/i;
      nameMatch = frontText.match(fullNameRegex);
    }
    
    // If still no match, try to look for a name with specific formatting
    if (!nameMatch || !nameMatch[1] || nameMatch[1].trim().length < 3) {
      // Look for specific patterns in the text like "he " Shahanas Shafi P T"
      const specificNameRegex = /he\s*"\s*([A-Za-z][A-Za-z\s]+(?:\s[A-Za-z]+){1,3})/i;
      nameMatch = frontText.match(specificNameRegex);
    }

    if (nameMatch && nameMatch[1]) {
      data.name = nameMatch[1].trim();
    }

    // Extract DOB
    const dobRegex = /(?:DOB|Date of Birth|Birth)\s*:?\s*(\d{2}[/-]\d{2}[/-]\d{4}|\d{2}[/-]\d{2}[/-]\d{2})/i;
    const dobMatch = frontText.match(dobRegex);
    if (dobMatch && dobMatch[1]) data.dob = dobMatch[1];

    // Extract gender
    const genderRegex = /\b(MALE|FEMALE|male|female|Male|Female)\b/;
    const genderMatch = frontText.match(genderRegex);
    if (genderMatch) data.gender = genderMatch[0];

    // Extract address and clean up OCR artifacts
    const addressLines = backText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 15 && line.includes(','));

    if (addressLines.length > 0) {
      // Get the longest address line
      let address = addressLines.sort((a, b) => b.length - a.length)[0];
      
      // Clean up common OCR artifacts
      address = address
        .replace(/^[=\-_\s]+/, '') // Remove leading special chars like "="
        .replace(/\s+AE\s+Seis$/i, '') // Remove "AE Seis" suffix
        .replace(/\s{2,}/g, ' ') // Replace multiple spaces with single space
        .replace(/[^\w\s,.-]/g, '') // Remove special characters except comma, period, hyphen
        .trim();
      
      data.address = address;
    }

    const pincodeRegex = /\b(\d{6})\b/;
    const pincodeMatch = backText.match(pincodeRegex);
    if (pincodeMatch) data.pincode = pincodeMatch[0];

    return data;
  }

  async processAadhaarImages(files: Express.Multer.File[]): Promise<string> {
    try {
      const frontImage = files.find(file => file.fieldname === 'front');
      const backImage = files.find(file => file.fieldname === 'back');

      if (!frontImage || !backImage) throw new Error("Both 'front' and 'back' images are required");
      
      const frontText = await this.performOCR(frontImage.path);
      const backText = await this.performOCR(backImage.path);

      const extractedData = this.extractAadhaarData(frontText, backText);

      fs.unlinkSync(frontImage.path);
      fs.unlinkSync(backImage.path);

      return Object.entries(extractedData).map(([key, value]) => {
        const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        return `${formattedKey}: ${value}`;
      }).join('\n');
    } catch (error) {
      console.error('Aadhaar processing error:', error);
      throw error;
    }
  }
}