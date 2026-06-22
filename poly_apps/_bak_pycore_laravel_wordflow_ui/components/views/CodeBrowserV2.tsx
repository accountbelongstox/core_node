import React, { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { Language, AsyncState, FileNode as ServerFileNode, FilePreview, TaskCategory, DispatchTask } from '../../types';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  File,
  X,
  Plus,
  RefreshCw,
  Trash2,
  Save,
  Edit,
  Download,
  Search,
  ChevronRight,
  ChevronDown,
  Loader2,
  AlertCircle,
  Eye,
  PlayCircle,
  User,
  Lock,
  Unlock
} from 'lucide-react';
import { commonClasses } from '../../styles/theme';

interface CodeBrowserProps {
  lang?: Language;
}

interface FileTreeNode extends ServerFileNode {
  isOpen?: boolean;
  children?: FileTreeNode[];
}

interface AuthState {
  isAuthenticated: boolean;
  username?: string;
  token?: string;
}

const CodeBrowserV2: React.FC<CodeBrowserProps> = ({ lang = 'en' }) => {
  // Authentication state
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false
  });
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState<string | null>(null);

  // File browsing state
  const [rootPath, setRootPath] = useState<string>('');
  const [fileTree, setFileTree] = useState<AsyncState<FileTreeNode[]>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [selectedFile, setSelectedFile] = useState<FileTreeNode | null>(null);
  const [fileContent, setFileContent] = useState<AsyncState<FilePreview>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });

  // Editor state
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Task management state
  const [tasks, setTasks] = useState<AsyncState<TaskCategory[]>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryTasks, setCategoryTasks] = useState<AsyncState<DispatchTask[]>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [activeTask, setActiveTask] = useState<DispatchTask | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTree, setFilteredTree] = useState<FileTreeNode[]>([]);

  // Load initial data
  useEffect(() => {
    checkAuthStatus();
    loadPathConfig();
  }, []);

  useEffect(() => {
    if (auth.isAuthenticated && rootPath) {
      loadFileTree();
      loadTaskCategories();
    }
  }, [auth.isAuthenticated, rootPath]);

  // NO try-catch allowed
  const loadPathConfig = async () => {
    const response = await api.systemConfig.getPathMapping('code_browser');
    if (response.success && response.data) {
      setRootPath(response.data.path);
    }
  };

  useEffect(() => {
    if (selectedCategory) {
      loadCategoryTasks(selectedCategory);
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (fileTree.data) {
      if (searchQuery) {
        setFilteredTree(filterTree(fileTree.data, searchQuery));
      } else {
        setFilteredTree(fileTree.data);
      }
    }
  }, [searchQuery, fileTree.data]);

  const checkAuthStatus = () => {
    const savedAuth = localStorage.getItem('codebrowser_auth');
    if (savedAuth) {
      try {
        const auth = JSON.parse(savedAuth);
        setAuth(auth);
      } catch (error) {
        console.error('Failed to parse saved auth:', error);
      }
    }
  };

  const handleLogin = async () => {
    setAuthError(null);
    try {
      // Mock authentication - replace with actual API call
      if (authForm.username && authForm.password) {
        const authData = {
          isAuthenticated: true,
          username: authForm.username,
          token: 'mock-token-' + Date.now()
        };
        setAuth(authData);
        localStorage.setItem('codebrowser_auth', JSON.stringify(authData));
      } else {
        setAuthError('Please enter username and password');
      }
    } catch (error: any) {
      setAuthError(error.message || 'Authentication failed');
    }
  };

  const handleLogout = () => {
    setAuth({ isAuthenticated: false });
    localStorage.removeItem('codebrowser_auth');
    setFileTree({ data: null, loading: false, error: null, status: 'idle' });
    setSelectedFile(null);
    setFileContent({ data: null, loading: false, error: null, status: 'idle' });
  };

  const loadFileTree = async () => {
    setFileTree(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManagerV1.browseFiles(rootPath);
      if (response.success && response.data) {
        const treeData = buildFileTree(response.data);
        setFileTree({
          data: treeData,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || 'Failed to load file tree');
      }
    } catch (error: any) {
      setFileTree({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const buildFileTree = (nodes: ServerFileNode[]): FileTreeNode[] => {
    return nodes.map(node => ({
      ...node,
      isOpen: false,
      children: node.children ? buildFileTree(node.children) : undefined
    }));
  };

  const toggleNode = (path: string) => {
    setFileTree(prev => ({
      ...prev,
      data: prev.data ? toggleNodeRecursive(prev.data, path) : null
    }));
  };

  const toggleNodeRecursive = (nodes: FileTreeNode[], targetPath: string): FileTreeNode[] => {
    return nodes.map(node => {
      if (node.path === targetPath) {
        return { ...node, isOpen: !node.isOpen };
      }
      if (node.children) {
        return {
          ...node,
          children: toggleNodeRecursive(node.children, targetPath)
        };
      }
      return node;
    });
  };

  const filterTree = (nodes: FileTreeNode[], query: string): FileTreeNode[] => {
    const lowerQuery = query.toLowerCase();
    return nodes.filter(node => {
      if (node.name.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      if (node.children) {
        const filteredChildren = filterTree(node.children, query);
        return filteredChildren.length > 0;
      }
      return false;
    }).map(node => ({
      ...node,
      children: node.children ? filterTree(node.children, query) : undefined,
      isOpen: true // Auto-expand when searching
    }));
  };

  const handleFileSelect = async (file: FileTreeNode) => {
    if (file.type === 'directory') {
      toggleNode(file.path);
      return;
    }

    setSelectedFile(file);
    setIsEditing(false);
    setFileContent(prev => ({ ...prev, loading: true, status: 'loading' }));

    try {
      const response = await api.serverManagerV1.previewFile(file.path);
      if (response.success && response.data) {
        setFileContent({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
        setEditedContent(response.data.content);
      } else {
        throw new Error(response.error || 'Failed to load file content');
      }
    } catch (error: any) {
      setFileContent({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const handleSaveFile = async () => {
    if (!selectedFile || !isEditing) return;

    setSaveStatus('saving');
    try {
      // Mock save - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update file content
      setFileContent(prev => ({
        ...prev,
        data: prev.data ? { ...prev.data, content: editedContent } : null
      }));

      setIsEditing(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error: any) {
      setSaveStatus('error');
      alert('Failed to save file: ' + error.message);
    }
  };

  const loadTaskCategories = async () => {
    setTasks(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManagerV1.getTaskCategories();
      if (response.success && response.data) {
        setTasks({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || 'Failed to load task categories');
      }
    } catch (error: any) {
      setTasks({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const loadCategoryTasks = async (category: string) => {
    setCategoryTasks(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManagerV1.getCategoryTasks(category);
      if (response.success && response.data) {
        setCategoryTasks({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || 'Failed to load category tasks');
      }
    } catch (error: any) {
      setCategoryTasks({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const handleExecuteTask = async (task: DispatchTask) => {
    setActiveTask(task);
    // Mock execution - replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    alert(`Task "${task.name}" executed successfully!`);
    setActiveTask(null);
  };

  const renderFileIcon = (node: FileTreeNode) => {
    if (node.type === 'directory') {
      return node.isOpen ? (
        <FolderOpen className="w-4 h-4 text-yellow-500" />
      ) : (
        <Folder className="w-4 h-4 text-yellow-500" />
      );
    }

    const ext = node.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
        return <FileCode className="w-4 h-4 text-blue-500" />;
      case 'json':
      case 'md':
      case 'txt':
        return <FileText className="w-4 h-4 text-gray-500" />;
      default:
        return <File className="w-4 h-4 text-gray-500" />;
    }
  };

  const renderFileTree = (nodes: FileTreeNode[], depth: number = 0) => {
    return nodes.map(node => (
      <div key={node.path}>
        <div
          onClick={() => handleFileSelect(node)}
          className={`flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors ${
            selectedFile?.path === node.path ? 'bg-indigo-100 dark:bg-indigo-900/30' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {node.type === 'directory' && (
            <span className="text-gray-500">
              {node.isOpen ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </span>
          )}
          {renderFileIcon(node)}
          <span className="text-sm font-mono truncate">{node.name}</span>
          {node.size && (
            <span className="text-xs text-gray-500 ml-auto">
              {formatFileSize(node.size)}
            </span>
          )}
        </div>
        {node.isOpen && node.children && renderFileTree(node.children, depth + 1)}
      </div>
    ));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Authentication screen
  if (!auth.isAuthenticated) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className={`${commonClasses.card} p-8 max-w-md w-full`}>
          <div className="text-center mb-6">
            <Lock className="w-12 h-12 mx-auto mb-4 text-indigo-500" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Code Browser Authentication
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Please sign in to access file browsing
            </p>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {authError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Username
              </label>
              <input
                type="text"
                value={authForm.username}
                onChange={(e) => setAuthForm(prev => ({ ...prev, username: e.target.value }))}
                className={commonClasses.input}
                placeholder="Enter username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={authForm.password}
                onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                className={commonClasses.input}
                placeholder="Enter password"
              />
            </div>
            <button
              onClick={handleLogin}
              className={`w-full ${commonClasses.button} ${commonClasses.buttonPrimary} py-3`}
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Code Browser</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Browse, view, and edit files in your project
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {auth.username}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
          >
            <Unlock className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Left Sidebar - Task Queue */}
        <div className={`w-72 flex-shrink-0 ${commonClasses.card} p-4 flex flex-col overflow-hidden`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Tasks</h3>
            <div className="flex gap-2">
              <button
                onClick={loadTaskCategories}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${tasks.loading ? 'animate-spin' : ''}`} />
              </button>
              <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Add Task">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {tasks.loading ? (
            <div className="flex items-center justify-center flex-1">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : tasks.error ? (
            <div className="text-sm text-red-600 dark:text-red-400">{tasks.error}</div>
          ) : tasks.data && tasks.data.length > 0 ? (
            <div className="flex-1 overflow-y-auto space-y-2">
              {tasks.data.map(category => (
                <div key={category.name}>
                  <button
                    onClick={() => setSelectedCategory(
                      selectedCategory === category.name ? null : category.name
                    )}
                    className="w-full flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <span className="text-sm font-medium">{category.name}</span>
                    <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
                      {category.count}
                    </span>
                  </button>

                  {selectedCategory === category.name && categoryTasks.data && (
                    <div className="mt-2 space-y-1 pl-2">
                      {categoryTasks.data.map(task => (
                        <div
                          key={task.id}
                          className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm"
                        >
                          <div className="font-medium text-gray-900 dark:text-white mb-1">
                            {task.name}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                            {task.description}
                          </div>
                          <button
                            onClick={() => handleExecuteTask(task)}
                            disabled={activeTask?.id === task.id}
                            className={`text-xs ${commonClasses.button} ${commonClasses.buttonPrimary} w-full flex items-center justify-center gap-1`}
                          >
                            {activeTask?.id === task.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <PlayCircle className="w-3 h-3" />
                            )}
                            Execute
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              No tasks available
            </div>
          )}
        </div>

        {/* Middle - File Tree */}
        <div className={`w-80 flex-shrink-0 ${commonClasses.card} p-4 flex flex-col overflow-hidden`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Files</h3>
            <button
              onClick={loadFileTree}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${fileTree.loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Search */}
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className={`${commonClasses.input} pl-10`}
            />
          </div>

          {/* Root Path */}
          <div className="mb-2 text-xs text-gray-600 dark:text-gray-400 font-mono truncate">
            {rootPath}
          </div>

          {/* File Tree */}
          <div className="flex-1 overflow-y-auto">
            {fileTree.loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            ) : fileTree.error ? (
              <div className="text-sm text-red-600 dark:text-red-400">{fileTree.error}</div>
            ) : filteredTree.length > 0 ? (
              renderFileTree(filteredTree)
            ) : (
              <div className="text-sm text-gray-500 text-center mt-8">
                {searchQuery ? 'No files match your search' : 'No files found'}
              </div>
            )}
          </div>
        </div>

        {/* Right - File Viewer/Editor */}
        <div className={`flex-1 ${commonClasses.card} flex flex-col overflow-hidden`}>
          {/* Editor Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              {selectedFile ? (
                <>
                  {renderFileIcon(selectedFile)}
                  <span className="font-mono text-sm">{selectedFile.name}</span>
                  <span className="text-xs text-gray-500">
                    {selectedFile.path}
                  </span>
                </>
              ) : (
                <span className="text-gray-500">No file selected</span>
              )}
            </div>
            {selectedFile && (
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSaveFile}
                      disabled={saveStatus === 'saving'}
                      className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2 text-sm`}
                    >
                      {saveStatus === 'saving' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setEditedContent(fileContent.data?.content || '');
                      }}
                      className={`${commonClasses.button} ${commonClasses.buttonSecondary} text-sm`}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2 text-sm`}
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2 text-sm`}
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setFileContent({ data: null, loading: false, error: null, status: 'idle' });
                    setIsEditing(false);
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Editor Content */}
          <div className="flex-1 overflow-hidden">
            {fileContent.loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            ) : fileContent.error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
                  <p className="text-red-600 dark:text-red-400">{fileContent.error}</p>
                </div>
              </div>
            ) : fileContent.data ? (
              isEditing ? (
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="w-full h-full p-4 font-mono text-sm bg-transparent resize-none focus:outline-none"
                />
              ) : (
                <pre className="p-4 overflow-auto h-full">
                  <code className="font-mono text-sm">{fileContent.data.content}</code>
                </pre>
              )
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <Eye className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Select a file to view its contents</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeBrowserV2;
