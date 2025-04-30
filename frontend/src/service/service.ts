
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

export const uploadAadhaarImages = async (front: File, back: File) => {
  const formData = new FormData();
  formData.append('front', front);
  formData.append('back', back);

  const response = await axios.post(`${API_URL}/aadhaar`, formData);
  return response.data;
};