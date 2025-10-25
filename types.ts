export type Role = 'user' | 'model' | 'system';

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
}

export interface ChartData {
  type: 'line' | 'bar' | 'pie';
  title: string;
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  isError?: boolean;
  chartData?: ChartData;
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
