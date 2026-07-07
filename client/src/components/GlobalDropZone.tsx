import { useState, useEffect } from 'react';
import { useMemoryStore } from '@/stores/memoryStore';
import { Upload, Loader2, Check, AlertCircle, X } from 'lucide-react';

export default function GlobalDropZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const { uploadFiles } = useMemoryStore();

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
        setIsDragging(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) {
        setIsDragging(false);
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length === 0) return;
      try {
        await uploadFiles(files, '');
        setUploadStatus({ type: 'success', message: `${files.length} 个文件上传成功` });
      } catch (err: any) {
        setUploadStatus({ type: 'error', message: err.message || '上传失败' });
      }
      setTimeout(() => setUploadStatus(null), 3000);
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [uploadFiles]);

  return (
    <>
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary/80 backdrop-blur-sm pointer-events-none animate-fadeIn">
          <div className="rounded-2xl border-4 border-dashed border-accent bg-accent/5 p-16 text-center">
            <Upload className="mx-auto h-16 w-16 text-accent mb-4 animate-bounce" />
            <p className="text-xl font-medium text-text-primary">松开鼠标上传文件</p>
            <p className="mt-2 text-sm text-text-secondary">
              支持 图片 / PDF / Word / Excel / PPT / ZIP / 文本
            </p>
          </div>
        </div>
      )}

      {uploadStatus && (
        <div className="fixed bottom-6 right-6 z-50 animate-slideIn">
          <div
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg ${
              uploadStatus.type === 'success'
                ? 'border-green-500/30 bg-green-500/10'
                : 'border-red-500/30 bg-red-500/10'
            }`}
          >
            {uploadStatus.type === 'success' ? (
              <Check className="h-5 w-5 text-green-400" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-400" />
            )}
            <span
              className={
                uploadStatus.type === 'success'
                  ? 'text-sm text-green-300'
                  : 'text-sm text-red-300'
              }
            >
              {uploadStatus.message}
            </span>
            <button
              onClick={() => setUploadStatus(null)}
              className="ml-2 text-text-tertiary hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
