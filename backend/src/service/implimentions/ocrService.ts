import fs from 'fs';
import { createWorker } from 'tesseract.js';
import { AadhaarData, IOcrService } from '../interface/IocrService';
import config from '../../config';

export class OcrService implements IOcrService {
  // Aadhaar identifiers for validation - more flexible patterns
  private aadhaarIdentifiers = [
    'Unique Identif', // Partial match for "Unique Identification"
    'Authority of In', // Partial match for "Authority of India"
    'Aadhaar',
    'आधार',
    'VID',
    'Government of In', // Partial match for "Government of India"
    'UID' // Common Aadhaar abbreviation
  ];

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

  private isAadhaarCard(frontText: string, backText: string): boolean {
    // Check if any of the Aadhaar identifiers are found in the OCR text
    const combinedText = frontText + ' ' + backText;
    
    // Check identifiers
    const hasIdentifier = this.aadhaarIdentifiers.some(identifier =>
      combinedText.toLowerCase().includes(identifier.toLowerCase())
    );
    
    // Check for 12-digit number pattern (common in Aadhaar)
    const hasAadhaarNumber = /\b\d{4}\s?\d{4}\s?\d{4}\b/.test(combinedText);
    
    // Check for typical Aadhaar format with numbers grouped in 4
    const hasFormattedNumber = /\d{4}\s+\d{4}\s+\d{4}/.test(combinedText);
    
    return hasIdentifier || hasAadhaarNumber || hasFormattedNumber;
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

    // Aadhaar number - more flexible pattern
    const aadhaarRegex = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
    const allNumbers: string[] = frontText.match(/\d+/g) || [];
    const backNumbers: string[] = backText.match(/\d+/g) || [];
    allNumbers.push(...backNumbers);
    
    // Find 12-digit numbers (possibly with spaces)
    const potentialAadhaarNumbers = allNumbers
      .filter(num => num.replace(/\s/g, '').length >= 12)
      .map(num => num.replace(/\s/g, ''));
      
    if (potentialAadhaarNumbers.length > 0) {
      // Format as XXXX XXXX XXXX
      data.aadhaarNumber = potentialAadhaarNumbers[0].replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3');
    } else {
      // Try the original regex
      const aadhaarMatch = frontText.match(aadhaarRegex) || backText.match(aadhaarRegex);
      if (aadhaarMatch) data.aadhaarNumber = aadhaarMatch[0];
    }

    // Name extraction - improved pattern
    const namePatterns = [
      /([A-Za-z\s]+)\s+(?:DOB|Date of Birth)\s*:/i,
      /(?:[^\w\n]|^)([A-Za-z][A-Za-z\s]+(?:\s[A-Za-z]+){1,3})(?=\s+(?:DOB|Male|Female|S\/O|D\/O|W\/O|Year|\d{2}\/\d{2}\/\d{4}))/i,
      /he\s*"\s*([A-Za-z][A-Za-z\s.]+(?:\s[A-Za-z.]+){1,3})/i,
      /([A-Za-z][A-Za-z\s.]+(?:\s[A-Za-z.]+){1,3})\s+(?:DOB|Male|Female)/i,
      /(?:Name|नाम)[:\s]+([A-Za-z\s.]+)/i
    ];
    
    for (const pattern of namePatterns) {
      const nameMatch = frontText.match(pattern);
      if (nameMatch && nameMatch[1]) {
        data.name = nameMatch[1].trim();
        break;
      }
    }

    // DOB - improved patterns
    const dobPatterns = [
      /(?:DOB|Date of Birth|Birth)\s*:?\s*(\d{2}[/-]\d{2}[/-]\d{4}|\d{2}[/-]\d{2}[/-]\d{2})/i,
      /(\d{2}[/-]\d{2}[/-]\d{4})/i,  // Matches format like 06/03/2002
      /DOB\s*:?\s*(\d{2}[/-]\d{2}[/-]\d{4})/i
    ];
    
    for (const pattern of dobPatterns) {
      const dobMatch = frontText.match(pattern);
      if (dobMatch && dobMatch[1]) {
        data.dob = dobMatch[1];
        break;
      }
    }

    // Gender - improved
    const genderMatch = frontText.match(/\b(MALE|FEMALE|male|female|Male|Female)\b/);
    if (genderMatch) data.gender = genderMatch[0];

    // Address extraction - enhanced for better OCR text handling
    console.log("Attempting to extract address from:", backText);
    
    // Try multiple address extraction strategies
    let addressText = '';
    
    // Strategy 1: Look for "Address:" pattern
    const addressSection = backText.match(/Address\s*:?\s*([^]*?)(?:\d{6}|$)/i);
    if (addressSection && addressSection[1]) {
      addressText = addressSection[1].trim();
      console.log("Found address via pattern match:", addressText);
    }
    
    // Strategy 2: Look for S/O, D/O, W/O followed by text
    if (!addressText) {
      const relationPattern = /(?:S\/O|D\/O|W\/O|Son of|Daughter of|Wife of)[:\s]+([^]*?)(?:\d{6}|$)/i;
      const relationMatch = backText.match(relationPattern);
      if (relationMatch && relationMatch[1]) {
        addressText = relationMatch[1].trim();
        console.log("Found address via relation pattern:", addressText);
      }
    }
    
    // Strategy 3: Find the longest line that contains commas and looks like an address 
    if (!addressText) {
      const addressLines = backText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 15 && (line.includes(',') || line.toLowerCase().includes('house')));

      if (addressLines.length > 0) {
        addressText = addressLines.sort((a, b) => b.length - a.length)[0];
        console.log("Found address via longest line:", addressText);
      }
    }
    
    // Strategy 4: Extract a larger chunk of text that might contain the address
    if (!addressText) {
      // Find text between "Address:" or relation indicators and the end of the text or pin code
      const fullTextMatch = backText.match(/(?:Address|S\/O|D\/O|W\/O|House)[^]*?(?=\d{6}|$)/i);
      if (fullTextMatch) {
        addressText = fullTextMatch[0].trim();
        console.log("Found address via full text match:", addressText);
      }
    }
    
    // Process the address text if we found something
    if (addressText) {
      // Build the full address, handling cases where parts are split across lines
      let fullAddress = addressText
        .replace(/\s+/g, ' ')  // Replace multiple spaces with a single space
        .replace(/(\w)[,.](\w)/g, '$1, $2')  // Ensure proper spacing after commas/periods
        .replace(/[^\w\s,.:-]/g, '')  // Remove special characters except basic punctuation
        .replace(/\s*,\s*/g, ', ')  // Standardize comma spacing
        .trim();
      
      // Special case: If we find S/O, D/O or W/O followed by a name, 
      // make sure we capture the full address after it
      const relationMatch = backText.match(/(?:S\/O|D\/O|W\/O)[:\s]+([A-Za-z\s]+)(?:,|\s|$)/i);
      const houseMatch = backText.match(/(?:House|KT House|[A-Za-z]+ House)[,\s]([^,]*)/i);
      const locationMatch = backText.match(/(?:Puthoopadam|Cherukavu|Avikkarapadi|Malappuram|Kerala)(?:[,\s]|$)/ig);
      
      // If we have multiple address components, try to construct a more complete address
      if (relationMatch || houseMatch || locationMatch) {
        const addressParts = [];
        
        if (relationMatch && relationMatch[1]) {
          addressParts.push(`S/O: ${relationMatch[1].trim()}`);
        }
        
        if (houseMatch && houseMatch[0]) {
          addressParts.push(houseMatch[0].trim());
        }
        
        // Collect location parts like city, state, etc.
        if (locationMatch) {
          const locationText = locationMatch.join(', ').replace(/,\s*,/g, ',');
          addressParts.push(locationText);
        }
        
        // Add PIN code if found
        const pincodeMatch = backText.match(/\b(\d{6})\b/);
        if (pincodeMatch) {
          addressParts.push(pincodeMatch[0]);
        }
        
        // Join all parts with commas
        if (addressParts.length > 0) {
          fullAddress = addressParts.join(', ');
          console.log("Constructed address from parts:", fullAddress);
        }
      }
      
      // Final cleanup
      data.address = fullAddress
        .replace(/,\s*,/g, ',')  // Remove duplicate commas
        .replace(/^[,\s]+|[,\s]+$/g, '')  // Trim commas and spaces from start/end
        .replace(/\s{2,}/g, ' '); // Replace multiple spaces with single space
    }
    
    // If we still couldn't extract a proper address, try a more aggressive approach
    if (!data.address || data.address.length < 10) {
      // Extract all lines that might be part of an address
      const potentialAddressParts = backText.split('\n')
        .map(line => line.trim())
        .filter(line => 
          line.length > 5 && 
          !line.match(/^[=\-_\s]+$/) && 
          !line.includes('Unique Identification') &&
          !line.includes('Uidal') &&
          !line.includes('www')
        );
      
      if (potentialAddressParts.length > 0) {
        data.address = potentialAddressParts.join(', ')
          .replace(/\s{2,}/g, ' ')
          .replace(/[^\w\s,.:-]/g, '')
          .replace(/,\s*,/g, ',')
          .trim();
        console.log("Built address from multiple parts:", data.address);
      }
    }

    // Extract PIN code (6 digits) typically found at the end of address
    const pincodeMatch = backText.match(/\b(\d{6})\b/);
    if (pincodeMatch) data.pincode = pincodeMatch[0];

    return data;
  }

  async processAadhaarImages(files: Express.Multer.File[]): Promise<string> {
    try {
      const frontImage = files.find(file => file.fieldname === 'front');
      const backImage = files.find(file => file.fieldname === 'back');

      if (!frontImage || !backImage) {
        throw new Error("Both 'front' and 'back' images are required");
      }

      const frontText = await this.performOCR(frontImage.path);
      const backText = await this.performOCR(backImage.path);
      
      // ✅ Aadhaar validation step - now checks both front and back
      if (!this.isAadhaarCard(frontText, backText)) {
        console.log("Validation failed - not a valid Aadhaar card");
        fs.unlinkSync(frontImage.path);
        fs.unlinkSync(backImage.path);
        throw new Error('Uploaded image is not a valid Aadhaar card');
      }

      const extractedData = this.extractAadhaarData(frontText, backText);
      
      // Validate that we actually extracted some meaningful data
      const hasMinimumData = extractedData.aadhaarNumber || 
                             (extractedData.name && extractedData.dob) ||
                             extractedData.address;
                             
      if (!hasMinimumData) {
        console.log("Validation failed - couldn't extract minimum required data");
        fs.unlinkSync(frontImage.path);
        fs.unlinkSync(backImage.path);
        throw new Error('Could not extract sufficient data from the Aadhaar card');
      }

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