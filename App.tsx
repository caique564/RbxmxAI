
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { RobloxAsset, ChatMessage, ProjectState } from './types';
import { buildRbxmx, parseRbxmx } from './utils/xmlBuilder';

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [explorerRoot, setExplorerRoot] = useState<RobloxAsset>({
    id: 'root',
    name: 'Workspace',
    className: 'DataModel',
    children: []
  });
  const [projectName, setProjectName] = useState('Novo Jogo Roblox');
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: (process.env as any).API_KEY });
      const model = 'gemini-3-pro-preview';

      const systemPrompt = `Você é um Engenheiro de Jogos Sênior especialista em Roblox e formato XML (.rbxmx). 
      Seu objetivo é ajudar o usuário a criar jogos complexos. 
      Sempre que o usuário pedir para criar algo (Scripts, UIs, Modelos), você deve responder com o código Luau e a estrutura necessária.
      Mantenha em memória a hierarquia do projeto: ${JSON.stringify(explorerRoot, null, 2)}.
      Se gerar novos arquivos, retorne-os em um bloco de código JSON formatado como o objeto RobloxAsset definido.
      Sempre use Luau moderno. Foque em performance, segurança e organização (Folders, ModuleScripts, RemoteEvents).`;

      const response = await ai.models.generateContent({
        model,
        contents: [...messages, userMsg].map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        })),
        config: {
          systemInstruction: systemPrompt,
        }
      });

      const aiText = response.text || "Desculpe, tive um erro ao processar.";
      
      // Tentar extrair ativos gerados (procurando por JSON no texto)
      let detectedAssets: RobloxAsset[] = [];
      const jsonMatch = aiText.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          detectedAssets = Array.isArray(parsed) ? parsed : [parsed];
          
          // Adicionar ao explorador
          setExplorerRoot(prev => ({
            ...prev,
            children: [...prev.children, ...detectedAssets]
          }));
        } catch (e) {
          console.error("Erro ao parsear ativo gerado:", e);
        }
      }

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiText,
        assetsGenerated: detectedAssets,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: 'err',
        role: 'assistant',
        content: "Erro crítico na API. Verifique seu console.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadAsset = (asset: RobloxAsset) => {
    const xml = buildRbxmx(asset);
    const blob = new Blob([xml], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${asset.name}.rbxmx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const parsed = parseRbxmx(text);
        setExplorerRoot(prev => ({
          ...prev,
          children: [...prev.children, parsed]
        }));
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Analisei o arquivo "${file.name}". Ele foi adicionado ao seu Workspace no Explorador. Posso te ajudar a modificá-lo ou expandir suas funcionalidades agora.`,
          timestamp: Date.now()
        }]);
      } catch (err) {
        alert("Erro ao ler o arquivo .rbxmx. Verifique se é um arquivo XML válido do Roblox.");
      }
    };
    reader.readAsText(file);
  };

  const saveProject = () => {
    const state: ProjectState = {
      history: messages,
      explorerRoot,
      projectName
    };
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}_save.json`;
    a.click();
  };

  const loadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const state: ProjectState = JSON.parse(event.target?.result as string);
        setMessages(state.history);
        setExplorerRoot(state.explorerRoot);
        setProjectName(state.projectName);
      } catch (err) {
        alert("Erro ao carregar o arquivo de save.");
      }
    };
    reader.readAsText(file);
  };

  const renderExplorerNode = (node: RobloxAsset, depth = 0) => (
    <div key={node.id} className="select-none">
      <div 
        className="flex items-center gap-2 py-1 px-2 hover:bg-white/5 cursor-pointer rounded transition-colors group"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <i className={`fa-solid ${
          node.className.includes('Script') ? 'fa-scroll text-blue-400' :
          node.className === 'Folder' ? 'fa-folder text-yellow-500' :
          node.className === 'ScreenGui' || node.className.includes('Gui') ? 'fa-window-maximize text-green-400' :
          'fa-cube text-gray-400'
        } text-xs`}></i>
        <span className="text-sm truncate flex-1">{node.name}</span>
        <button 
          onClick={(e) => { e.stopPropagation(); downloadAsset(node); }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:text-white transition-opacity"
          title="Baixar .rbxmx"
        >
          <i className="fa-solid fa-download text-[10px]"></i>
        </button>
      </div>
      {node.children.map(child => renderExplorerNode(child, depth + 1))}
    </div>
  );

  return (
    <div className="flex h-screen bg-[#111] text-gray-200 overflow-hidden">
      {/* Sidebar - Explorador */}
      <div className="w-80 border-r border-white/10 flex flex-col bg-[#161616]">
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
          <h2 className="font-bold flex items-center gap-2">
            <i className="fa-solid fa-sitemap text-blue-500"></i>
            Explorer
          </h2>
          <div className="flex gap-2">
            <button onClick={() => fileInputRef.current?.click()} className="p-1 hover:text-white" title="Importar .rbxmx">
              <i className="fa-solid fa-file-import"></i>
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".rbxmx,.xml" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {renderExplorerNode(explorerRoot)}
        </div>
        <div className="p-4 border-t border-white/10 bg-[#1a1a1a]">
          <div className="text-[10px] uppercase text-gray-500 mb-2 font-bold tracking-wider">Gestão de Projeto</div>
          <div className="flex gap-2">
            <button onClick={saveProject} className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded text-xs border border-white/10 transition-all">
              Salvar Save
            </button>
            <label className="flex-1 py-2 bg-blue-600/20 hover:bg-blue-600/30 rounded text-xs border border-blue-500/30 text-center cursor-pointer transition-all">
              Carregar Save
              <input type="file" onChange={loadProject} className="hidden" accept=".json" />
            </label>
          </div>
        </div>
      </div>

      {/* Main Content - Chat */}
      <div className="flex-1 flex flex-col relative">
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#161616]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
              <i className="fa-solid fa-robot text-white"></i>
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight">{projectName}</h1>
              <span className="text-[10px] text-green-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                Especialista Roblox Ativo
              </span>
            </div>
          </div>
          <div className="flex gap-4">
             <input 
              value={projectName} 
              onChange={(e) => setProjectName(e.target.value)}
              className="bg-transparent border-b border-white/10 text-xs focus:border-blue-500 outline-none px-1 py-1"
             />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4 opacity-50">
              <i className="fa-solid fa-terminal text-4xl mb-2 text-blue-500"></i>
              <h3 className="text-xl font-bold">Inicie sua Criação</h3>
              <p className="text-sm leading-relaxed">
                Peça para eu criar sistemas de UI, scripts de combate, DataStores ou arraste um modelo .rbxmx do Studio para que eu analise.
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-5 py-4 ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/20' 
                  : 'bg-[#222] border border-white/5 text-gray-200'
              }`}>
                <div className="whitespace-pre-wrap text-sm leading-relaxed mono">
                  {msg.content}
                </div>
                {msg.assetsGenerated && msg.assetsGenerated.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Ativos Gerados:</p>
                    <div className="flex flex-wrap gap-2">
                      {msg.assetsGenerated.map((asset, idx) => (
                        <button
                          key={idx}
                          onClick={() => downloadAsset(asset)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-green-600/20 border border-green-500/30 rounded-lg text-xs hover:bg-green-600/30 transition-all"
                        >
                          <i className="fa-solid fa-download"></i>
                          {asset.name}.rbxmx
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-2 text-[10px] opacity-40">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-[#222] border border-white/5 rounded-2xl px-5 py-4 flex gap-2 items-center">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-6 bg-[#161616] border-t border-white/10">
          <div className="relative flex items-center gap-2 bg-[#222] rounded-xl p-2 border border-white/10 focus-within:border-blue-500/50 transition-all">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ex: Crie um sistema de inventário com UI moderna e RemoteEvents..."
              className="flex-1 bg-transparent border-none outline-none text-sm px-3 py-2"
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !input.trim()}
              className="w-10 h-10 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 flex items-center justify-center transition-all shadow-lg shadow-blue-900/20"
            >
              <i className="fa-solid fa-paper-plane text-white text-sm"></i>
            </button>
          </div>
          <p className="text-[10px] text-center mt-3 text-gray-500">
            Dica: Você pode copiar o código JSON gerado e colar no Studio, ou simplesmente baixar o .rbxmx e arrastar.
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;
