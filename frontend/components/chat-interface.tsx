'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, ArrowDown, Trash2 } from 'lucide-react';
import { PageContainer } from './page-container';
import { generateAIResponse } from '@/app/api-client/ai-chat';
import type { ChatMessage } from '@/types/Chat';
import { useSession } from 'next-auth/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  useChatHistory,
  useDeleteChatHistory,
  useAddChatMessage,
} from '@/app/api-client/ai-chat/use-chat-query';
import errorCatch from '@/app/api-client/error-message';
import ChatDisabledOverlay from './chat-disabled-overlay';

export function ChatInterface() {
  const { data: session } = useSession();
  const email = session?.user.email ?? '';
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const wasDeleted = useRef(false);
  const welcomeMessage = useMemo<ChatMessage>(
    () => ({
      role: 'system',
      content:
        "Welcome to MindGarden! I'm your mental wellness assistant. How can I help you today?",
    }),
    []
  );

  const {
    data: chatData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingHistory,
    refetch,
  } = useChatHistory(email, 20);

  const { addMessage, updateLastMessage } = useAddChatMessage();

  const allMessages = useMemo(
    () =>
      chatData
        ? chatData.pages
            .slice()
            .reverse()
            .flatMap((page) => page.messages)
        : [],
    [chatData]
  );
  const messages = useMemo(() => [welcomeMessage, ...allMessages], [welcomeMessage, allMessages]);
  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    if (!email) {
      console.error('User is not authenticated. Please log in.');
      return;
    }

    const userMessage: ChatMessage = { role: 'user', content: input };
    addMessage(email, userMessage);
    setInput('');
    setIsLoading(true);

    const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
    addMessage(email, assistantMessage);

    try {
      setIsStreaming(false);

      await generateAIResponse(email, input, (token) => {
        if (!isStreaming) {
          setIsStreaming(true);
          setIsLoading(true);
        }
        updateLastMessage(email, token);
      });
    } catch (error) {
      updateLastMessage(email, 'Sorry, there was an error processing your request.');
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      refetch();
    }
  };

  const mutation = useDeleteChatHistory();

  const handleDeleteChats = () => {
    setIsLoading(true);

    mutation.mutate(email, {
      onSuccess: (result) => {
        if (result.success) {
          toast({
            title: 'Success!',
            description: result.message,
            variant: 'default',
          });
          wasDeleted.current = true;
        } else {
          toast({
            title: 'Unexpected result',
            description: 'The operation did not complete successfully.',
            variant: 'destructive',
          });
        }

        setIsLoading(false);
      },
      onError: (error: Error) => {
        const errorMessage = errorCatch(error);

        toast({
          title: 'Error!',
          description: errorMessage,
          variant: 'destructive',
        });

        setIsLoading(false);
      },
    });
  };

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      setAutoScroll(true);
      setShowScrollButton(false);
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollAreaRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
      const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;

      setAutoScroll(isAtBottom);
      setShowScrollButton(!isAtBottom);
    }
  }, []);

  return (
    <>
      <PageContainer className="h-[calc(100vh-8rem)] py-4">
        <>
          <div className="flex h-full flex-col rounded-lg border border-gray-300 bg-white shadow-md">
            <div className="flex items-center justify-between border-b border-gray-300 px-4 py-2">
              <h2 className="text-lg font-semibold">Chat</h2>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Restart Chats
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action will restart all your chat messages. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteChats}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      Restart
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <ScrollArea className="flex-1 p-4" ref={scrollAreaRef} onScroll={handleScroll}>
              {isLoadingHistory && !messages.length ? (
                <div className="flex justify-center items-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Load more trigger at the top */}
                  {hasNextPage && (
                    <div ref={loadMoreRef} className="flex justify-center py-2">
                      {isFetchingNextPage ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                      ) : (
                        <span className="text-sm text-gray-500">
                          Scroll up to load more messages
                        </span>
                      )}
                    </div>
                  )}

                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`prose max-w-[80%] rounded-lg px-4 py-2 ${
                          message.role === 'user'
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {showScrollButton && (
              <Button
                className="absolute bottom-20 right-6 rounded-full p-2 shadow-md"
                onClick={scrollToBottom}
                size="sm"
                variant="secondary"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            )}

            <div className="border-t border-gray-300 p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex gap-2"
              >
                <Input
                  placeholder="Type your message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="flex-1"
                  disabled={isLoading || isLoadingHistory || !email}
                />
                <Button
                  type="submit"
                  disabled={isLoading || !input.trim() || !email || isLoadingHistory}
                >
                  <Send className="h-4 w-4" />
                  <span className="sr-only">Send</span>
                </Button>
              </form>
            </div>
          </div>
        </>
      </PageContainer>
          <ChatDisabledOverlay />
    </>
  );
}
