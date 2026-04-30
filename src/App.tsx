/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { parseCSVData } from './lib/parser';
import { sampleCSV } from './data/sample';
import { CallData } from './lib/types';
import { UploadCloud, FileSpreadsheet, Trash2, ChevronDown, Check, BarChart3, ListTree, LayoutGrid, RefreshCw, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import * as XLSX from 'xlsx';

type PageType = 'atendimentos' | 'chamados';

export default function App() {
  const [data, setData] = useState<CallData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<PageType>('atendimentos');
  const [isNavOpen, setIsNavOpen] = useState(false);

  useEffect(() => {
    // Start with empty state, requiring user to upload CSV or Excel
    setData([]);
    setIsLoading(false);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    e.preventDefault();
    setError(null);
    let files: FileList | null = null;
    if ('dataTransfer' in e) {
      files = e.dataTransfer.files;
    } else {
      files = e.target.files;
    }
    
    if (!files || files.length === 0) return;

    setIsLoading(true);
    let allParsedData: CallData[] = [];
    let hasMovidesk = false;

    const processFile = (file: File): Promise<void> => {
      return new Promise((resolve, reject) => {
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
        const reader = new FileReader();
        
        reader.onload = (evt) => {
          try {
            let text = '';
            if (isExcel) {
              const data = new Uint8Array(evt.target?.result as ArrayBuffer);
              const workbook = XLSX.read(data, { type: 'array' });
              const firstSheetName = workbook.SheetNames?.[0];
              if (!firstSheetName) {
                resolve();
                return;
              }
              const worksheet = workbook.Sheets[firstSheetName];
              if (!worksheet) {
                resolve();
                return;
              }
              // Use sheet_to_csv but with raw: false to get formatted strings as seen in Excel
              text = XLSX.utils.sheet_to_csv(worksheet, { blankrows: false });
            } else {
              text = evt.target?.result as string;
            }

            if (typeof text === 'string') {
              const parsedData = parseCSVData(text);
              if (parsedData.length > 0) {
                allParsedData = [...allParsedData, ...parsedData];
                if (parsedData.some(d => d.origin === 'Movidesk')) {
                  hasMovidesk = true;
                }
              }
            }
            resolve();
          } catch (err) {
            reject(err);
          }
        };

        reader.onerror = () => reject(new Error('Erro ao ler arquivo'));

        if (isExcel) {
          reader.readAsArrayBuffer(file);
        } else {
          reader.readAsText(file);
        }
      });
    };

    try {
      const fileArray = Array.from(files);
      await Promise.all(fileArray.map(file => processFile(file)));

      if (allParsedData.length === 0) {
        setError('Nenhum dado válido encontrado nas planilhas selecionadas. Verifique os formatos (GoTo, Chat ou Movidesk).');
      } else {
        setData(prev => [...prev, ...allParsedData]);
        if (hasMovidesk) {
          setCurrentPage('chamados');
        } else {
          setCurrentPage('atendimentos');
        }
      }
    } catch (err) {
      console.error('Erro ao processar arquivos:', err);
      setError('Ocorreu um erro ao processar um ou mais arquivos. Certifique-se de que são formatos compatíveis.');
    } finally {
      setIsLoading(false);
    }
    
    if ('target' in e && 'value' in (e.target as any)) {
       (e.target as any).value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-gray-900 font-sans">
      {/* Header / Upload section mapped to top bar style */}
      <div className="bg-white border-b border-slate-200 shadow-sm mb-6 sticky top-0 z-[100]">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-8 pt-4">
          <div className="flex flex-col md:flex-row justify-between items-center pb-4 gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <img src="https://i.imgur.com/FOBkZRr.png" alt="LBC" className="h-8 w-auto object-contain" />
              <h1 className="font-bold text-slate-800 text-lg">Workspace</h1>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
              {data.length > 0 && (
                <span className="text-xs font-medium text-slate-400 mr-2 max-w-[200px] truncate hidden md:block">
                  {data.length} registros carregados
                </span>
              )}
              
              {data.length > 0 && (
                <>
                  <label className="cursor-pointer bg-[#16a34a] hover:bg-[#15803d] text-white px-4 py-2 rounded-md flex items-center gap-2 text-[11px] font-bold tracking-wide transition-colors shadow-sm">
                    <Download className="h-3.5 w-3.5" />
                    SOMAR NOVA
                    <input 
                      type="file" 
                      accept=".csv, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                      className="hidden" 
                      onChange={handleFileUpload}
                    />
                  </label>
                  
                  <button 
                    onClick={() => setData([])}
                    className="cursor-pointer bg-[#f8fafc] text-slate-600 border border-slate-200 hover:bg-slate-100 px-4 py-2 rounded-md flex items-center gap-2 text-[11px] font-bold tracking-wide transition-colors shadow-sm"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                    NOVO
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Tabs Navigation */}
          {data.length > 0 && (
            <div className="flex items-center gap-8 border-t border-slate-100 overflow-x-auto w-full pt-1">
              <button
                onClick={() => setCurrentPage('atendimentos')}
                className={`flex items-center gap-2 py-3 px-1 border-b-[3px] text-[11px] font-black uppercase tracking-wider transition-colors whitespace-nowrap ${
                  currentPage === 'atendimentos'
                    ? 'border-[#2563eb] text-[#2563eb]'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                ANÁLISE DE ATENDIMENTOS
              </button>

              <button
                onClick={() => setCurrentPage('chamados')}
                className={`flex items-center gap-2 py-3 px-1 border-b-[3px] text-[11px] font-black uppercase tracking-wider transition-colors whitespace-nowrap ${
                  currentPage === 'chamados'
                    ? 'border-[#2563eb] text-[#2563eb]'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <ListTree className="h-4 w-4" />
                ANÁLISE DE CHAMADOS
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 md:px-8 pb-8 space-y-6">
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between">
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Dashboard Content */}
        {isLoading ? (
          <div className="flex items-center justify-center p-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : data.length > 0 ? (
          <Dashboard data={data} view={currentPage} />
        ) : (
          <div className="flex items-center justify-center min-h-[400px] max-w-3xl mx-auto w-full">
            <label 
              onDrop={handleFileUpload}
              onDragOver={handleDragOver}
              className="relative flex flex-col items-center justify-center w-full p-16 bg-white rounded-[2rem] border-2 border-dashed border-blue-200 hover:border-blue-500 hover:bg-blue-50/30 cursor-pointer transition-all duration-300 gap-6 select-none shadow-sm hover:shadow-xl group"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 to-transparent rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="relative w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center ring-8 ring-white shadow-inner group-hover:scale-110 transition-transform duration-500">
                <UploadCloud className="h-10 w-10 text-blue-600" />
                <div className="absolute -top-1 -right-1 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md ring-4 ring-white">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
              </div>
              
              <div className="text-center space-y-3 relative z-10 max-w-md">
                <h3 className="font-bold text-2xl text-slate-800 tracking-tight">Importar Planilhas</h3>
                <p className="text-[15px] text-slate-500 leading-relaxed">
                  Arraste e solte seus arquivos <strong className="text-slate-700">.CSV</strong> ou <strong className="text-slate-700">.XLSX</strong> aqui, ou clique para selecionar.
                  <br />
                  <span className="text-sm text-blue-600 font-medium inline-block mt-3 bg-blue-50 px-3 py-1 rounded-full">Compatível com registros GoTo, Chat e Movidesk</span>
                </p>
              </div>
              
              <div className="relative z-10 mt-2 px-8 py-3.5 bg-blue-600 text-white rounded-full font-semibold text-sm shadow-md group-hover:bg-blue-700 transition-colors flex items-center gap-2">
                Selecionar Arquivos
              </div>

              <input 
                type="file" 
                multiple
                accept=".csv, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
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

