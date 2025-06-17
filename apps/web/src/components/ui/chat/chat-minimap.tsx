import React, { useEffect, useRef } from 'react';
import { useStore } from "@tanstack/react-store";
import type { ChatMessageStore } from "@/integrations/tanstack-store/chats-store";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface ChatMinimapProps {
  messages: ChatMessageStore[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

export function ChatMinimap({ messages, scrollRef, className }: ChatMinimapProps) {
  const minimapRef = useRef<HTMLDivElement>(null);
  const [scrollRatio, setScrollRatio] = React.useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!scrollRef.current || !minimapRef.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const ratio = scrollTop / (scrollHeight - clientHeight);
      setScrollRatio(ratio);
    };

    scrollRef.current?.addEventListener('scroll', handleScroll);
    return () => scrollRef.current?.removeEventListener('scroll', handleScroll);
  }, [scrollRef]);

  const handleScrollTo = (ratio: number) => {
    if (!scrollRef.current || !minimapRef.current) return;
    
    const { scrollHeight, clientHeight } = scrollRef.current;
    const newScrollTop = ratio * (scrollHeight - clientHeight);
    
    scrollRef.current.scrollTo({
      top: newScrollTop,
      behavior: 'smooth'
    });
  };

  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = minimapRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const clickRatio = (e.clientY - rect.top) / rect.height;
    handleScrollTo(clickRatio);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const rect = minimapRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const currentRatio = scrollRatio;
      const newRatio = Math.min(Math.max(currentRatio + (e.key === 'Enter' ? 0.1 : -0.1), 0), 1);
      handleScrollTo(newRatio);
    }
  };

  return (
    <div 
      ref={minimapRef}
      className={cn(
        "w-16 border-l border-border bg-background/50 backdrop-blur-sm overflow-hidden",
        className
      )}
      onClick={handleMinimapClick}
      onKeyDown={handleKeyDown}
      role="scrollbar"
      tabIndex={0}
      aria-label="Chat minimap"
      aria-valuenow={scrollRatio * 100}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-orientation="vertical"
      aria-controls="chat-messages"
    >
      <div className="relative h-full">
        {messages.map((messageStore, index) => {
          const message = useStore(messageStore);
          return (
            <div
              key={message.id}
              className={cn(
                "text-[2px] leading-[3px] p-[1px] break-words whitespace-pre-wrap",
                message.role === "user" ? "bg-muted" : "bg-background"
              )}
            >
              <Markdown remarkPlugins={[remarkGfm]}>
                {message.message}
              </Markdown>
            </div>
          );
        })}
        <div 
          className="absolute w-full bg-primary/20 pointer-events-none transition-transform"
          style={{
            top: `${scrollRatio * 100}%`,
            height: '20%',
            transform: 'translateY(-50%)'
          }}
        />
      </div>
    </div>
  );
} 