// Mock data (file trees, tasks) split out of constants.tsx.
import { FileNode, TaskItem } from "../uiTypes";

export const MOCK_FILE_TREE: FileNode[] = [
  // ... (Existing Mock File Tree - kept same)
  {
    id: 'root',
    name: 'wwwroot',
    type: 'folder',
    isOpen: true,
    children: [
      {
        id: 'laravel_db',
        name: 'laravel_db',
        type: 'folder',
        isOpen: true,
        children: [
          { id: 'static', name: 'static', type: 'folder', isOpen: true, children: [
            { id: 'img1', name: 'cyber_bg.jpg', type: 'file', fileType: 'image', size: '2.4 MB', date: '2025-01-10' },
            { id: 'aud1', name: 'alert_notification.mp3', type: 'file', fileType: 'audio', size: '150 KB', date: '2025-01-12' },
            { id: 'vid1', name: 'intro_sequence.mp4', type: 'file', fileType: 'video', size: '45 MB', date: '2025-01-15' },
            { id: 'doc1', name: 'readme.txt', type: 'file', fileType: 'text', size: '2 KB', date: '2025-01-05' },
            { id: 'code1', name: 'config.json', type: 'file', fileType: 'code', size: '5 KB', date: '2025-01-08' }
          ] }
        ]
      }
    ]
  }
];

export const MOCK_CODE_TREE: FileNode[] = [
    {
    id: 'core',
    name: 'core_node',
    type: 'folder',
    isOpen: true,
    children: []
    }
];

export const MOCK_TASKS: TaskItem[] = [
    { 
      id: 'task1', 
      title: 'Init System', 
      size: '1KB', 
      date: '2025-01-01', 
      status: 'done', 
      promptText: 'Initialize system core parameters and establish neural handshake protocol. Ensure all subsystems are green.', 
      audioSegments: [
        { id: 'seg1', text: "Initializing system core...", duration: 2.5 },
        { id: 'seg2', text: "Establishing neural handshake...", duration: 3.2 },
        { id: 'seg3', text: "Handshake complete. Subsystems green.", duration: 2.8 },
        { id: 'seg4', text: "System online.", duration: 1.5 }
      ] 
    }
];
