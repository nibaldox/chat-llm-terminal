export type Role = 'user' | 'model';

export interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  isError?: boolean;
}

export interface Agent {
  id: string;
  name: string;
  instructions: string;
  biography?: string;
  tools?: string[];
  expectedOutput?: string;
  styleGuide?: string; // Nuevo campo para guía de estilo
}