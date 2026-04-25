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
    
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        let text = '';
        if (isExcel) {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          text = XLSX.utils.sheet_to_csv(worksheet);
        } else {
          text = evt.target?.result as string;
        }

        if (typeof text === 'string') {
          const parsedData = parseCSVData(text);
          if (parsedData.length === 0) {
            setError('Nenhum dado válido encontrado na planilha. Verifique se o formato está correto (GoTo ou Chat).');
          } else {
            setData(prev => [...prev, ...parsedData]);
          }
        }
      } catch (err) {
        console.error('Erro ao processar arquivo:', err);
        setError('Ocorreu um erro ao processar o arquivo. Certifique-se de que é um formato compatível.');
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      console.error('Erro na leitura do arquivo');
      setError('Erro ao ler o arquivo selecionado.');
      setIsLoading(false);
    };
    
    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
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
      <div className="bg-white border-b border-slate-200 shadow-sm mb-6">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 pt-4">
          <div className="flex flex-col md:flex-row justify-between items-center pb-4 gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <img src="https://i.imgur.com/FOBkZRr.png" alt="LBC" className="h-8 w-auto object-contain" />
              <h1 className="font-bold text-slate-800 text-lg">Dashboard</h1>
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

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 pb-8 space-y-6">
        
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
                <p className="text-sm text-slate-500">Clique ou arraste o CSV ou XLSX do GoTo</p>
              </div>
              <input 
                type="file" 
                accept=".csv, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
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
                <p className="text-sm text-slate-500">Clique ou arraste o CSV ou XLSX do Chat</p>
              </div>
              <input 
                type="file" 
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

