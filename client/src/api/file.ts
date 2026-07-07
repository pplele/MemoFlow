import { api } from './index';
import type { FileUploadResponse } from '@/types';

export interface FileUploadResult extends FileUploadResponse {
  file_count: number;
  files: Array<{
    name: string;
    path: string;
    size: number;
    mimetype: string;
  }>;
}

export const fileApi = {
  /**
   * 统一文件上传（支持所有类型，不解析内容，直接保存）
   * @param files 文件列表
   * @param note 备注（用于分类标签）
   */
  upload(files: File[], note?: string): Promise<FileUploadResult> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    if (note) {
      formData.append('note', note);
    }
    return api.request<FileUploadResult>('/files/upload', {
      method: 'POST',
      body: formData,
    });
  },
};
