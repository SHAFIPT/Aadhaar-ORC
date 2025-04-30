import { Router } from "express";
import ocrRoutes from "./ocrRoutes";

const router = Router()

router.use('/', ocrRoutes);

export default router