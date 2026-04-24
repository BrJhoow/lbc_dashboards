/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { parseCSVData } from './lib/parser';
import { sampleCSV } from './data/sample';
import { CallData } from './lib/types';
import { UploadCloud, FileSpreadsheet, Trash2, ChevronDown, Check, BarChart3, ListTree } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type PageType = 'atendimentos' | 'chamados';

export default function App() {
  const [data, setData] = useState<CallData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<PageType>('atendimentos');
  const [isNavOpen, setIsNavOpen] = useState(false);

  useEffect(() => {
    // Start with empty state, requiring user to upload CSV
    setData([]);
    setIsLoading(false);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    e.preventDefault();
    setError(null);
    let file: File | undefined;
    if ('dataTransfer' in e) {
      file = e.dataTransfer.files?.[0];
    } else {
      file = e.target.files?.[0];
    }
    
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result;
        if (typeof text === 'string') {
          const parsedData = parseCSVData(text);
          if (parsedData.length === 0) {
            setError('Nenhum dado válido encontrado na planilha. Verifique se o formato está correto (GoTo ou Chat).');
          } else {
            setData(prev => [...prev, ...parsedData]);
          }
        }
      } catch (err) {
        console.error('Erro ao processar CSV:', err);
        setError('Ocorreu um erro ao processar o arquivo. Certifique-se de que é um CSV compatível.');
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      console.error('Erro na leitura do arquivo');
      setError('Erro ao ler o arquivo selecionado.');
      setIsLoading(false);
    };
    reader.readAsText(file);
    if ('target' in e && 'value' in (e.target as any)) {
       (e.target as any).value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-gray-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between">
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Header / Upload section */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 relative z-50">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div className="relative">
              <button 
                onClick={() => setIsNavOpen(!isNavOpen)}
                className="flex items-center gap-2 group cursor-pointer text-left"
              >
                <div>
                  <h2 className="font-black text-slate-800 flex items-center gap-2">
                    Dashboard: {currentPage === 'atendimentos' ? 'Análise de Atendimentos' : 'Análise de Chamados'}
                    <ChevronDown className={`h-4 w-4 text-slate-400 group-hover:text-indigo-500 transition-transform duration-300 ${isNavOpen ? 'rotate-180' : ''}`} />
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">Clique para selecionar visualização</p>
                </div>
              </button>

              <AnimatePresence>
                {isNavOpen && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsNavOpen(false)}
                      className="fixed inset-0 z-40 bg-slate-900/5"
                    />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 py-1"
                    >
                      <button 
                        onClick={() => { setCurrentPage('atendimentos'); setIsNavOpen(false); }}
                        className={`w-full p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors text-left ${currentPage === 'atendimentos' ? 'bg-indigo-50/30' : ''}`}
                      >
                        <div className={`p-2 rounded-lg ${currentPage === 'atendimentos' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                          <BarChart3 className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-bold ${currentPage === 'atendimentos' ? 'text-indigo-700' : 'text-slate-700'}`}>Análise de Atendimentos</span>
                            {currentPage === 'atendimentos' && <Check className="h-4 w-4 text-indigo-600" />}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5 uppercase font-medium">Métricas de performance e produtividade</p>
                        </div>
                      </button>

                      <div className="h-px bg-slate-50 mx-2" />

                      <button 
                        onClick={() => { setCurrentPage('chamados'); setIsNavOpen(false); }}
                        className={`w-full p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors text-left ${currentPage === 'chamados' ? 'bg-indigo-50/30' : ''}`}
                      >
                        <div className={`p-2 rounded-lg ${currentPage === 'chamados' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                          <ListTree className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-bold ${currentPage === 'chamados' ? 'text-emerald-700' : 'text-slate-700'}`}>Análise de Chamados</span>
                            {currentPage === 'chamados' && <Check className="h-4 w-4 text-emerald-600" />}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5 uppercase font-medium">Gestão de tickets e histórico detalhado</p>
                        </div>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {data.length > 0 && (
              <button 
                onClick={() => setData([])}
                className="cursor-pointer bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                title="Limpar dados carregados"
              >
                <Trash2 className="h-4 w-4" />
                <span className="text-sm font-medium">Limpar Dados</span>
              </button>
            )}
            {data.length > 0 && (
              <label className="cursor-pointer bg-gray-50 border border-gray-200 hover:bg-gray-100 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
                <UploadCloud className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Somar Nova Planilha</span>
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  onChange={handleFileUpload}
                />
              </label>
            )}
          </div>
        </div>

        {/* Dashboard Content */}
        {isLoading ? (
          <div className="flex items-center justify-center p-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : data.length > 0 ? (
          <Dashboard data={data} view={currentPage} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            <label 
              onDrop={handleFileUpload}
              onDragOver={handleDragOver}
              className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border-2 border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50 cursor-pointer transition-all gap-4 select-none min-h-[300px]"
            >
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                <UploadCloud className="h-8 w-8 text-indigo-600" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-semibold text-lg text-slate-800">Planilha GoTo</h3>
                <p className="text-sm text-slate-500">Clique ou arraste o CSV do GoTo</p>
              </div>
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                onChange={handleFileUpload}
              />
            </label>

            <label 
              onDrop={handleFileUpload}
              onDragOver={handleDragOver}
              className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border-2 border-dashed border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/50 cursor-pointer transition-all gap-4 select-none min-h-[300px]"
            >
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <UploadCloud className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-semibold text-lg text-slate-800">Planilha Chat</h3>
                <p className="text-sm text-slate-500">Clique ou arraste o CSV do Chat</p>
              </div>
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                onChange={handleFileUpload}
              />
            </label>
          </div>
        )}

      </div>
    </div>
  );
}

