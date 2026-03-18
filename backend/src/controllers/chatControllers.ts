import Groq from 'groq-sdk';
import { Response, Request } from 'express';
import { AppDataSource } from '../data-source';
import { Chat } from '../entities/Chat';
import { User } from '../entities/User';
import type { Role } from '../types/Role';
import { sendSuccess, throwError } from '../utils/responseHandlers';
import { getUserByEmail } from '../utils/idHandler';

const groqApiKey = process.env.GROQ_API_KEY;
if (!groqApiKey) {
  throw new Error('GROQ_API_KEY is not defined');
}

const groq = new Groq({
  apiKey: groqApiKey,
});

const groqModel = process.env.GROQ_CHAT_MODEL ?? 'llama-3.3-70b-versatile';

type ChatMessage = {
  role: Role;
  content: string;
};

export async function streamChatMessage(req: Request, res: Response) {
  const { input } = req.body;
  const email = req.headers['user-email'] as string;

  if (!email || !input) {
    throwError('Email and input are required', 400);
  }

  const user = await getUserByEmail(email);
  const userId = user?.id;
  if (!userId) throwError('User ID not found', 404);

  const chatRepository = AppDataSource.getRepository(Chat);

  const userMessage = new Chat();
  userMessage.user = { id: userId } as User;
  userMessage.role = 'user';
  userMessage.content = input;
  await chatRepository.save(userMessage);

  const messages = await chatRepository.find({
    where: { user: { id: userId } },
    order: { created_at: 'ASC' },
  });

  const limitedMessages = messages.slice(-5).map((msg) => ({
    role: msg.role as Role,
    content: msg.content as string,
  }));

  const conversation: ChatMessage[] = [
    {
      role: 'system',
      content: `
    You are a compassionate, professional mental health assistant trained in psychology and well-being.
    
    Your role is to support users with emotional wellness, stress, anxiety, and related personal challenges. 
    - Respond with empathy and encouragement.
    - Avoid medical diagnosis or medication advice.
    - If the conversation goes off-topic (e.g., tech support, coding, jokes), politely steer it back to mental health.

    Always prioritize the user's emotional safety and provide helpful, kind, and psychologically-informed responses.
      `.trim(),
    },
    ...limitedMessages,
  ];

  const completion = await groq.chat.completions.create({
    model: groqModel,
    messages: conversation,
    stream: true,
  });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let fullAssistantResponse = '';
  try {
    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullAssistantResponse += content;
        const lines = content.split('\n');
        for (const line of lines) {
          res.write(`data: ${line}\n`);
        }
        res.write('\n');
      }
    }
  } catch {
    res.write('data: [ERROR]\n\n');
    res.end();
    throwError('Error in streaming response', 500);
  }
  if (fullAssistantResponse.trim()) {
    const assistantMessage = new Chat();
    assistantMessage.user = { id: userId } as User;
    assistantMessage.role = 'assistant';
    assistantMessage.content = fullAssistantResponse;

    await chatRepository.save(assistantMessage);
  }

  res.write('data: [DONE]\n\n');
  res.end();
}

export const getChatHistory = async (req: Request, res: Response) => {
  const email = req.headers['user-email'];
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = parseInt(req.query.limit as string) || 5;

  if (typeof email !== 'string' || !email) {
    throwError('Invalid or missing email!', 400);
  }
  const emailAssert = email as string;

  const user = await getUserByEmail(emailAssert);
  const userId = user?.id;

  if (!user) {
    throwError('User not found!', 401);
  }

  const chatRepository = AppDataSource.getRepository(Chat);

  const [messages, total] = await chatRepository.findAndCount({
    where: { user: { id: userId } },
    order: { created_at: 'DESC' },
    skip: offset,
    take: limit,
  });

  messages.reverse();

  sendSuccess(res, { messages, total }, 200);
};

export async function deleteChats(req: Request, res: Response) {
  const { email } = req.body;
  if (!email) {
    throwError('Email is required!', 400);
  }

  const user = await getUserByEmail(email);
  const userId = user?.id;

  if (!userId) {
    throwError('User ID required!', 400);
  }

  const chatRepository = AppDataSource.getRepository(Chat);
  await chatRepository.delete({ user: { id: userId } });
  sendSuccess(res, { message: 'All chats have been deleted.' }, 200);
}
