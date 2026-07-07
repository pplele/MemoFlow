export default function AgentThinking() {
  return (
    <div className="flex items-center gap-2 text-text-tertiary">
      <div className="flex gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: '0ms' }} />
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: '150ms' }} />
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-sm">思考中</span>
    </div>
  );
}
