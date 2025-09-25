// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import type { Plugin } from 'vite';
import { spawn } from 'child_process';
import { WebSocketServer } from 'ws';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

interface CompressionSession {
  ws: any;
  settings: any;
  options: any;
  fileName: string;
  fileSize: number;
}

const activeCompressions = new Map<string, CompressionSession>();

export function videoCompressionPlugin(): Plugin {
  return {
    name: 'video-compression',
    configureServer(server) {
      const wss = new WebSocketServer({ 
        server: server.httpServer,
        path: '/ws/video-compression'
      });
      
      // Configure multer for video uploads
      const storage = multer.diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = path.join(process.cwd(), 'uploads');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
          const compressionId = req.body.compressionId;
          const ext = path.extname(file.originalname);
          cb(null, `${compressionId}${ext}`);
        }
      });

      const upload = multer({ 
        storage,
        limits: {
          fileSize: 1024 * 1024 * 1024 // 1GB limit
        }
      });

      // WebSocket connection handling
      wss.on('connection', (ws) => {
        console.log('Video compression WebSocket client connected');
        
        ws.on('message', (message) => {
          try {
            const data = JSON.parse(message.toString());
            
            if (data.type === 'start_compression') {
              const compressionId = data.id;
              activeCompressions.set(compressionId, {
                ws,
                settings: data.settings,
                options: data.options,
                fileName: data.fileName,
                fileSize: data.fileSize
              });
              
              console.log(`Started compression for ${data.fileName}`);
            }
          } catch (error) {
            console.error('WebSocket message error:', error);
          }
        });
        
        ws.on('close', () => {
          console.log('Video compression WebSocket client disconnected');
        });
      });

      // Video upload endpoint
      server.middlewares.use('/api/video-compression/upload', upload.single('video'), (req, res) => {
        const compressionId = req.body.compressionId;
        const file = req.file;
        
        if (!file) {
          return res.status(400).json({ error: 'No video file uploaded' });
        }
        
        const compression = activeCompressions.get(compressionId);
        if (!compression) {
          return res.status(400).json({ error: 'Compression session not found' });
        }
        
        // Start video compression
        compressVideo(file.path, compression, compressionId);
        
        res.json({ 
          success: true, 
          message: 'Video uploaded and compression started',
          compressionId 
        });
      });

      // Download endpoint
      server.middlewares.use('/api/video-compression/download/:compressionId', (req, res) => {
        const compressionId = req.params.compressionId;
        const outputDir = path.join(process.cwd(), 'outputs');
        
        // Find the compressed file
        const files = fs.readdirSync(outputDir);
        const compressedFile = files.find(file => file.startsWith(compressionId));
        
        if (compressedFile) {
          const filePath = path.join(outputDir, compressedFile);
          res.download(filePath, compressedFile, (err) => {
            if (!err) {
              // Clean up file after download
              setTimeout(() => {
                if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath);
                }
              }, 5000);
            }
          });
        } else {
          res.status(404).json({ error: 'Compressed file not found' });
        }
      });

      // Health check endpoint
      server.middlewares.use('/api/health', (req, res) => {
        res.json({ 
          status: 'ok', 
          activeCompressions: activeCompressions.size,
          ffmpegAvailable: true
        });
      });

      function compressVideo(inputPath: string, compression: CompressionSession, compressionId: string) {
        const { settings, options, ws } = compression;
        const outputPath = path.join(process.cwd(), 'outputs', `${compressionId}.${options.format}`);
        
        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Build ffmpeg command
        const ffmpegArgs = [
          '-i', inputPath,
          '-vf', `scale=${settings.width}:${settings.height}`,
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', Math.max(18, 51 - settings.quality),
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart',
          '-y', // Overwrite output file
          outputPath
        ];
        
        console.log('FFmpeg command:', 'ffmpeg', ffmpegArgs.join(' '));
        
        const ffmpeg = spawn('ffmpeg', ffmpegArgs);
        
        let progress = 0;
        let duration = 0;
        
        // Parse ffmpeg output for progress
        ffmpeg.stderr.on('data', (data) => {
          const output = data.toString();
          
          // Extract duration
          const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
          if (durationMatch && duration === 0) {
            duration = parseInt(durationMatch[1]) * 3600 + 
                       parseInt(durationMatch[2]) * 60 + 
                       parseInt(durationMatch[3]) + 
                       parseInt(durationMatch[4]) / 100;
          }
          
          // Extract current time
          const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
          if (timeMatch && duration > 0) {
            const currentTime = parseInt(timeMatch[1]) * 3600 + 
                               parseInt(timeMatch[2]) * 60 + 
                               parseInt(timeMatch[3]) + 
                               parseInt(timeMatch[4]) / 100;
            
            const newProgress = Math.round((currentTime / duration) * 100);
            if (newProgress !== progress) {
              progress = newProgress;
              
              // Send progress update via WebSocket
              if (ws.readyState === 1) { // WebSocket.OPEN
                ws.send(JSON.stringify({
                  type: 'progress',
                  id: compressionId,
                  progress: progress
                }));
              }
            }
          }
        });
        
        ffmpeg.on('close', (code) => {
          if (code === 0) {
            // Compression successful
            const stats = fs.statSync(outputPath);
            const downloadUrl = `/api/video-compression/download/${compressionId}`;
            
            if (ws.readyState === 1) { // WebSocket.OPEN
              ws.send(JSON.stringify({
                type: 'complete',
                id: compressionId,
                compressedSize: stats.size,
                downloadUrl: downloadUrl
              }));
            }
            
            // Clean up input file
            fs.unlinkSync(inputPath);
            activeCompressions.delete(compressionId);
            
            console.log(`Compression completed for ${compressionId}`);
          } else {
            // Compression failed
            if (ws.readyState === 1) { // WebSocket.OPEN
              ws.send(JSON.stringify({
                type: 'error',
                id: compressionId,
                error: 'FFmpeg compression failed'
              }));
            }
            
            // Clean up files
            if (fs.existsSync(inputPath)) {
              fs.unlinkSync(inputPath);
            }
            if (fs.existsSync(outputPath)) {
              fs.unlinkSync(outputPath);
            }
            activeCompressions.delete(compressionId);
            
            console.error(`Compression failed for ${compressionId} with code ${code}`);
          }
        });
        
        ffmpeg.on('error', (error) => {
          console.error('FFmpeg error:', error);
          
          if (ws.readyState === 1) { // WebSocket.OPEN
            ws.send(JSON.stringify({
              type: 'error',
              id: compressionId,
              error: 'FFmpeg process error'
            }));
          }
          
          activeCompressions.delete(compressionId);
        });
      }
    }
  };
} 