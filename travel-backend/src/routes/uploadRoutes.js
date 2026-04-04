import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { uploadFile, uploadAndParsePhoto, uploadAndParseTrajectory } from '../controllers/uploadController.js';
import { authMiddleware } from '../middleware/auth.js';

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({ storage: storage });
const router = Router();

router.use(authMiddleware);
router.post('/', upload.single('file'), uploadFile);
router.post('/photo', upload.single('file'), uploadAndParsePhoto);
router.post('/trajectory', upload.single('file'), uploadAndParseTrajectory);

export default router;