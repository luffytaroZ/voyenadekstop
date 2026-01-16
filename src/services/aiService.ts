import OpenAI from 'openai';
import type { AIMessage } from '../types';

class AIService {
  private client: OpenAI | null = null;

  // ============ Initialization ============

  async initialize(): Promise<void> {
    const apiKey = await this.getStoredApiKey();
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true,
      });
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async setApiKey(key: string): Promise<boolean> {
    try {
      const testClient = new OpenAI({
        apiKey: key,
        dangerouslyAllowBrowser: true,
      });

      // Validate key with a minimal request
      await testClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      });

      // Key works - save and use it
      this.client = testClient;
      await this.storeApiKey(key);
      return true;
    } catch (error) {
      console.error('[AI] API key validation failed:', error);
      return false;
    }
  }

  async clearApiKey(): Promise<void> {
    this.client = null;
    await window.electronAPI?.store.delete('openai-api-key');
  }

  // ============ Core Chat ============

  async chat(
    messages: AIMessage[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    if (!this.client) {
      throw new Error('AI not configured. Add your OpenAI API key in settings.');
    }

    const { model = 'gpt-4o-mini', temperature = 0.7, maxTokens = 2048 } = options ?? {};

    const response = await this.client.chat.completions.create({
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature,
      max_tokens: maxTokens,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    return content;
  }

  // ============ Writing Helpers ============

  async improveWriting(text: string): Promise<string> {
    return this.chat([
      {
        id: '1',
        role: 'system',
        content:
          'Improve the following text for clarity, grammar, and style. Return only the improved text.',
        timestamp: new Date().toISOString(),
      },
      {
        id: '2',
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
      },
    ]);
  }

  async summarize(text: string): Promise<string> {
    return this.chat([
      {
        id: '1',
        role: 'system',
        content: 'Summarize the following text concisely, capturing key points.',
        timestamp: new Date().toISOString(),
      },
      {
        id: '2',
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
      },
    ]);
  }

  async continueWriting(text: string): Promise<string> {
    return this.chat([
      {
        id: '1',
        role: 'system',
        content:
          'Continue writing from where this text ends. Match the style and tone. Return only the continuation.',
        timestamp: new Date().toISOString(),
      },
      {
        id: '2',
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
      },
    ]);
  }

  async expandText(text: string): Promise<string> {
    return this.chat([
      {
        id: '1',
        role: 'system',
        content:
          'Expand on this text by adding more details, examples, and depth while maintaining the original meaning.',
        timestamp: new Date().toISOString(),
      },
      {
        id: '2',
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
      },
    ]);
  }

  async askAboutNotes(question: string, notesContext: string): Promise<string> {
    return this.chat([
      {
        id: '1',
        role: 'system',
        content: `You are an AI assistant for a note-taking app called Voyena. Help the user with their notes.

Here is context from the user's notes:
${notesContext}

Answer based on this context when relevant.`,
        timestamp: new Date().toISOString(),
      },
      {
        id: '2',
        role: 'user',
        content: question,
        timestamp: new Date().toISOString(),
      },
    ]);
  }

  // ============ Private Helpers ============

  private async getStoredApiKey(): Promise<string | null> {
    if (window.electronAPI) {
      const key = await window.electronAPI.store.get('openai-api-key');
      return (key as string) ?? null;
    }
    return localStorage.getItem('openai-api-key');
  }

  private async storeApiKey(key: string): Promise<void> {
    if (window.electronAPI) {
      await window.electronAPI.store.set('openai-api-key', key);
    } else {
      localStorage.setItem('openai-api-key', key);
    }
  }
}

export const aiService = new AIService();
