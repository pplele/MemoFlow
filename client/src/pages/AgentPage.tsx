import { useState, useRef, useEffect, useCallback } from 'react';
import { useAgentStore } from '@/stores/agentStore';
import { Bot, Send, Loader2, Trash2, Sparkles, Paperclip, Upload, X } from 'lucide-react';
import AgentMessage from '@/components/AgentMessage';
import AgentThinking from '@/components/AgentThinking';
import ToolCallCard from '@/components/ToolCallCard';
import { fileApi } from '@/api/file';

export default function AgentPage() {
  const [input, setInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const {
    messages,
    isStreaming,
    currentContent,
    currentThought,
    currentToolCalls,
    currentToolResults,
    error,
    sendMessage,
    clearHistory,
  } = useAgentStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming, currentContent, currentToolCalls]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    await sendMessage(input);
    setInput('');
  };

  const handleFileUpload = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setUploadingFiles(true);
    setUploadProgress(0);

    try {
      const result = await fileApi.upload(fileArray);

      const fileNames = result.files?.map((f: any) => f.name).join(', ') || '';
      const msg = `我上传了文件：${fileNames}。帮我分析这些文件。`;
      await sendMessage(msg);
    } catch (err: any) {
      console.error('文件上传失败:', err);
      await sendMessage(`文件上传失败：${err.message}`);
    } finally {
      setUploadingFiles(false);
      setUploadProgress(0);
    }
  }, [sendMessage]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
    e.target.value = '';
  }, [handleFileUpload]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const presetQuestions = [
    '分析我的记忆趋势',
    '帮我创建一条新记忆',
    '我近期学了什么？',
    '知识图谱概况',
  ];

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col">
      <div className="mx-auto w-full max-w-3xl flex flex-col h-full p-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bot className="h-7 w-7 text-accent" />
            智能助手
          </h1>
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
              title="清空对话"
            >
              <Trash2 className="h-3.5 w-3.5" />
              清空
            </button>
          )}
        </div>
        <p className="text-text-secondary mb-6 text-sm">
          ReAct 模式 AI Agent · 自动调用工具搜索、创建、分析你的记忆
        </p>

        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-5 mb-4 pr-2 -mr-2">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center py-20 text-text-tertiary animate-fadeIn">
              <Sparkles className="h-12 w-12 mb-4" />
              <p className="text-sm">和 AI 助手对话，它会自动搜索和分析你的记忆</p>
              <div className="mt-8 grid grid-cols-2 gap-2 w-full max-w-md text-xs">
                {presetQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-left text-text-secondary hover:border-accent/50 hover:text-text-primary transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <AgentMessage key={idx} message={msg} toolResults={msg.toolResults} />
          ))}

          {isStreaming && (
            <div className="space-y-2 animate-fadeIn">
              {currentThought && (
                <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent">
                  <span className="font-medium">思考：</span>{currentThought}
                </div>
              )}
              {currentToolCalls.map((tc) => {
                const result = currentToolResults.find((r) => r.id === tc.id);
                return <ToolCallCard key={tc.id} toolCall={tc} result={result} />;
              })}
              {currentContent && (
                <div className="rounded-2xl rounded-bl-md border border-border-primary bg-bg-secondary px-4 py-3 text-sm text-text-primary leading-relaxed">
                  <p className="whitespace-pre-wrap">{currentContent}</p>
                </div>
              )}
              {!currentContent && currentToolCalls.length === 0 && !currentThought && <AgentThinking />}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="border-t border-border-primary pt-4">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {(isDragging || uploadingFiles) && (
            <div
              className={`mb-3 rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                isDragging
                  ? 'border-accent bg-accent/10'
                  : 'border-border-primary bg-bg-secondary'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {uploadingFiles ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-accent" />
                  <span className="text-sm text-text-secondary">
                    上传中 {uploadProgress}%
                  </span>
                  <div className="w-full h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-text-secondary">
                  <Upload className="h-5 w-5" />
                  <span className="text-sm">松开鼠标上传文件</span>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="问一个问题或发出指令..."
              disabled={isStreaming}
              className="flex-1 rounded-lg border border-border-primary bg-bg-secondary px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-60 transition-all"
            />
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={isStreaming}
              className="flex items-center gap-2 rounded-lg border border-border-primary bg-bg-secondary px-3 py-3 text-text-secondary hover:border-accent/50 hover:text-accent disabled:opacity-60 transition-colors"
              title="上传文件"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>发送</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
