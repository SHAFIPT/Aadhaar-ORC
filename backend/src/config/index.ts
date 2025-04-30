const config = {
  PORT: process.env.PORT || 5000,
  FILE_SIZE_LIMIT: 5 * 1024 * 1024, // 5MB
  UPLOAD_PATH: 'uploads',
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/jpg'],
  OCR_LANGUAGE: 'eng'
};

export default config;