import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, FunctionCall, GroundingChunk } from "@google/genai";
import { ChatMessage, Agent } from './types';
import { toolRegistry } from './tools';

// Make TypeScript aware of the 'marked' and 'DOMPurify' libraries on the window object
declare global {
  interface Window {
    marked: {
      parse: (markdown: string) => string;
    };
    DOMPurify: {
      sanitize: (dirty: string) => string;
    }
  }
}

// --- CONFIGURATION ---
const DARK_THEME_COLORS = ['#ff79c6', '#8be9fd', '#f1fa8c', '#50fa7b', '#bd93f9', '#ffb86c', '#ff5555'];
const LIGHT_THEME_COLORS = ['#e91e63', '#2196f3', '#ffc107', '#4caf50', '#673ab7', '#ff9800', '#f44336'];

type ApiProvider = 'google' | 'openrouter' | 'mcp';
type Theme = 'light' | 'dark';


// --- AGENT MODAL COMPONENT ---
interface AgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (agent: Omit<Agent, 'id'>) => void;
  agentToEdit: Omit<Agent, 'id'> | Agent | null;
}

const AgentModal: React.FC<AgentModalProps> = ({ isOpen, onClose, onSave, agentToEdit }) => {
  const [formData, setFormData] = useState<Omit<Agent, 'id'>>({
    name: '',
    instructions: '',
    biography: '',
    tools: [],
    expectedOutput: '',
    styleGuide: '',
  });
  const [isImproving, setIsImproving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (agentToEdit) {
        setFormData({
          name: agentToEdit.name || '',
          instructions: agentToEdit.instructions || '',
          biography: agentToEdit.biography || '',
          tools: agentToEdit.tools || [],
          expectedOutput: agentToEdit.expectedOutput || '',
          styleGuide: agentToEdit.styleGuide || '',
        });
      } else {
        setFormData({
          name: '', instructions: '', biography: '', tools: [], expectedOutput: '', styleGuide: ''
        });
      }
    }
  }, [agentToEdit, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToolChange = (toolId: string) => {
    setFormData(prev => {
      const newTools = prev.tools?.includes(toolId)
        ? prev.tools.filter(t => t !== toolId)
        : [...(prev.tools || []), toolId];
      return { ...prev, tools: newTools };
    });
  };

  const handleImproveInstructions = async () => {
    if (!formData.instructions.trim()) {
      alert("Por favor, escribe algunas instrucciones primero.");
      return;
    }
    setIsImproving(true);
    try {
      if (!process.env.API_KEY) throw new Error("La clave API de Google no está configurada.");
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const metaPrompt = `Eres un experto en "prompt engineering". Refina las siguientes instrucciones de usuario para que sean más claras, efectivas y robustas para un asistente de IA. La salida debe ser directa, concisa y seguir las mejores prácticas para guiar el comportamiento del modelo. Devuelve únicamente las instrucciones mejoradas, sin preámbulos, explicaciones o formato adicional.

Instrucciones a mejorar:
"${formData.instructions}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: metaPrompt,
      });
      const improvedText = response.text.trim();
      setFormData(prev => ({...prev, instructions: improvedText}));
    } catch (e: any) {
      console.error("Error al mejorar las instrucciones:", e);
      alert(`No se pudieron mejorar las instrucciones: ${e.message}`);
    } finally {
      setIsImproving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.instructions.trim()) {
      alert("El nombre y las instrucciones son obligatorios.");
      return;
    }
    onSave(formData);
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{minWidth: '600px'}}>
        <h2 className="text-xl font-bold mb-6">{agentToEdit ? 'Editar Agente' : 'Crear Nuevo Agente'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1">Nombre (Obligatorio)</label>
            <input name="name" value={formData.name} onChange={handleChange} className="modal-input" required />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block">Instrucciones (Obligatorio)</label>
              <button type="button" onClick={handleImproveInstructions} disabled={isImproving} className="text-xs flex items-center gap-1 text-[--accent-secondary] hover:text-[--accent-primary] disabled:opacity-50 disabled:cursor-wait">
                 {isImproving ? (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M13.488.354a1.5 1.5 0 0 1 2.122 2.122l-6.88 6.88a1.5 1.5 0 0 1-2.12 0l-.879-.878a1.5 1.5 0 0 1 0-2.122l6.758-6.758ZM3.146 9.854a.5.5 0 1 0-.708.708l1.06 1.06a.5.5 0 0 0 .708 0l1.06-1.06a.5.5 0 0 0-.708-.708L4.5 10.293zM5.5 7.5a.5.5 0 1 0-1 0v1a.5.5 0 0 0 1 0zM.5 5.5a.5.5 0 1 0 0-1H1a.5.5 0 0 0 0 1zM3 1.5a.5.5 0 1 0-1 0v1a.5.5 0 0 0 1 0zM.5 3.5a.5.5 0 1 0 0-1H1a.5.5 0 0 0 0 1zM2.44 6.11a.5.5 0 1 0-.707-.707L.384 6.75a.5.5 0 0 0 .707.707zM6.11 2.44a.5.5 0 1 0-.707.707L6.75.384a.5.5 0 0 0-.707-.707z" />
                    </svg>
                  )}
                Mejorar con IA
              </button>
            </div>
            <textarea name="instructions" value={formData.instructions} onChange={handleChange} className="modal-input" required rows={4}></textarea>
          </div>
          <hr style={{ borderColor: 'var(--border-color)', margin: '1.5rem 0' }}/>
          <h3 className="font-bold text-lg text-[--text-primary]">Personalización Adicional</h3>
          <div>
            <label className="block mb-1">Biografía (Opcional)</label>
            <textarea name="biography" value={formData.biography} onChange={handleChange} className="modal-input" rows={2}></textarea>
          </div>
          <div>
            <label className="block mb-1">Guía de Estilo y Ejemplos (Referencia personal, no se envía a la IA)</label>
            <textarea name="styleGuide" value={formData.styleGuide} onChange={handleChange} className="modal-input" rows={6} placeholder="Ej: Responde siempre en un tono formal. Estructura las respuestas con un resumen, puntos clave y una conclusión."></textarea>
          </div>
           <div>
            <label className="block mb-1">Herramientas (Opcional)</label>
            <div className="p-2 border border-[--border-color] bg-[--bg-secondary] space-y-2">
              {Object.entries(toolRegistry).map(([toolId, tool]) => (
                <div key={toolId} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`tool-${toolId}`}
                    checked={formData.tools?.includes(toolId) ?? false}
                    onChange={() => handleToolChange(toolId)}
                    className="mr-2"
                  />
                  <label htmlFor={`tool-${toolId}`}>{tool.label}</label>
                </div>
              ))}
            </div>
            <p className="text-xs mt-1 text-[--text-placeholder]">La Búsqueda Web y las otras herramientas no pueden usarse a la vez. Se priorizará la Búsqueda Web si está activa.</p>
          </div>
          <div>
            <label className="block mb-1">Salida Esperada (Opcional)</label>
            <textarea name="expectedOutput" value={formData.expectedOutput} onChange={handleChange} className="modal-input" rows={2}></textarea>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="modal-button">Cancelar</button>
            <button type="submit" className="modal-button">{agentToEdit ? 'Guardar Cambios' : 'Crear Agente'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}


// --- SETTINGS MODAL COMPONENT ---

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiProvider: ApiProvider;
  setApiProvider: (provider: ApiProvider) => void;
  openRouterKey: string;
  setOpenRouterKey: (key: string) => void;
  openRouterModel: string;
  setOpenRouterModel: (model: string) => void;
  mcpEndpoint: string;
  setMcpEndpoint: (url: string) => void;
  mcpApiKey: string;
  setMcpApiKey: (key: string) => void;
  mcpModelId: string;
  setMcpModelId: (id: string) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose, apiProvider, setApiProvider,
  openRouterKey, setOpenRouterKey, openRouterModel, setOpenRouterModel,
  mcpEndpoint, setMcpEndpoint, mcpApiKey, setMcpApiKey, mcpModelId, setMcpModelId,
  theme, setTheme
}) => {
  if (!isOpen) return null;

  const handleSave = () => {
    localStorage.setItem('apiProvider', apiProvider);
    localStorage.setItem('openRouterKey', openRouterKey);
    localStorage.setItem('openRouterModel', openRouterModel);
    localStorage.setItem('mcpEndpoint', mcpEndpoint);
    localStorage.setItem('mcpApiKey', mcpApiKey);
    localStorage.setItem('mcpModelId', mcpModelId);
    localStorage.setItem('theme', theme);
    onClose();
  };

  const handleThemeChange = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-6">Configuración</h2>
        <div className="space-y-4">
          <div className="theme-switch-wrapper">
            <label>Tema Claro</label>
            <label className="theme-switch">
              <input type="checkbox" checked={theme === 'light'} onChange={handleThemeChange} />
              <span className="slider"></span>
            </label>
          </div>
          <hr style={{ borderColor: 'var(--border-color)', margin: '1rem 0' }}/>
          <div>
            <label className="block mb-1">Proveedor de API</label>
            <select value={apiProvider} onChange={(e) => setApiProvider(e.target.value as ApiProvider)} className="modal-select">
              <option value="google">Google Gemini</option>
              <option value="openrouter">OpenRouter</option>
              <option value="mcp">MCP (Custom)</option>
            </select>
          </div>
          {apiProvider === 'openrouter' && (
            <>
              <div>
                <label className="block mb-1">Clave API de OpenRouter</label>
                <input
                  type="password"
                  value={openRouterKey}
                  onChange={(e) => setOpenRouterKey(e.target.value)}
                  className="modal-input"
                  placeholder="Introduce tu clave de OpenRouter"
                />
              </div>
              <div>
                <label className="block mb-1">Modelo de OpenRouter</label>
                <input
                  type="text"
                  value={openRouterModel}
                  onChange={(e) => setOpenRouterModel(e.target.value)}
                  className="modal-input"
                  placeholder="Ej: mistralai/mistral-7b-instruct:free"
                />
              </div>
            </>
          )}
          {apiProvider === 'mcp' && (
            <>
              <div>
                <label className="block mb-1">Endpoint de API de MCP</label>
                <input
                  type="text"
                  value={mcpEndpoint}
                  onChange={(e) => setMcpEndpoint(e.target.value)}
                  className="modal-input"
                  placeholder="https://api.example.com/v1/chat/completions"
                />
              </div>
               <div>
                <label className="block mb-1">Clave API de MCP</label>
                <input
                  type="password"
                  value={mcpApiKey}
                  onChange={(e) => setMcpApiKey(e.target.value)}
                  className="modal-input"
                  placeholder="Introduce tu clave API"
                />
              </div>
              <div>
                <label className="block mb-1">ID del Modelo de MCP</label>
                <input
                  type="text"
                  value={mcpModelId}
                  onChange={(e) => setMcpModelId(e.target.value)}
                  className="modal-input"
                  placeholder="Ej: mi-modelo-personalizado"
                />
              </div>
            </>
          )}
        </div>
        <div className="mt-6 flex justify-end">
          <button onClick={handleSave} className="modal-button">Guardar y Cerrar</button>
        </div>
      </div>
    </div>
  );
};


// --- MAIN APP COMPONENT ---

const App: React.FC = () => {
  // Agent and chat state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({});
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Settings state
  const [apiProvider, setApiProvider] = useState<ApiProvider>('google');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [openRouterModel, setOpenRouterModel] = useState('mistralai/mistral-7b-instruct:free');
  const [mcpEndpoint, setMcpEndpoint] = useState('');
  const [mcpApiKey, setMcpApiKey] = useState('');
  const [mcpModelId, setMcpModelId] = useState('');
  const [theme, setTheme] = useState<Theme>('dark');
  
  const mainRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentColors = theme === 'dark' ? DARK_THEME_COLORS : LIGHT_THEME_COLORS;
  const messages = chatHistories[activeAgentId || ''] || [];
  const activeAgent = agents.find(a => a.id === activeAgentId);

  // Load everything from localStorage on initial render
  useEffect(() => {
    // Load settings
    const savedProvider = localStorage.getItem('apiProvider') as ApiProvider | null;
    const savedKey = localStorage.getItem('openRouterKey');
    const savedModel = localStorage.getItem('openRouterModel');
    const savedMcpEndpoint = localStorage.getItem('mcpEndpoint');
    const savedMcpKey = localStorage.getItem('mcpApiKey');
    const savedMcpModel = localStorage.getItem('mcpModelId');
    const savedTheme = localStorage.getItem('theme') as Theme | null;

    if (savedProvider) setApiProvider(savedProvider);
    if (savedKey) setOpenRouterKey(savedKey);
    if (savedModel) setOpenRouterModel(savedModel);
    if (savedMcpEndpoint) setMcpEndpoint(savedMcpEndpoint);
    if (savedMcpKey) setMcpApiKey(savedMcpKey);
    if (savedMcpModel) setMcpModelId(savedMcpModel);
    if (savedTheme) setTheme(savedTheme);

    // Load agents and chats
    const savedAgents = localStorage.getItem('agents');
    const savedHistories = localStorage.getItem('chatHistories');
    const savedActiveId = localStorage.getItem('activeAgentId');

    let loadedAgents: Agent[] = savedAgents ? JSON.parse(savedAgents) : [];
    let loadedHistories = savedHistories ? JSON.parse(savedHistories) : {};

    if (loadedAgents.length === 0) {
      const defaultAgentId = 'agent-initial';
      const welcomeText = `Inicializando... Conexión segura establecida.\nBienvenido a la Terminal. Haz clic en el engranaje para cambiar la configuración o en "+ Nuevo Agente" para empezar.`;
      const defaultAgent: Agent = { id: defaultAgentId, name: 'General', instructions: 'Eres un asistente de IA general, útil y amigable.', tools: [] };
      loadedAgents = [defaultAgent];
      loadedHistories = { [defaultAgentId]: [{ id: 'initial-message', role: 'model', text: welcomeText }] };
      setActiveAgentId(defaultAgentId);
    } else {
      setActiveAgentId(savedActiveId && loadedAgents.some(a => a.id === savedActiveId) ? savedActiveId : loadedAgents[0].id);
    }
    
    setAgents(loadedAgents);
    setChatHistories(loadedHistories);
  }, []);

  // Save agent state to localStorage
  useEffect(() => {
    if (agents.length > 0) {
      localStorage.setItem('agents', JSON.stringify(agents));
      localStorage.setItem('chatHistories', JSON.stringify(chatHistories));
      if (activeAgentId) {
        localStorage.setItem('activeAgentId', activeAgentId);
      }
    }
  }, [agents, chatHistories, activeAgentId]);
  
  // Apply theme class to body
  useEffect(() => {
    document.body.classList.toggle('light-theme', theme === 'light');
  }, [theme]);

  // Auto-scroll to the bottom
  useEffect(() => {
      if (mainRef.current) {
          mainRef.current.scrollTop = mainRef.current.scrollHeight;
      }
  }, [messages, isLoading]);
  
  // Adjust textarea height and focus
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${scrollHeight}px`;
      if (!isLoading) {
        textareaRef.current.focus();
      }
    }
  }, [input, isLoading]);

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !activeAgentId || !activeAgent) return;

    const userMessageText = input.trim();
    
    if (userMessageText.toLowerCase() === 'clear') {
        setChatHistories(prev => ({ ...prev, [activeAgentId]: [] }));
        setInput('');
        return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: userMessageText,
    };

    const newHistory = [...(chatHistories[activeAgentId] || []), userMessage];
    setChatHistories(prev => ({...prev, [activeAgentId]: newHistory}));
    setInput('');
    setIsLoading(true);
    setError(null);

    const modelMessageId = `model-${Date.now()}`;
    
    const updateHistory = (newText: string, isFirstChunk: boolean, messageId?: string) => {
        const idToUpdate = messageId || modelMessageId;
        setChatHistories(prev => {
            const currentHistory = prev[activeAgentId] || [];
            if (isFirstChunk) {
                return {...prev, [activeAgentId]: [...currentHistory, {id: idToUpdate, role: 'model', text: newText}]};
            } else {
                return {...prev, [activeAgentId]: currentHistory.map(m => m.id === idToUpdate ? {...m, text: newText} : m)};
            }
        });
    };
    
    try {
        if (apiProvider === 'openrouter') {
            await handleOpenRouterStream(userMessage.text, newHistory.slice(0, -1), activeAgent.instructions, updateHistory);
        } else if (apiProvider === 'mcp') {
            await handleMcpStream(userMessage.text, newHistory.slice(0, -1), activeAgent.instructions, updateHistory);
        } else {
            await handleGoogleGeminiStream(newHistory, activeAgent, updateHistory);
        }
    } catch (e: any) {
      console.error(e);
      const errorMessage = e.message || 'Ocurrió un error desconocido. Revisa la configuración.';
      updateHistory(errorMessage, chatHistories[activeAgentId]?.find(m => m.id === modelMessageId) === undefined);
      setChatHistories(prev => ({...prev, [activeAgentId]: prev[activeAgentId].map(m => m.id === modelMessageId ? {...m, isError: true} : m)}));
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, apiProvider, openRouterKey, openRouterModel, mcpApiKey, mcpModelId, mcpEndpoint, chatHistories, activeAgentId, activeAgent]);

  const handleGoogleGeminiStream = async (
    history: ChatMessage[],
    agent: Agent,
    updateFn: (t: string, f: boolean, id?: string) => void,
  ) => {
    if (!process.env.API_KEY) throw new Error("La variable de entorno API_KEY de Google no está configurada.");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
    let contents = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));
  
    const useGoogleSearch = agent.tools?.includes('native_google_search') ?? false;
  
    // --- Google Search Logic ---
    if (useGoogleSearch) {
      const result = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction: agent.instructions,
          tools: [{ googleSearch: {} }],
        },
      });
  
      let fullResponse = '';
      let firstChunk = true;
      let groundingMetadata: GroundingChunk[] | undefined;
  
      for await (const chunk of result) {
        const text = chunk.text;
        if (text) {
          fullResponse += text;
          updateFn(fullResponse, firstChunk);
          if (firstChunk) firstChunk = false;
        }
        if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
            groundingMetadata = chunk.candidates[0].groundingMetadata.groundingChunks;
        }
      }
      
      if (groundingMetadata && groundingMetadata.length > 0) {
        const sources = groundingMetadata
            .map(chunk => chunk.web?.uri && `* [${chunk.web.title || chunk.web.uri}](${chunk.web.uri})`)
            .filter(Boolean); // Filtrar nulos o indefinidos
        
        if (sources.length > 0) {
            fullResponse += `\n\n---\n**Fuentes:**\n${sources.join('\n')}`;
            updateFn(fullResponse, false); // Update with sources appended
        }
      }
      return;
    }
  
    // --- Custom Tools (Function Calling) Logic ---
    const customTools = agent.tools
      ?.filter(toolId => toolId !== 'native_google_search')
      .map(toolId => toolRegistry[toolId]?.declaration)
      .filter(Boolean) || [];

    const result = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents, // Corrected: Pass the full history
      config: {
        systemInstruction: agent.instructions,
        tools: customTools.length > 0 ? [{ functionDeclarations: customTools }] : undefined,
      },
    });
  
    let fullResponse = '';
    let firstChunk = true;
    let functionCalls: FunctionCall[] = [];
  
    for await (const chunk of result) {
      if (chunk.functionCalls) {
        functionCalls.push(...chunk.functionCalls);
      } else {
        const text = chunk.text;
        if (text) {
          fullResponse += text;
          updateFn(fullResponse, firstChunk);
          if (firstChunk) firstChunk = false;
        }
      }
    }
  
    if (functionCalls.length > 0) {
      const toolUseText = `------------------\n[🔧 Usando herramienta: ${functionCalls.map(fc => `${fc.name}(${JSON.stringify(fc.args)})`).join(', ')}...]\n----------------------`;
      
      const toolResults = await Promise.all(
        functionCalls.map(async (fc) => {
          const tool = Object.values(toolRegistry).find(t => t.declaration.name === fc.name);
          if (tool && tool.execute) {
            const result = await tool.execute(fc.args);
            return { functionResponse: { name: fc.name, response: { result } } };
          }
          return { functionResponse: { name: fc.name, response: { error: 'Herramienta no encontrada o no ejecutable' } } };
        })
      );
      
      const conversationHistoryForNextTurn = [
        ...contents,
        { role: 'model' as const, parts: functionCalls.map(fc => ({ functionCall: fc })) },
        { role: 'function' as const, parts: toolResults },
      ];

      const secondResult = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: conversationHistoryForNextTurn,
        config: {
          systemInstruction: agent.instructions,
          tools: customTools.length > 0 ? [{ functionDeclarations: customTools }] : undefined,
        },
      });
  
      let finalResponseText = '';
      firstChunk = true;
      const finalMessageId = `model-${Date.now()}`;
      for await (const chunk of secondResult) {
        const text = chunk.text;
        if(text) {
          finalResponseText += text;
          const combinedText = `${toolUseText}\n\n${finalResponseText}`;
          updateFn(combinedText, firstChunk, finalMessageId);
          if (firstChunk) firstChunk = false;
        }
      }
    }
  };
  
  const handleOpenRouterStream = async (text: string, history: ChatMessage[], systemInstruction: string, updateFn: (t: string, f: boolean) => void) => {
      if (!openRouterKey || !openRouterModel) {
          throw new Error("La clave de API y el modelo de OpenRouter deben estar configurados.");
      }
      
      const messages = history.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.text
      }));

      const payload = {
        model: openRouterModel,
        messages: [
            { role: 'system', content: systemInstruction },
            ...messages, 
            { role: 'user', content: text }
        ],
        stream: true,
      };

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
              "Authorization": `Bearer ${openRouterKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://terminal.gemini",
              "X-Title": "Terminal Gemini"
          },
          body: JSON.stringify(payload),
      });

      if (!response.ok) {
          const errorData = await response.json();
          let message = errorData.error?.message || response.statusText;
          if (message.includes('data policy')) {
            message += '\n\n**Solución:** Visita [tus ajustes de privacidad de OpenRouter](https://openrouter.ai/settings/privacy) y activa la opción para permitir el registro de datos para modelos gratuitos.'
          }
          throw new Error(`Error de OpenRouter: ${message}`);
      }
      await processStream(response, updateFn);
  };

  const handleMcpStream = async (text: string, history: ChatMessage[], systemInstruction: string, updateFn: (t: string, f: boolean) => void) => {
    if (!mcpApiKey || !mcpModelId || !mcpEndpoint) {
        throw new Error("El endpoint, la clave de API y el ID del modelo de MCP deben estar configurados.");
    }
    
    const messages = history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.text
    }));
    
    const payload = {
        model: mcpModelId,
        messages: [
            { role: 'system', content: systemInstruction },
            ...messages,
            { role: 'user', content: text }
        ],
        stream: true,
    };
    
    const response = await fetch(mcpEndpoint, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${mcpApiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorData = await response.json();
        const message = errorData.error?.message || response.statusText;
        throw new Error(`Error de MCP: ${message}`);
    }
    await processStream(response, updateFn);
  };
  
  const processStream = async (response: Response, updateFn: (t: string, f: boolean) => void) => {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let firstChunk = true;
      while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n\n');
          for (const line of lines) {
              if (line.startsWith('data: ')) {
                  const data = line.substring(6);
                  if (data === '[DONE]') break;
                  try {
                      const json = JSON.parse(data);
                      const content = json.choices[0]?.delta?.content || '';
                      if (content) {
                          fullResponse += content;
                          updateFn(fullResponse, firstChunk);
                          if (firstChunk) firstChunk = false;
                      }
                  } catch (e) {
                      console.error("Error al analizar el fragmento de stream:", e);
                  }
              }
          }
      }
  };

  const handleOpenCreateAgentModal = () => {
    setEditingAgent(null);
    setIsAgentModalOpen(true);
  };
  
  const handleOpenEditAgentModal = (agent: Agent) => {
    setEditingAgent(agent);
    setIsAgentModalOpen(true);
  };
  
  const handleSaveAgent = (agentData: Omit<Agent, 'id'>) => {
    const callback = (prevAgents: Agent[]) => {
      if (editingAgent && 'id' in editingAgent) { // Editing existing agent
        return prevAgents.map(a => a.id === editingAgent.id ? { ...a, ...agentData } : a);
      } else { // Creating new agent
        const newId = `agent-${Date.now()}`;
        const newAgent: Agent = { id: newId, ...agentData };
        setChatHistories(prevHistories => ({ ...prevHistories, [newId]: [] }));
        setActiveAgentId(newId);
        return [...prevAgents, newAgent];
      }
    };
    setAgents(callback);
    setIsAgentModalOpen(false);
    setEditingAgent(null);
  };

  const handleDeleteAgent = (agentId: string) => {
    const agentToDelete = agents.find(a => a.id === agentId);
    if (!agentToDelete) return;
    if (confirm(`¿Estás seguro de que quieres eliminar al agente "${agentToDelete.name}"? Se perderá todo el historial.`)) {
      setAgents(prev => prev.filter(a => a.id !== agentId));
  
      setChatHistories(prev => {
        const newHistories = { ...prev };
        delete newHistories[agentId];
        return newHistories;
      });
  
      if (activeAgentId === agentId) {
        setAgents(prevAgents => {
            setActiveAgentId(prevAgents.length > 0 ? prevAgents[0].id : null);
            return prevAgents;
        });
      }
    }
  };
  
  const TimelineNode = ({ color, showLine }: { color: string; showLine: boolean }) => (
    <>
      <div className="absolute top-3 left-2 h-full w-4 flex justify-center">
        {showLine && <div className="w-0.5 h-full" style={{ backgroundColor: 'var(--border-color)' }} />}
      </div>
      <div
        className="absolute top-3 left-[5px] w-3 h-3 rounded-full border-2"
        style={{ backgroundColor: color, borderColor: 'var(--border-color)' }}
      />
    </>
  );

  const modelLabel = apiProvider === 'google' ? 'Gemini' : apiProvider === 'openrouter' ? 'OpenRouter' : 'MCP';

  return (
    <>
    <aside className="sidebar">
        <h1 className="sidebar-header">Agentes</h1>
        <div className="agent-list">
            {agents.map(agent => (
                <div key={agent.id} className={`agent-item ${activeAgentId === agent.id ? 'active' : ''}`} onClick={() => setActiveAgentId(agent.id)}>
                    <span>{agent.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="delete-icon" onClick={(e) => { e.stopPropagation(); handleOpenEditAgentModal(agent); }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
                          <path fillRule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5z"/>
                        </svg>
                      </span>
                      {agents.length > 1 && (
                        <span className="delete-icon" onClick={(e) => { e.stopPropagation(); handleDeleteAgent(agent.id); }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
                              <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
                          </svg>
                        </span>
                      )}
                    </div>
                </div>
            ))}
        </div>
        <div className="new-agent-btn" onClick={handleOpenCreateAgentModal}>
            + Nuevo Agente
        </div>
    </aside>
    <div className="main-content-wrapper font-mono p-4">
      <header className="absolute top-4 right-4 z-10">
          <svg onClick={() => setIsSettingsOpen(true)} className="w-6 h-6 settings-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.44,0.17-0.48,0.41L9.22,5.72C8.63,5.96,8.1,6.29,7.6,6.67L5.21,5.71C5,5.64,4.75,5.7,4.63,5.92L2.71,9.24 c-0.11,0.2-0.06,0.47,0.12,0.61l2.03,1.58C4.82,11.69,4.8,12.01,4.8,12.33c0,0.32,0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.38,2.91 c0.04,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17-0.48,0.41l0.38-2.91c0.59-0.24,1.12-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0.02,0.59-0.22l1.92-3.32c0.12-0.2,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
          </svg>
      </header>
      
      <main ref={mainRef} className="flex-1 overflow-y-auto pr-2">
        {messages.map((msg, i) => {
          const color = currentColors[Math.floor(i / 2) % currentColors.length];
          return (
            <div key={msg.id} className="relative pl-10 pb-4">
              <TimelineNode color={color} showLine={i > 0} />
              
              {msg.role === 'user' && (
                  <div>
                      <p style={{ color: 'var(--user-label-color)' }} className="font-bold">User</p>
                      <p className="flex-1 whitespace-pre-wrap mt-1" style={{color: 'var(--text-primary)'}}>{msg.text}</p>
                  </div>
              )}
              {msg.role === 'model' && (
                  <div>
                    <p style={{ color: msg.isError ? 'var(--error-label-color)' : 'var(--gemini-label-color)' }} className="font-bold">{msg.isError ? 'Error' : modelLabel}</p>
                    <div 
                        className="prose prose-p:my-0 prose-headings:my-2 max-w-none"
                        style={{
                          '--tw-prose-body': 'var(--text-secondary)', 
                          '--tw-prose-code': 'var(--user-label-color)', 
                          '--tw-prose-strong': 'var(--text-primary)',
                          '--tw-prose-headings': 'var(--text-primary)',
                          color: msg.isError ? 'var(--error-label-color)' : 'inherit',
                        } as React.CSSProperties}
                        dangerouslySetInnerHTML={{ __html: window.DOMPurify.sanitize(window.marked.parse(msg.text)) }} 
                     />
                  </div>
              )}
            </div>
          );
        })}
        {isLoading && (
            <div className="relative pl-10 pb-4">
              <TimelineNode color={currentColors[Math.floor(messages.length / 2) % currentColors.length]} showLine={messages.length > 0} />
              <div className="flex items-center gap-2 pt-0.5">
                  <p style={{ color: 'var(--gemini-label-color)' }} className="font-bold">{modelLabel}</p>
                  <div style={{ backgroundColor: currentColors[Math.floor(messages.length / 2) % currentColors.length] }} className="w-2.5 h-5 blinking-cursor"></div>
              </div>
            </div>
        )}
      </main>

      {!isLoading && (
        <footer className="mt-2 relative pl-10">
           <TimelineNode color={currentColors[Math.floor(messages.length / 2) % currentColors.length]} showLine={messages.length > 0} />
          <form onSubmit={handleSendMessage} className="flex items-start gap-2">
            <label htmlFor="chat-input" className="font-bold" style={{ color: currentColors[Math.floor(messages.length / 2) % currentColors.length] }}>&gt;</label>
            <textarea
              id="chat-input"
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder="Escribe tu comando..."
              className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none resize-none p-0 m-0 themed-placeholder"
              style={{color: 'var(--text-primary)'}}
              rows={1}
              disabled={isLoading || !activeAgent}
              aria-label="Chat input"
            />
          </form>
        </footer>
       )}

       <AgentModal 
        isOpen={isAgentModalOpen}
        onClose={() => setIsAgentModalOpen(false)}
        onSave={handleSaveAgent}
        agentToEdit={editingAgent}
       />

       <SettingsModal 
         isOpen={isSettingsOpen}
         onClose={() => setIsSettingsOpen(false)}
         apiProvider={apiProvider}
         setApiProvider={setApiProvider}
         openRouterKey={openRouterKey}
         setOpenRouterKey={setOpenRouterKey}
         openRouterModel={openRouterModel}
         setOpenRouterModel={setOpenRouterModel}
         mcpEndpoint={mcpEndpoint}
         setMcpEndpoint={setMcpEndpoint}
         mcpApiKey={mcpApiKey}
         setMcpApiKey={setMcpApiKey}
         mcpModelId={mcpModelId}
         setMcpModelId={setMcpModelId}
         theme={theme}
         setTheme={setTheme}
       />
    </div>
    </>
  );
};

export default App;