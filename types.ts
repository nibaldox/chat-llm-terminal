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
}
