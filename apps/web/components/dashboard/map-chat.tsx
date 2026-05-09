"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FounderFlowResponse, MapFilters, ResourceCardData } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type MapChatProps = {
  founderProfile: FounderFlowResponse["founderProfile"];
  analysis: FounderFlowResponse["analysis"];
  resources: ResourceCardData[];
  startups: FounderFlowResponse["startups"];
  onFilter: (filters: MapFilters) => void;
  onClearFilter: () => void;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function MapChat({
  founderProfile,
  analysis,
  resources,
  startups,
  onFilter,
  onClearFilter
}: MapChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilters, setActiveFilters] = useState<MapFilters | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Extract available categories and sectors
  const availableCategories = Array.from(new Set(resources.map((r) => r.category)));
  const availableSectors = Array.from(new Set(startups.map((s) => s.sector).filter(Boolean)));

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}-${Math.random()}`,
      role: "user",
      content: input.trim()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/map-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMessage.content,
          founderSummary: `Stage: ${analysis.stage}; Confidence: ${Math.round(analysis.confidenceScore * 100)}%; Primary needs: ${analysis.primaryNeeds.join(", ")}; Location: ${founderProfile.locationCity}`,
          availableCategories,
          availableSectors
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-${Math.random()}`,
        role: "assistant",
        content: data.reply
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.filters) {
        setActiveFilters(data.filters);
        onFilter(data.filters);
      }
    } catch (error) {
      console.error("Map chat error:", error);
      const errorMessage: Message = {
        id: `msg-${Date.now()}-${Math.random()}`,
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again."
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearFilter = () => {
    setActiveFilters(null);
    onClearFilter();
  };

  return (
    <div className="fixed bottom-4 right-4 z-20">
      <AnimatePresence mode="wait">
        {!isOpen ? (
          <motion.button
            key="fab"
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-white shadow-lg hover:bg-secondary/90 transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Sparkles className="h-6 w-6" />
          </motion.button>
        ) : (
          <motion.div
            key="panel"
            initial={{ y: 400, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 400, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute bottom-0 right-0 w-[360px] max-h-[50vh] rounded-2xl border border-border/70 bg-card/95 backdrop-blur-sm shadow-xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-secondary" />
                <h3 className="font-semibold text-sm">Map Assistant</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1 hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Active Filters Badge */}
            {activeFilters && !activeFilters.clearFilters ? (
              <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-secondary/30 bg-secondary/10 px-3 py-2">
                <Badge className="bg-secondary/20 text-secondary text-xs">
                  Filter active
                </Badge>
                <button
                  type="button"
                  onClick={handleClearFilter}
                  className="ml-auto text-xs font-medium text-secondary hover:underline"
                >
                  Clear
                </button>
              </div>
            ) : null}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <p>Ask me to filter resources and startups.</p>
                  <p className="mt-1 text-xs">"Show me Utah resources for funding"</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-2",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-xs px-3 py-2 text-sm",
                        message.role === "user"
                          ? "bg-secondary text-white"
                          : "bg-muted text-foreground border border-border/50"
                      )}
                      style={{
                        borderRadius: message.role === "user" 
                          ? "0.85rem 0.85rem 0.3rem 0.85rem"
                          : "0.85rem 0.85rem 0.85rem 0.3rem"
                      }}
                    >
                      {message.content}
                    </div>
                  </div>
                ))
              )}
              {isLoading ? (
                <div className="flex gap-2 justify-start">
                  <div className="bg-muted border border-border/50 rounded-lg px-3 py-2">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" />
                      <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce delay-100" />
                      <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce delay-200" />
                    </div>
                  </div>
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="border-t border-border/50 px-4 py-3 flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask for resources..."
                disabled={isLoading}
                className="flex-1 rounded-lg border border-border/50 bg-background px-3 py-2 text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              />
              <Button
                type="submit"
                disabled={!input.trim() || isLoading}
                size="sm"
                className="shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
