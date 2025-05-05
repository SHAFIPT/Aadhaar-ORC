import dotenv from 'dotenv';
dotenv.config(); 
import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors'; // Importing the CORS package
import router from './routes/router';
import { errorHandler } from './middleware/errorHandling';

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.FRONT_END, 
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the MERN API' });
});

app.use('/api', router);
app.use(errorHandler);
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
