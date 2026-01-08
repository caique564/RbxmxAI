
export interface RobloxAsset {
  id: string;
  name: string;
  className: string;
  source?: string; // For scripts
  children: RobloxAsset[];
  properties?: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  assetsGenerated?: RobloxAsset[];
  timestamp: number;
}

export interface ProjectState {
  history: ChatMessage[];
  explorerRoot: RobloxAsset;
  projectName: string;
}
