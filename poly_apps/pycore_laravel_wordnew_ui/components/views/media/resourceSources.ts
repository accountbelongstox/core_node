/**
 * ResourceSource adapters — the single seam that lets ONE explorer (FileTreePanel
 * + FileViewer) browse, read, edit and stream files from MORE THAN ONE backend.
 *
 * Two adapters today:
 *   - StaticResourceSource ('files'): media library at /static-resources/* (api.mcpV1).
 *     View-open; upload/mutate require login; the backend returns the full nested
 *     tree (recursive, lazyTree:false).
 *   - CodeSource ('code'): the project's own source at /code-browser/* (api.codeBrowser).
 *     ALL access requires login (loopback bypass keeps local dev frictionless);
 *     browse + read + edit only (no upload/mkdir/rename/delete); the backend
 *     returns ONE directory level (lazyTree:true) so huge repos load on demand.
 *
 * Movies & Books are DB-backed learning sources rendered by MbSourceDetail, NOT
 * file trees, so they are intentionally NOT ResourceSources.
 *
 * This is a NEW module: it may use ||/??/try-catch (the guardrail forbidding them
 * applies only to FileTreePanel/FileViewer/LibraryPanel/MediaHub). All backend
 * shape normalization lives here so those four components stay clean.
 */
import { FileNode, ResourceSourceId } from '../../../apps/laravel-manager/uiTypes';
import { APIResponse } from '@/apps/laravel-manager/types';
import { api } from '@/apps/laravel-manager/api';

/** Uniform file-content shape consumed by FileViewer regardless of backend. */
export interface ResourceFileContent {
  content: string;
  isText: boolean;
  extension: string;
  size: number;
  mimeType?: string;
  modified?: string;
}

/** Result of listing a directory level. */
export interface TreeResult {
  items: FileNode[];
  basePath: string;
  realPath: string;
}

export interface ResourceSource {
  id: ResourceSourceId;
  /** Human label for the tree panel header. */
  label: string;

  // Capability flags consumed by FileTreePanel/FileViewer for show/hide + gating.
  requiresLogin: boolean; // does browsing/reading itself require login? (code=true)
  canUpload: boolean;
  canEdit: boolean; // inline edit in FileViewer
  canWrite: boolean; // a save endpoint exists
  canMkdir: boolean;
  canRename: boolean;
  canDelete: boolean;
  lazyTree: boolean; // true => listTree returns ONE level; expanding a folder fetches its children

  listTree(path?: string): Promise<APIResponse<TreeResult>>;
  readContent(node: FileNode): Promise<APIResponse<ResourceFileContent>>;
  saveContent(node: FileNode, text: string): Promise<APIResponse>;
  streamUrl(node: FileNode): string;
  downloadUrl(node: FileNode): string;

  upload?(files: File[], targetPath: string, relativePaths: string[], onProgress: (pct: number) => void): Promise<APIResponse>;
  mkdir?(parentPath: string, name: string): Promise<APIResponse>;
  rename?(node: FileNode, newName: string): Promise<APIResponse>;
  delete?(node: FileNode): Promise<APIResponse>;
  deletePreview?(node: FileNode): Promise<APIResponse>;
}

/**
 * Classify a file by extension into the viewer dispatch buckets. Shared by all
 * adapters so the tree icons and the FileViewer branch agree.
 */
export const detectFileType = (
  fileName: string
): 'video' | 'audio' | 'image' | 'code' | 'text' | 'pdf' | 'epub' | 'markdown' | 'doc' => {
  const parts = fileName.split('.');
  const ext = parts[parts.length - 1].toLowerCase();
  if (['mp4', 'mkv', 'avi', 'mov', 'webm', 'm3u8'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus'].includes(ext)) return 'audio';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif'].includes(ext)) return 'image';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['epub'].includes(ext)) return 'epub';
  if (['md', 'markdown'].includes(ext)) return 'markdown';
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'doc';
  if (
    [
      'js', 'mjs', 'cjs', 'ts', 'jsx', 'tsx', 'py', 'php', 'java',
      'c', 'h', 'cpp', 'cc', 'cxx', 'hpp', 'go', 'rs', 'rb', 'kt',
      'swift', 'cs', 'dart', 'lua', 'scala', 'sql', 'vue',
      'html', 'htm', 'xml', 'css', 'scss', 'sass', 'less',
      'json', 'yml', 'yaml', 'toml', 'ini', 'sh', 'bash', 'zsh'
    ].includes(ext)
  ) {
    return 'code';
  }
  return 'text';
};

/**
 * Normalize a backend tree payload (static-resources OR code-browser, same item
 * shape) into FileNode[]. Recurses into `children` when present (static, recursive)
 * and leaves directory `children` undefined when absent (code, lazy).
 */
const normalizeNodes = (nodes: any[], sourceId: ResourceSourceId): FileNode[] => {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((node: any) => {
    const isDir = node.type === 'directory';
    const normalized: FileNode = {
      ...node,
      id: node.path,
      sourceId,
      type: isDir ? 'folder' : 'file',
      fileType: isDir ? undefined : detectFileType(node.name),
      children: node.children ? normalizeNodes(node.children, sourceId) : undefined
    };
    return normalized;
  });
};

const okTree = (data: any, sourceId: ResourceSourceId): TreeResult => {
  const items = normalizeNodes(data && data.items ? data.items : [], sourceId);
  const basePath = data && data.path ? String(data.path) : '';
  const realPath = data && data.realPath ? String(data.realPath) : basePath;
  return { items, basePath, realPath };
};

/** Static media resources adapter (view-open; upload/mutate require login). */
const StaticResourceSource: ResourceSource = {
  id: 'files',
  label: 'Static Resources',
  requiresLogin: false,
  canUpload: true,
  canEdit: true,
  canWrite: true,
  canMkdir: true,
  canRename: true,
  canDelete: true,
  lazyTree: false,

  async listTree(path?: string): Promise<APIResponse<TreeResult>> {
    const res = await api.mcpV1.getStaticResourcesTree(path);
    if (res.success && res.data) {
      return { success: true, data: okTree(res.data, 'files'), error: null, status: res.status };
    }
    return { success: false, data: null, error: res.error, status: res.status };
  },
  async readContent(node: FileNode): Promise<APIResponse<ResourceFileContent>> {
    return api.mcpV1.getStaticFileContent(node.id) as Promise<APIResponse<ResourceFileContent>>;
  },
  async saveContent(node: FileNode, text: string): Promise<APIResponse> {
    return api.mcpV1.saveStaticFileContent(node.id, text);
  },
  streamUrl(node: FileNode): string {
    return api.mcpV1.getStaticFileStreamUrl(node.id);
  },
  downloadUrl(node: FileNode): string {
    return api.mcpV1.getStaticFileDownloadUrl(node.id);
  },
  upload(files, targetPath, relativePaths, onProgress) {
    return api.mcpV1.uploadStaticResources(files, targetPath, relativePaths, onProgress);
  },
  mkdir(parentPath, name) {
    return api.mcpV1.createStaticResourceDir(parentPath, name);
  },
  rename(node, newName) {
    return api.mcpV1.renameStaticResource(node.id, newName);
  },
  delete(node) {
    return api.mcpV1.deleteStaticResource(node.id);
  },
  deletePreview(node) {
    return api.mcpV1.deleteStaticResourcePreview(node.id);
  }
};

/** Project source-code adapter (login-gated, lazy, browse + read + edit only). */
const CodeSource: ResourceSource = {
  id: 'code',
  label: 'Code',
  requiresLogin: true,
  canUpload: false,
  canEdit: true,
  canWrite: true,
  canMkdir: false,
  canRename: false,
  canDelete: false,
  lazyTree: true,

  async listTree(path?: string): Promise<APIResponse<TreeResult>> {
    const res = await api.codeBrowser.fileTree(path);
    if (res.success && res.data) {
      return { success: true, data: okTree(res.data, 'code'), error: null, status: res.status };
    }
    return { success: false, data: null, error: res.error, status: res.status };
  },
  async readContent(node: FileNode): Promise<APIResponse<ResourceFileContent>> {
    const res = await api.codeBrowser.readFile(node.id);
    if (res.success && res.data) {
      const d: any = res.data;
      const content: ResourceFileContent = {
        content: typeof d.content === 'string' ? d.content : '',
        isText: true,
        extension: d.extension ? String(d.extension) : '',
        size: typeof d.size === 'number' ? d.size : 0,
        modified: d.modified
      };
      return { success: true, data: content, error: null, status: res.status };
    }
    return { success: false, data: null, error: res.error, status: res.status };
  },
  async saveContent(node: FileNode, text: string): Promise<APIResponse> {
    return api.codeBrowser.saveFile(node.id, text);
  },
  streamUrl(node: FileNode): string {
    return api.codeBrowser.readFileUrl(node.id);
  },
  downloadUrl(node: FileNode): string {
    return api.codeBrowser.readFileUrl(node.id);
  }
};

const REGISTRY: Record<ResourceSourceId, ResourceSource> = {
  files: StaticResourceSource,
  code: CodeSource
};

/** Resolve a source adapter; defaults to the static media source. */
export const getSource = (id?: ResourceSourceId): ResourceSource => {
  if (id && REGISTRY[id]) return REGISTRY[id];
  return StaticResourceSource;
};
