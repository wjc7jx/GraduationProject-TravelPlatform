import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import {
  uploadFile,
  uploadAndParsePhoto,
  uploadAndParseTrajectory,
  issueQiniuToken,
  parsePhotoFromUrl,
  parseTrajectoryFromUrl,
} from '../controllers/uploadController.js';
import { authMiddleware } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { isQiniuConfigured } from '../services/qiniuUploadToken.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.resolve(__dirname, '../../../uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({ storage: storage });
const router = Router();

router.use(authMiddleware);

router.post('/qiniu-token', issueQiniuToken);
router.post('/photo-parse', parsePhotoFromUrl);
router.post('/trajectory-parse', parseTrajectoryFromUrl);

const useLocalMulter = env.storageDriver !== 'qiniu';
if (useLocalMulter) {
  router.post('/', upload.single('file'), uploadFile);
  router.post('/photo', upload.single('file'), uploadAndParsePhoto);
  router.post('/trajectory', upload.single('file'), uploadAndParseTrajectory);
} else if (!isQiniuConfigured()) {
  console.warn('[upload] STORAGE_DRIVER=qiniu 但未完整配置 QINIU_*，上传接口将不可用');
}

export default router;
