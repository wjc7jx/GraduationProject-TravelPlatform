import { Router } from 'express';
import authRoutes from './authRoutes.js';
import projectRoutes from './projectRoutes.js';
import contentRoutes from './contentRoutes.js';
import uploadRoutes from './uploadRoutes.js';
import friendRoutes from './friendRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/projects', contentRoutes);
router.use('/upload', uploadRoutes);
router.use('/friends', friendRoutes);

export default router;
