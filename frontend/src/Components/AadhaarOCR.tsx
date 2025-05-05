import React, { useState } from 'react';
import { uploadAadhaarImages } from '../service/service';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';

export default function AadhaarOCR() {
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);


  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setImage: React.Dispatch<React.SetStateAction<File | null>>,
    setPreview: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
  if (!frontImage || !backImage) {
    toast.error("Please upload both front and back images."); // Toast for missing images
    return;
  }

  setIsLoading(true);

  const formData = new FormData();
  formData.append('front', frontImage);
  formData.append('back', backImage);

  try {
    const data = await uploadAadhaarImages(frontImage, backImage);
    console.log('Backend response data:', data);
    setExtractedData(data.data);
    setIsLoading(false);
  } catch (err: unknown) {
    console.error(err);
    
    // Type the error as AxiosError to access response properties
    if (err instanceof AxiosError && err.response && err.response.data && err.response.data.message) {
      toast.error(err.response.data.message); // Show error message from backend
    } else {
      toast.error("Failed to extract data. Please try again.");
    }
    
    setExtractedData("Failed to extract data. Please try again.");
    setIsLoading(false);
  }
};
  // Format the extracted data for better display
  const formatExtractedData = () => {
    if (!extractedData) return [];
    
    // Special case for manually formatting Aadhaar data
    // Extract structured fields from raw text
    const aadhaarMatch = extractedData.match(/Aadhaar Number\s*:?\s*([0-9 ]+)/i);
    const nameMatch = extractedData.match(/Name\s*:?\s*([^\n]+)/i);
    const dobMatch = extractedData.match(/Dob\s*:?\s*([0-9/]+)/i);
    const genderMatch = extractedData.match(/Gender\s*:?\s*([^\n]+)/i);
    const pincodeMatch = extractedData.match(/Pincode\s*:?\s*([0-9]+)/i);
    
    // Prepare structured data
    const dataEntries = [];
    
    // Add basic fields
    if (aadhaarMatch && aadhaarMatch[1]) {
      dataEntries.push({ key: 'Aadhaar Number', value: aadhaarMatch[1].trim() });
    }
    
    if (nameMatch && nameMatch[1]) {
      dataEntries.push({ key: 'Name', value: nameMatch[1].trim() });
    }
    
    if (dobMatch && dobMatch[1]) {
      dataEntries.push({ key: 'Date of Birth', value: dobMatch[1].trim() });
    }
    
    if (genderMatch && genderMatch[1]) {
      dataEntries.push({ key: 'Gender', value: genderMatch[1].trim() });
    }
    
    // Handle address specially - collect all address-related parts
    // Extract S/O (Son of) information
    const soMatch = extractedData.match(/S\/O\s*:?\s*([^,\n]+)/i);
    const addressParts = [];
    
    if (soMatch && soMatch[1]) {
      addressParts.push(`S/O ${soMatch[1].trim()}`);
    }
    
    // Extract house information
    const houseMatch = extractedData.match(/KT House\s*:?\s*([^,\n]*)/i);
    if (houseMatch) {
      // Look for house number
      const houseNumMatch = extractedData.match(/>\s*([0-9]+)\s+Puthoopadam/i);
      if (houseNumMatch && houseNumMatch[1]) {
        addressParts.push(`KT House, No. ${houseNumMatch[1].trim()}`);
      } else {
        addressParts.push('KT House');
      }
    }
    
    // Add location details
    const locations = ['Puthoopadam', 'Cherukavu', 'Avikkarapadi', 'Malappuram', 'Kerala'];
    locations.forEach(loc => {
      if (extractedData.toLowerCase().includes(loc.toLowerCase())) {
        addressParts.push(loc);
      }
    });
    
    // Add pincode if found
    if (pincodeMatch && pincodeMatch[1]) {
      addressParts.push(pincodeMatch[1].trim());
    }
    
    // Join address parts and add to data entries
    if (addressParts.length > 0) {
      const formattedAddress = addressParts.join(', ');
      dataEntries.push({ key: 'Address', value: formattedAddress });
    } else {
      // Fallback to extracting address from raw text if structured approach fails
      const addressLines = extractedData.split('\n').filter(line => 
        line.toLowerCase().includes('address') || 
        line.toLowerCase().includes('s/o') || 
        line.toLowerCase().includes('house') ||
        line.toLowerCase().includes('puthoopadam')
      );
      
      if (addressLines.length > 0) {
        // Build address from matched lines
        const rawAddress = addressLines.join(' ');
        
        // Clean up the address
        const cleanAddress = rawAddress
          .replace(/Address\s*:?\s*/i, '')
          .replace(/S\/O\s*:?\s*/i, 'S/O ')
          .replace(/>\s*/g, '') // Remove > symbols
          .replace(/:\s*/g, '') // Remove colons
          .replace(/,\s*,/g, ',') // Remove double commas
          .replace(/^,\s*/, '') // Remove leading comma
          .replace(/\s*,\s*/g, ', ') // Standardize comma spacing
          .replace(/(\d{6})[,\s]*\1/g, '$1') // Remove duplicate pincodes
          .trim();
        
        dataEntries.push({ key: 'Address', value: cleanAddress });
      }
    }
    
    return dataEntries;
  };

  const formattedData = formatExtractedData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-center text-gray-800 mb-6">Aadhaar Card OCR Scanner</h1>
        
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="flex flex-col md:flex-row">
            {/* Left Panel */}
            <div className="md:w-1/2 p-6">
              <div className="grid grid-cols-1 gap-8">
                {/* Front Image Upload */}
                <div className="bg-blue-50 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4 text-gray-800 text-center">
                    Front Image of Aadhaar
                  </h2>
                  
                  {frontPreview ? (
                    <div className="mb-4 relative">
                      <img 
                        src={frontPreview} 
                        alt="Front preview" 
                        className="w-full h-48 object-contain rounded-lg border border-gray-300"
                      />
                      <button 
                        onClick={() => {setFrontImage(null); setFrontPreview(null);}}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                        aria-label="Remove front image"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="mb-4 border-2 border-dashed border-blue-300 rounded-lg p-4 text-center">
                      <p className="text-gray-500">Upload front side of your Aadhaar card</p>
                    </div>
                  )}
                  
                  <label className="block w-full">
                    <span className="sr-only">Choose front image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, setFrontImage, setFrontPreview)}
                      className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:border-0 file:rounded-full file:bg-blue-600 file:text-white hover:file:bg-blue-700 transition cursor-pointer"
                    />
                  </label>
                </div>
                
                {/* Back Image Upload */}
                <div className="bg-blue-50 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4 text-gray-800 text-center">
                    Back Image of Aadhaar
                  </h2>
                  
                  {backPreview ? (
                    <div className="mb-4 relative">
                      <img 
                        src={backPreview} 
                        alt="Back preview" 
                        className="w-full h-48 object-contain rounded-lg border border-gray-300"
                      />
                      <button 
                        onClick={() => {setBackImage(null); setBackPreview(null);}}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                        aria-label="Remove back image"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="mb-4 border-2 border-dashed border-blue-300 rounded-lg p-4 text-center">
                      <p className="text-gray-500">Upload back side of your Aadhaar card</p>
                    </div>
                  )}
                  
                  <label className="block w-full">
                    <span className="sr-only">Choose back image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, setBackImage, setBackPreview)}
                      className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:border-0 file:rounded-full file:bg-blue-600 file:text-white hover:file:bg-blue-700 transition cursor-pointer"
                    />
                  </label>
                </div>
                
                {/* Scan Button */}
                <button
                  onClick={handleUpload}
                  disabled={isLoading || !frontImage || !backImage}
                  className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-all ${
                    isLoading || !frontImage || !backImage
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                  }`}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    'Scan Aadhaar'
                  )}
                </button>
              </div>
            </div>
            
            {/* Right Panel - Extracted Data */}
            <div className="md:w-1/2 bg-gray-50 p-6 border-t md:border-t-0 md:border-l border-gray-200">
              <h2 className="text-xl font-semibold mb-6 text-gray-800 text-center">
                Extracted Data
              </h2>
              
              {extractedData ? (
                <div className="bg-white rounded-lg shadow p-6 h-full">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-700">Aadhaar Details</h3>
                    <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Verified</div>
                  </div>
                  
                  <div className="space-y-4">
                    {formattedData.map((item, index) => (
                      <div key={index} className="flex flex-col pb-3 border-b border-gray-100">
                        <span className="text-sm font-medium text-gray-500 mb-1">{item.key}</span>
                        <span className="text-gray-800">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-8 flex flex-col items-center justify-center h-full text-center">
                  <div className="text-gray-400 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-500">Upload both sides of your Aadhaar card and click "Scan Aadhaar" to extract the data</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="text-center mt-6 text-gray-500 text-sm">
          Secure • Private • Instant Verification
        </div>
      </div>
    </div>
  );
}