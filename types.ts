export type Role = 'user' | 'model' | 'system';

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
  styleGuide?: string;
}

export interface TeamMember {
  agentId: string;
}

export interface Team {
  id: string;
  name: string;
  objective: string;
  members: TeamMember[];
}