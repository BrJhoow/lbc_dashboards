import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CallData } from '../lib/types';
import { format, isWithinInterval, startOfDay, endOfDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend, ReferenceLine, LabelList
} from 'recharts';
import { 
  Download, UploadCloud, Users, PhoneCall, Clock, PhoneMissed, 
  ArrowUpDown, Search, Filter, Calendar as CalendarIcon, ChevronDown, ChevronUp, Check, X,
  CheckCircle2, Timer, TrendingUp, Thermometer, Maximize2, Copy, ChevronLeft, ChevronRight, BarChart2, ListTree, SlidersHorizontal, AlertCircle,
  Trophy, Activity, Hash, Info
} from 'lucide-react';

const getLevenshteinDistance = (a: string, b: string): number => {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
};

const isSimilarSubject = (a: string, b: string, threshold = 0.25) => {
  const nA = a.toLowerCase().trim();
  const nB = b.toLowerCase().trim();
  if (nA === nB) return true;
  
  const maxLen = Math.max(nA.length, nB.length);
  if (nA.length > 5 && nB.length > 5) {
    if (nA.includes(nB) || nB.includes(nA)) return true;
  }

  // Optimize similarity check by only doing Levenshtein if names are of similar length
  const dist = Math.abs(nA.length - nB.length);
  if (dist > maxLen * threshold) return false;

  const distance = getLevenshteinDistance(nA, nB);
  return (distance / maxLen) <= threshold;
};

// Add a hook for debouncing values
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

interface DashboardProps {
  data: CallData[];
  view?: 'atendimentos' | 'chamados';
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#3b82f6', '#82ca9d'];

function formatSeconds(totalSeconds: number) {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const getSlaColor = (val: number) => {
  if (val <= 0) return 'text-slate-400';
  if (val >= 1 && val <= 89) return 'text-rose-600 font-bold'; // RED (SUPERFICIAL)
  if (val >= 90 && val <= 300) return 'text-emerald-600 font-bold'; // GREEN (EFICIENTE)
  if (val >= 301 && val <= 600) return 'text-amber-500 font-bold'; // YELLOW (MODERADO)
  if (val >= 601 && val <= 1200) return 'text-orange-500 font-bold'; // ORANGE (PROLONGADO)
  if (val >= 1201 && val <= 1800) return 'text-blue-600 font-bold'; // BLUE (EXCESSIVO)
  if (val >= 1801) return 'text-red-600 font-bold'; // RED (CRITICAL)
  return 'text-slate-600';
};

const getTotalTalkTimeColor = (val: number) => {
  if (val <= 0) return 'text-slate-400';
  if (val >= 1 && val <= 14400) return 'text-rose-600 font-bold'; // RED (SUPERFICIAL)
  if (val >= 14401 && val <= 28800) return 'text-emerald-600 font-bold'; // GREEN (EFICIENTE)
  if (val >= 28801 && val <= 43200) return 'text-amber-500 font-bold'; // YELLOW (MODERADO)
  if (val >= 43201 && val <= 64800) return 'text-orange-500 font-bold'; // ORANGE (PROLONGADO)
  if (val >= 64801 && val <= 90000) return 'text-blue-600 font-bold'; // BLUE (EXCESSIVO)
  if (val >= 90001) return 'text-red-600 font-bold'; // RED (CRITICAL)
  return 'text-slate-600';
};

const TableFilterDropdown = ({ 
  options, 
  selectedValues, 
  onToggle, 
  onClose 
}: { 
  options: string[], 
  selectedValues: string[], 
  onToggle: (val: string) => void, 
  onClose: () => void 
}) => {
  const [search, setSearch] = useState('');
  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="absolute top-full mt-2 left-0 w-64 bg-white border border-slate-200 shadow-xl rounded-2xl z-50 flex flex-col p-2 overflow-hidden" onClick={e => e.stopPropagation()}>
      <div className="p-2 border-b border-slate-100 mb-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-200 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar..." 
            className="bg-transparent text-[11px] outline-none w-full"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="max-h-56 overflow-y-auto custom-scrollbar flex flex-col gap-0.5">
        <button 
          onClick={() => {
            options.forEach(o => {
              if (selectedValues.length === options.length) {
                 if (selectedValues.includes(o)) onToggle(o);
              } else {
                 if (!selectedValues.includes(o)) onToggle(o);
              }
            });
          }}
          className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 text-[11px] font-bold text-blue-600 transition-colors rounded-lg"
        >
          {selectedValues.length === options.length ? "Desmarcar Todos" : "Marcar Todos"}
        </button>
        {filtered.slice(0, 100).map(opt => (
          <button 
            key={opt}
            onClick={() => onToggle(opt)}
            className={`flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-all rounded-lg text-left ${selectedValues.includes(opt) ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600'}`}
          >
            <span className="text-[11px] truncate flex-1">{opt}</span>
            {selectedValues.includes(opt) && <Check className="h-3 w-3 shrink-0" />}
          </button>
        ))}
        {filtered.length > 100 && (
          <span className="p-3 text-[10px] text-slate-400 text-center font-bold">
            + {filtered.length - 100} valores (use a busca)
          </span>
        )}
        {filtered.length === 0 && <span className="p-4 text-[10px] text-slate-400 text-center uppercase font-black">Nenhum valor</span>}
      </div>
      <div className="p-2 border-t border-slate-100 mt-2 flex justify-end">
        <button 
          onClick={onClose}
          className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all"
        >
          OK
        </button>
      </div>
    </div>
  );
};

interface MetricStep {
  label: string;
  range: string;
  color: string;
  desc?: string;
}

const SLA_METRICS: MetricStep[] = [
  { label: 'SUPERFICIAL', range: '00:01 - 01:29', color: 'bg-rose-500', desc: 'Muito curto' },
  { label: 'EFICIENTE', range: '01:30 - 05:00', color: 'bg-emerald-500', desc: 'Tempo ideal' },
  { label: 'MODERADO', range: '05:01 - 10:00', color: 'bg-amber-500', desc: 'Esperado' },
  { label: 'PROLONGADO', range: '10:01 - 20:00', color: 'bg-orange-500', desc: 'Longo' },
  { label: 'EXCESSIVO', range: '20:01 - 30:00', color: 'bg-blue-500', desc: 'Muito longo' },
  { label: 'CRÍTICO', range: '≥ 30:01', color: 'bg-red-600', desc: 'Crítico' },
];

const TOTAL_TALK_METRICS: MetricStep[] = [
  { label: 'SUPERFICIAL', range: '0 - 4h', color: 'bg-rose-500' },
  { label: 'EFICIENTE', range: '4 - 8h', color: 'bg-emerald-500' },
  { label: 'MODERADO', range: '8 - 12h', color: 'bg-amber-500' },
  { label: 'PROLONGADO', range: '12 - 18h', color: 'bg-orange-500' },
  { label: 'EXCESSIVO', range: '18 - 25h', color: 'bg-blue-500' },
  { label: 'CRÍTICO', range: '≥ 25:01h', color: 'bg-red-600' },
];

const CustomTooltip = ({ title, items, children }: { title: string; items: MetricStep[]; children: React.ReactNode }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  
  const updateCoords = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left + rect.width / 2
      });
    }
  }, []);

  useEffect(() => {
    if (isVisible) {
      updateCoords();
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
    }
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [isVisible, updateCoords]);

  return (
    <div 
      ref={triggerRef}
      className="relative inline-block" 
      onMouseEnter={() => setIsVisible(true)} 
      onMouseLeave={() => setIsVisible(false)} 
      onClick={() => setIsVisible(!isVisible)}
    >
      {children}
      {isVisible && createPortal(
        <div 
          className="fixed z-[9999] p-0 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 pointer-events-none animate-in fade-in zoom-in duration-200 origin-bottom"
          style={{ 
            top: `${coords.top - 12}px`, 
            left: `${coords.left}px`,
            transform: 'translate(-50%, -100%)' 
          }}
        >
           <div className="p-3 border-b border-slate-100 dark:border-slate-800">
             <h4 className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-wider text-center">{title}</h4>
           </div>
           <div className="p-2 space-y-1 w-72">
             {items.map((item, idx) => (
               <div key={idx} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                 <div className={`w-2 h-2 rounded-full shrink-0 ${item.color} shadow-sm shadow-black/10`} />
                 <div className="flex flex-col flex-1 leading-tight">
                   <div className="flex justify-between items-baseline gap-2">
                     <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">{item.label}</span>
                     <span className="text-[9px] font-mono font-medium text-slate-400 dark:text-slate-500">{item.range}</span>
                   </div>
                   {item.desc && <span className="text-[8px] text-slate-400 dark:text-slate-500">{item.desc}</span>}
                 </div>
               </div>
             ))}
           </div>
           {/* Arrow */}
           <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-200 dark:border-t-slate-800" />
           <div className="absolute top-full left-1/2 -translate-x-1/2 mt-[-1px] border-[6px] border-transparent border-t-white dark:border-t-slate-900" />
        </div>,
        document.body
      )}
    </div>
  );
};

function formatPhone(num: string) {
  if (!num || num === 'Unknown' || num === 'Anonymous') return num;
  let digits = num.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 10) {
    digits = digits.slice(2);
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 9) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return num;
}

function formatAgentName(fullName: string) {
  if (!fullName || fullName.trim() === '') return 'Ligações Perdidas';
  const lower = fullName.toLowerCase();
  
  // Custom Mappings and Groupings requested by user
  if (lower.includes('a+b_brener schimit')) return 'Brener Schimit';
  if (lower.includes('a+b_giane oliveira')) return 'Giane Gomes';
  if (lower.includes('a+b_johnny morais') || lower.includes('johnny silva')) return 'Johnny Morais';
  if (lower.includes('a+b_kerlaine lucindro')) return 'Kerlaine Lucindro';
  if (lower.includes('a+b_rodrigo verissimo') || lower.includes('a+b_rodrigo veríssimo') || lower.includes('rodrigo siqueira')) return 'Rodrigo Verissimo';
  if (lower.includes('a+b_vinicius costa')) return 'Vinicius Costa';
  if (lower.includes('c+d_alan santos')) return 'Alan Alves';
  if (lower.includes('c+d_andrezza amorim')) return 'Andrezza Amorim';
  if (lower.includes('c+d_illana rosa')) return 'Illana Rosa';
  if (lower.includes('c+d_johnny viriato')) return 'Johnny Viriato';
  if (lower.includes('c+d_julia oliveira') || lower.includes('c+d_júlia oliveira')) return 'Julia Oliveira';
  if (lower.includes('c+d_marcelo bezzera') || lower.includes('c+d_marcelo bezerra')) return 'Marcelo Bezerra';
  if (lower.includes('c+d_maria luiza')) return 'Maria Luiza';
  if (lower.includes('c+d_nilton moraes')) return 'Nilton Henrique';
  if (lower.includes('c+d_rosile santos') || lower.includes('rosilene')) return 'Rosilene Santos';
  if (lower.includes('c+d_thiago costa')) return 'Thiago Costa';
  if (lower.includes('c+d_victor de')) return 'Victor Oliveira';
  if (lower.includes('c+d_wallacesouza') || lower.includes('c+d_wallace souza') || lower === 'wallace') return 'Wallace Evangelista';

  if (lower.includes('nathan rodrigues') || lower.includes('nathan cesar') || lower.includes('natan santana')) return 'Nathan Santana';

  // Unification requested by user (previously existing)
  if (lower.includes('tamara marques') || lower.includes('tamara costa')) return 'Tamara Costa';
  if (lower.includes('henrique santos')) return 'Wallace Evangelista';
  if (lower.includes('erik silva')) return 'Maria Luiza';

  const parts = fullName.split(/\s*-\s*/);
  const personName = parts[0].trim();
  const nameTokens = personName.split(/\s+/);
  
  // Just use the first two words and capitalize them properly
  const firstTwoNames = nameTokens
    .slice(0, 2)
    .map(t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
    .join(' ');
  
  return firstTwoNames || 'Ligações Perdidas';
}

const TEAM_MAPPING: Record<string, string[]> = {
  'Cart. A+B': ['Rodrigo Verissimo', 'Kerlaine Lucindro', 'Giane Gomes', 'Tamara Costa', 'Vinicius Costa', 'Johnny Morais', 'Brener Schimit'],
  'Cart. C+D+E': ['Johnny Viriato', 'Julia Oliveira', 'Andrezza Amorim', 'Maria Luiza', 'Thiago Costa', 'Nilton Henrique', 'Illana Rosa', 'Marcelo Bezerra', 'Rosilene Santos', 'Wallace Evangelista', 'Victor Oliveira', 'Alan Alves'],
  'N2': ['Gutemberg', 'Wesley Rodrigues', 'Paulo', 'Marcelo Freitas', 'Nathan Santana']
};

// N1 = Cart. A+B + Cart. C+D+E
const ALL_TEAMS = ['Todos', 'Cart. A+B', 'Cart. C+D+E', 'N1', 'N2'];

const SERVICE_SCHEDULES = ['Todos', 'Comercial', 'Plantão - Semana', 'Plantão - Final de Semana'];

function getCallSchedule(date: Date, queue: string): string {
  const day = date.getDay(); // 0: Dom, 1: Seg, 2: Ter, 3: Qua, 4: Qui, 5: Sex, 6: Sáb
  const hours = date.getHours();
  const mins = date.getMinutes();
  const time = hours * 60 + mins;
  const isPlantaoQueue = queue.toLowerCase().includes('plantão n1') || queue.toLowerCase().includes('plantão n2');

  // Boundaries
  const t0830 = 8 * 60 + 30;
  const t0900 = 9 * 60;
  const t1300 = 13 * 60;
  const t1830 = 18 * 60 + 30;

  // Rules requested:
  // FDS Window: Fri 18:30 -> Mon 08:30 (Includes whole Sun, Sat except commercial)
  const isFDSWindow = (day === 5 && time >= t1830) || 
                      (day === 6 && (time < t0900 || time >= t1300)) || 
                      (day === 0) || 
                      (day === 1 && time < t0830);

  // Semana Window: Mon 18:30 -> Fri 08:30 (Includes Tue-Thu nights)
  const isSemanaWindow = (day === 1 && time >= t1830) || 
                         (day >= 2 && day <= 4) || 
                         (day === 5 && time < t0830);

  // Comercial Window: Seg-Sex 08:30-18:30, Sáb 09:00-13:00
  const isComercialWindow = (day >= 1 && day <= 5 && time >= t0830 && time < t1830) || 
                             (day === 6 && time >= t0900 && time < t1300);

  if (isPlantaoQueue) {
    if (isFDSWindow) return 'Plantão - Final de Semana';
    // Any remaining Plantão queue calls belong to Semana
    return 'Plantão - Semana';
  }

  if (isComercialWindow) return 'Comercial';
  if (isFDSWindow) return 'Plantão - Final de Semana';
  if (isSemanaWindow) return 'Plantão - Semana';

  return 'Outros';
}

function getTeamForCall(call: CallData): string {
  const qLower = call.queue.toLowerCase();
  
  // Specific override for Rede Setee -> N2 (User Request)
  if (qLower.includes('rede setee')) return 'N2';

  // 1. By Agent
  if (call.agentName && call.agentName !== 'Ligações Perdidas') {
    for (const [team, agents] of Object.entries(TEAM_MAPPING)) {
      if (agents.some(a => call.agentName.includes(a))) return team;
    }
  }

  // 2. By Queue/Dialed number
  const context = (call.queue + ' ' + (call.dialedNumberName || '')).toLowerCase();
  
  // User Request: Cart A+B should only match "Fila Carteira A" (and presumably B)
  // We already handled Setee above.
  if (qLower === 'fila carteira a' || qLower.includes('carteira b')) return 'Cart. A+B';
  
  if (context.includes('carteira c') || context.includes('carteira d') || context.includes('carteira e')) return 'Cart. C+D+E';
  
  // Levels
  if (context.includes('n2')) return 'N2';
  if (context.includes('n1')) return 'N1';
  
  return 'Outro';
}

const formatToHMM = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) {
    return `${h}h${m.toString().padStart(2, '0')}`;
  }
  return `${m}m${(seconds % 60).toString().padStart(2, '0')}s`;
};

const N1_AGENTS_LIST = [...TEAM_MAPPING['Cart. A+B'], ...TEAM_MAPPING['Cart. C+D+E']];
const N2_AGENTS_LIST = TEAM_MAPPING['N2'];

const AtendimentosView = memo(({ 
  data: viewData, 
  allUniqueValues, 
  onSearchChange, 
  searchTerm,
  dateRange,
  setDateRange,
  initialDateRange
}: { 
  data: CallData[], 
  allUniqueValues: Record<string, string[]>, 
  onSearchChange: (val: string) => void, 
  searchTerm: string,
  dateRange?: DateRange,
  setDateRange: (range: DateRange | undefined) => void,
  initialDateRange?: DateRange
}) => {
  const n1Calls = useMemo(() => viewData.filter(d => N1_AGENTS_LIST.some(ag => d.agentName.includes(ag))), [viewData]);
  const n2Calls = useMemo(() => viewData.filter(d => N2_AGENTS_LIST.some(ag => d.agentName.includes(ag))), [viewData]);

  const n1Answered = useMemo(() => n1Calls.filter(d => d.leftQueueReason === 'answered'), [n1Calls]);
  const n1Total = n1Calls.length;
  const resN1 = n1Total > 0 ? Math.round((n1Answered.length / n1Total) * 100) : 0;
  const escRate = viewData.length > 0 ? Math.round((n2Calls.length / viewData.length) * 100) : 0;
  const avgRespN2 = n2Calls.length > 0 ? Math.round(n2Calls.reduce((acc, curr) => acc + curr.waitTime, 0) / n2Calls.length) : 0;

  return (
    <>
      <MetricsCards 
        data={viewData} 
        dateRange={dateRange} 
        setDateRange={setDateRange} 
        initialDateRange={initialDateRange} 
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 shrink-0">
        <ChartCallsOverTime 
          data={viewData} 
          dateRange={dateRange} 
          setDateRange={setDateRange} 
          initialDateRange={initialDateRange} 
        />
        <ChartAgentPerformance 
          data={viewData} 
          dateRange={dateRange} 
          setDateRange={setDateRange} 
          initialDateRange={initialDateRange} 
        />
      </div>

      <div className="shrink-0 flex flex-col gap-6">
        <AgentPerformanceSummary data={viewData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0 mt-2">
        <div className="lg:col-span-1 h-full">
          <ProductivityCalendar data={viewData} />
        </div>
        
        <div className="lg:col-span-1 flex flex-col gap-6">
          <MetricBox 
            label="Taxa de Resolução no N1" 
            value={`${resN1}%`} 
            icon={CheckCircle2} 
            color="text-emerald-600"
            subtitle="Primeiro contato"
            trendValue="Eficiente"
          />
          <AdvancedRecurrenceIndex data={viewData} />
        </div>

        <div className="lg:col-span-1 flex flex-col gap-6">
          <MetricBox 
            label="Volume de Escalonamento" 
            value={`${escRate}%`} 
            icon={TrendingUp} 
            color="text-amber-600"
            subtitle="N1 para N2"
            trendValue="Sob controle"
          />
          <MetricBox 
            label="Tempo de Resposta N2" 
            value={formatToHMM(avgRespN2)} 
            icon={Timer} 
            color="text-indigo-600"
            subtitle="Média de espera"
            trendValue="Estável"
          />
        </div>
      </div>

      <div className="shrink-0 flex flex-col gap-6 w-full">
        <AgentDetailedProductivityCard data={viewData} />
      </div>

      <div className="shrink-0">
        <RecurringAgentsCard 
          data={viewData} 
          onFilter={(num) => onSearchChange(searchTerm === num ? '' : num)} 
          activeFilter={searchTerm}
        />
      </div>

      <div className="shrink-0">
        <LogsTable data={viewData} allUniqueValues={allUniqueValues} />
      </div>
    </>
  );
});

export function Dashboard({ data: rawData, view = 'atendimentos' }: DashboardProps) {
  // Normalize data first to ensure exact same grouping everywhere between Chat and GoTo.
  const data = useMemo(() => {
    return rawData.map(d => {
      const agentName = formatAgentName(d.agentName);
      const queue = (d.queue || '').toLowerCase();
      const subject = (d.subject || 'Sem assunto').toLowerCase();
      const clientName = (d.clientName || '').toLowerCase();
      const ticketNumber = (d.ticketNumber || '').toLowerCase();
      const callerNumber = (d.callerNumber || '');

      return {
        ...d,
        agentName,
        _status: d.origin === 'Movidesk' ? (d.status || 'Outro') : 
                 (d.leftQueueReason === 'answered' ? 'Atendida' : 
                  d.leftQueueReason === 'abandon' ? (d.waitTime < 60 ? 'Perdida < 1m' : 'Perdida > 1m') : 
                  d.leftQueueReason === 'pendente' ? 'Pendente' : 'Outro'),
        _dateFormatted: isNaN(d.startTime.getTime()) ? '-' : format(d.startTime, 'dd/MM/yyyy'),
        _searchable: `${callerNumber} ${queue} ${agentName.toLowerCase()} ${ticketNumber} ${subject} ${clientName}`,
        _team: getTeamForCall({ ...d, agentName }),
        _schedule: getCallSchedule(d.startTime, d.queue)
      };
    });
  }, [rawData]);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedSchedules, setSelectedSchedules] = useState<string[]>([]);
  const [originFilter, setOriginFilter] = useState<'All' | 'Chat' | 'GoTo' | 'Movidesk'>('All');
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const [isTeamOpen, setIsTeamOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const agentRef = useRef<HTMLDivElement>(null);
  const teamRef = useRef<HTMLDivElement>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);
  
  // Date Picker State
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  const initialDateRange = useMemo(() => {
    if (data.length === 0) return undefined;
    const dates = data.map(d => d.startTime.getTime()).filter(t => !isNaN(t));
    if (dates.length === 0) return undefined;
    
    return {
      from: startOfDay(new Date(Math.min(...dates))),
      to: endOfDay(new Date(Math.max(...dates)))
    };
  }, [data]);

  // Pre-calculate unique values for column filters to avoid expensive re-computations in tables
  const allColumnUniqueValues = useMemo(() => {
    if (!data || data.length === 0) return {};
    const cols: (keyof CallData)[] = [
      'ticketNumber', 'origin', 'startTime', 'waitTime', 'talkDuration', 'agentName', 'queue', 'status', 'leftQueueReason', 'clientName',
      'movedAt', 'resolutionDate', 'team', 'createdBy', 'subject', 'description', 'urgency', 'tags', 'cnpj', 'service', 'type', 'slaN2FirstEntry', 'slaN2FirstExit', 'firstResponseTime', 'totalLifeTime'
    ];
    const result: Record<string, string[]> = {};
    
    cols.forEach(col => {
      const set = new Set<string>();
      data.forEach(d => {
        if (col === 'startTime') {
          set.add(d._dateFormatted || '-');
        } else if (col === 'status' || col === 'leftQueueReason') {
          set.add(d._status || '-');
        } else if (col === 'movedAt' || col === 'resolutionDate' || col === 'slaN2FirstEntry' || col === 'slaN2FirstExit') {
          const val = d[col as keyof CallData];
          set.add(val instanceof Date ? format(val, 'dd/MM/yyyy HH:mm') : String(val || '-'));
        } else {
          set.add(String(d[col] || '-'));
        }
      });
      const arr = Array.from(set);
      if (arr.length < 1000) arr.sort();
      result[col as string] = arr;
    });
    return result;
  }, [data]);

  useEffect(() => {
    if (initialDateRange && !dateRange) {
      setDateRange(initialDateRange);
    }
  }, [initialDateRange, dateRange]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
      if (agentRef.current && !agentRef.current.contains(event.target as Node)) {
        setIsAgentOpen(false);
      }
      if (teamRef.current && !teamRef.current.contains(event.target as Node)) {
        setIsTeamOpen(false);
      }
      if (scheduleRef.current && !scheduleRef.current.contains(event.target as Node)) {
        setIsScheduleOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  // Create an array of unique agents sorted alphabetically
  const uniqueAgents = useMemo(() => {
    const agents = new Set(data.map(d => d.agentName).filter(name => name && name !== 'Ligações Perdidas'));
    return Array.from(agents).sort();
  }, [data]);

  // Derived filtered data
  const filteredData = useMemo(() => {
    const searchLower = debouncedSearch.toLowerCase();
    const isVerySpecific = debouncedSearch.length >= 8 && /^\d+$/.test(debouncedSearch);

    return data.filter(d => {
      const matchSearch = d._searchable.includes(searchLower);
      
      // If search is active, don't restrict by agent unless the search term is very short
      // This allows seeing all interactions of a specific client number.
      let matchAgent = selectedAgents.length === 0 || selectedAgents.includes(d.agentName);
      if (debouncedSearch.length >= 4 && d.callerNumber.includes(debouncedSearch)) {
        matchAgent = true;
      }
      
      // "Ligações Perdidas" should always appear by default unless a very specific search (not matching this call) is active
      if (d.agentName === 'Ligações Perdidas' && !isVerySpecific) {
        matchAgent = true;
      }
      
      // Strict Team/Queue filtering (User Request)
      let matchTeamStrict = true;
      if (selectedTeams.length > 0) {
        matchTeamStrict = selectedTeams.some(t => {
          if (t === 'N1') {
            return (d._team === 'Cart. A+B' || d._team === 'Cart. C+D+E' || d._team === 'N1');
          }
          return d._team === t;
        });
      }

      const matchOrigin = originFilter === 'All' || d.origin === originFilter;
      
      let matchSchedule = true;
      if (selectedSchedules.length > 0) {
        matchSchedule = selectedSchedules.includes(d._schedule);
      }
      
      let matchDate = true;
      if (dateRange?.from && !isNaN(d.startTime.getTime())) {
        const dStart = startOfDay(dateRange.from);
        const dEnd = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        matchDate = d.startTime >= dStart && d.startTime <= dEnd;
      }

      return matchSearch && matchAgent && matchTeamStrict && matchOrigin && matchDate && matchSchedule;
    });
  }, [data, debouncedSearch, selectedAgents, selectedTeams, selectedSchedules, originFilter, dateRange]);

  const toggleTeam = (team: string) => {
    if (team === 'Todos') {
      setSelectedTeams([]);
      setSelectedAgents([]);
      return;
    }

    const newTeams = selectedTeams.includes(team) 
      ? selectedTeams.filter(t => t !== team)
      : [...selectedTeams, team];
    
    setSelectedTeams(newTeams);

    // Update agents based on union of teams
    if (newTeams.length === 0) {
      setSelectedAgents([]);
    } else {
      let allMembers: string[] = [];
      newTeams.forEach(t => {
        if (t === 'N1') {
          allMembers = [...allMembers, ...TEAM_MAPPING['Cart. A+B'], ...TEAM_MAPPING['Cart. C+D+E']];
        } else {
          allMembers = [...allMembers, ...(TEAM_MAPPING[t] || [])];
        }
      });
      
      const matchedFullNames = uniqueAgents.filter(ag => 
        allMembers.some(m => ag.toLowerCase().includes(m.toLowerCase()))
      );
      setSelectedAgents(matchedFullNames);
    }
  };

  const toggleSchedule = (sch: string) => {
    if (sch === 'Todos') {
      setSelectedSchedules([]);
      return;
    }
    setSelectedSchedules(prev => 
      prev.includes(sch) ? prev.filter(s => s !== sch) : [...prev, sch]
    );
  };

  const toggleAgent = (ag: string) => {
    setSelectedAgents(prev => 
      prev.includes(ag) ? prev.filter(a => a !== ag) : [...prev, ag]
    );
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedAgents([]);
    setSelectedTeams([]);
    setSelectedSchedules([]);
    setOriginFilter('All');
    
    // Reset date range
    const dates = data.map(d => d.startTime.getTime()).filter(t => !isNaN(t));
    if (dates.length > 0) {
      const min = new Date(Math.min(...dates));
      const max = new Date(Math.max(...dates));
      setDateRange({
        from: startOfDay(min),
        to: endOfDay(max)
      });
    } else {
      setDateRange(undefined);
    }
  };

  // Derived datasets for sub-views
  const atendimentosData = useMemo(() => filteredData.filter(d => d.origin !== 'Movidesk'), [filteredData]);
  const movideskData = useMemo(() => filteredData.filter(d => d.origin === 'Movidesk'), [filteredData]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8 font-sans transition-all duration-500">
      <div className="max-w-[1600px] mx-auto space-y-8">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sticky top-[112px] z-[70] w-full transition-all duration-300">
        <div className="flex items-center gap-2 mb-4 text-slate-800">
          <SlidersHorizontal className="h-[18px] w-[18px] text-[#2563eb]" strokeWidth={2.5} />
          <h3 className="font-extrabold text-[#1e293b] text-sm uppercase tracking-wide">Painel de Filtros</h3>
        </div>
        
        <div className="flex flex-wrap items-end gap-x-3 gap-y-4 w-full">
          {/* Assunto / Search */}
          <div className="flex flex-col gap-1.5 shrink-0 flex-1 min-w-[140px] max-w-[200px]">
            <span className="text-[10px] font-extrabold text-[#94a3b8] uppercase tracking-wide ml-1">Assunto</span>
            <div className="flex items-center bg-white border border-slate-200 rounded-full h-[36px] px-3 focus-within:ring-2 focus-within:ring-[#2563eb]/20 focus-within:border-[#2563eb] transition-all">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Ex: Instalação..."
                className="bg-transparent text-[12px] px-2 focus:outline-none w-full placeholder:text-slate-400 text-slate-700"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Horário */}
          <div className="flex flex-col gap-1.5 shrink-0 relative flex-1 min-w-[140px] max-w-[170px]" ref={scheduleRef}>
            <span className="text-[10px] font-extrabold text-[#94a3b8] uppercase tracking-wide ml-1">Horário</span>
            <button
              onClick={() => setIsScheduleOpen(!isScheduleOpen)}
              className="flex items-center justify-between bg-white border border-slate-200 rounded-full h-[36px] px-3 w-full hover:border-slate-300 transition-all text-slate-600 focus:ring-2 focus:ring-[#2563eb]/20 focus:outline-none"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="text-[12px] font-medium truncate">
                  {selectedSchedules.length === 0 ? "Todos..." : selectedSchedules.length === 1 ? selectedSchedules[0] : `${selectedSchedules.length} sel.`}
                </span>
              </div>
              <ChevronDown className="h-3 w-3 text-slate-400 shrink-0 ml-1" />
            </button>
            {isScheduleOpen && (
              <div className="absolute top-full mt-2 left-0 w-48 bg-white border border-slate-200 shadow-xl rounded-2xl z-50 flex flex-col py-2">
                {SERVICE_SCHEDULES.map(sch => (
                  <button 
                    key={sch} 
                    onClick={() => toggleSchedule(sch)}
                    className={`text-left px-4 py-2 text-[12px] transition-colors hover:bg-slate-50 flex items-center ${
                      (sch === 'Todos' && selectedSchedules.length === 0) || selectedSchedules.includes(sch) 
                      ? 'bg-indigo-50/50 text-[#2563eb] font-semibold' 
                      : 'text-slate-600'
                    }`}
                  >
                    <div className="w-5 shrink-0 flex items-center">
                      {((sch === 'Todos' && selectedSchedules.length === 0) || selectedSchedules.includes(sch)) && <Check className="h-3.5 w-3.5" />}
                    </div>
                    {sch === 'Todos' ? "Todos os horários..." : sch}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Equipes */}
          <div className="flex flex-col gap-1.5 shrink-0 relative flex-1 min-w-[140px] max-w-[170px]" ref={teamRef}>
            <span className="text-[10px] font-extrabold text-[#94a3b8] uppercase tracking-wide ml-1">Equipes</span>
            <button
              onClick={() => setIsTeamOpen(!isTeamOpen)}
              className="flex items-center justify-between bg-white border border-slate-200 rounded-full h-[36px] px-3 w-full hover:border-slate-300 transition-all text-slate-600 focus:ring-2 focus:ring-[#2563eb]/20 focus:outline-none"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <Users className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="text-[12px] font-medium truncate">
                  {selectedTeams.length === 0 ? "Todas..." : selectedTeams.length === 1 ? selectedTeams[0] : `${selectedTeams.length} sel.`}
                </span>
              </div>
              <ChevronDown className="h-3 w-3 text-slate-400 shrink-0 ml-1" />
            </button>
            {isTeamOpen && (
              <div className="absolute top-full mt-2 left-0 w-48 bg-white border border-slate-200 shadow-xl rounded-2xl z-50 flex flex-col py-2">
                {ALL_TEAMS.map(team => (
                  <button 
                    key={team} 
                    onClick={() => toggleTeam(team)}
                    className={`text-left px-4 py-2 text-[12px] transition-colors hover:bg-slate-50 flex items-center ${
                      (team === 'Todos' && selectedTeams.length === 0) || selectedTeams.includes(team) 
                      ? 'bg-indigo-50/50 text-[#2563eb] font-semibold' 
                      : 'text-slate-600'
                    }`}
                  >
                    <div className="w-5 shrink-0 flex items-center">
                      {((team === 'Todos' && selectedTeams.length === 0) || selectedTeams.includes(team)) && <Check className="h-3.5 w-3.5" />}
                    </div>
                    {team === 'Todos' ? "Todas as equipes..." : team}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Técnicos / Operadores */}
          <div className="flex flex-col gap-1.5 shrink-0 relative flex-1 min-w-[140px] max-w-[170px]" ref={agentRef}>
            <span className="text-[10px] font-extrabold text-[#94a3b8] uppercase tracking-wide ml-1">Técnicos</span>
            <button
              onClick={() => setIsAgentOpen(!isAgentOpen)}
              className="flex items-center justify-between bg-white border border-slate-200 rounded-full h-[36px] px-3 w-full hover:border-slate-300 transition-all text-slate-600 focus:ring-2 focus:ring-[#2563eb]/20 focus:outline-none"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <Users className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="text-[12px] font-medium truncate">
                  {selectedAgents.length === 0 
                  ? "Todos..." 
                  : `${selectedAgents.length} sel.`}
                </span>
              </div>
              <ChevronDown className="h-3 w-3 text-slate-400 shrink-0 ml-1" />
            </button>
            {isAgentOpen && (
              <div className="absolute top-full mt-2 left-0 w-64 bg-white border border-slate-200 shadow-xl rounded-2xl z-50 max-h-72 overflow-y-auto flex flex-col py-2">
                <button 
                  onClick={() => setSelectedAgents([])}
                  className={`text-left px-4 py-2 text-[12px] transition-colors hover:bg-slate-50 flex items-center ${selectedAgents.length === 0 ? 'bg-indigo-50/50 text-[#2563eb] font-semibold' : 'text-slate-600'}`}
                >
                  <div className="w-5 shrink-0 flex items-center">{selectedAgents.length === 0 && <Check className="h-3.5 w-3.5" />}</div>
                  Todos os técnicos...
                </button>
                {uniqueAgents.map(ag => (
                  <button 
                    key={ag} 
                    onClick={() => toggleAgent(ag)}
                    className={`text-left px-4 py-2 text-[12px] transition-colors hover:bg-slate-50 flex items-center ${selectedAgents.includes(ag) ? 'bg-indigo-50/50 text-[#2563eb] font-semibold' : 'text-slate-600'}`}
                  >
                    <div className="w-5 shrink-0 flex items-center">{selectedAgents.includes(ag) && <Check className="h-3.5 w-3.5" />}</div>
                    <span className="truncate">{ag}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Período / Date Range */}
          <div className="flex flex-col gap-1.5 shrink-0 relative flex-[1.5] min-w-[190px] max-w-[230px]" ref={calendarRef}>
            <span className="text-[10px] font-extrabold text-[#94a3b8] uppercase tracking-wide ml-1">Período</span>
            <button 
              type="button"
              className="flex items-center justify-between bg-white border border-slate-200 rounded-full h-[36px] px-3 w-full hover:border-slate-300 transition-all text-slate-600 focus:ring-2 focus:ring-[#2563eb]/20 focus:outline-none"
              onClick={() => setIsCalendarOpen(!isCalendarOpen)}
            >
              <span className="text-[12px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                {dateRange?.from ? (
                  dateRange.to && dateRange.from.getTime() !== dateRange.to.getTime()
                    ? `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`
                    : format(dateRange.from, 'dd/MM/yyyy')
                ) : (
                  "dd/mm/yyyy - dd/mm/yyyy"
                )}
              </span>
              <CalendarIcon className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
            </button>
            
            {isCalendarOpen && (
              <div className="absolute top-full mt-2 right-0 z-50 bg-white border border-slate-200 shadow-xl rounded-2xl p-4">
                <DayPicker
                  mode="range"
                  locale={ptBR}
                  selected={dateRange}
                  onSelect={(range) => {
                    setDateRange(range);
                  }}
                  className="text-sm"
                  styles={{
                    cell: { padding: '4px' },
                    day: { width: '36px', height: '36px', fontSize: '13px' }
                  }}
                />
              </div>
            )}
          </div>

          {/* Right aligned actions: Origem & Clear */}
          <div className="ml-auto flex items-end gap-2 shrink-0">
            {/* Origem */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-extrabold text-[#94a3b8] uppercase tracking-wide ml-1 hidden xl:block">Origem</span>
              <div className="flex bg-slate-50 rounded-full p-1 border border-slate-200 h-[36px] items-center">
                <button
                  onClick={() => setOriginFilter('All')}
                  className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all h-full flex items-center justify-center ${originFilter === 'All' ? 'bg-white text-[#2563eb] shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setOriginFilter('Chat')}
                  className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all h-full flex items-center justify-center ${originFilter === 'Chat' ? 'bg-white text-[#2563eb] shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setOriginFilter('GoTo')}
                  className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all h-full flex items-center justify-center ${originFilter === 'GoTo' ? 'bg-white text-[#2563eb] shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  GoTo
                </button>
                <button
                  onClick={() => setOriginFilter('Movidesk')}
                  className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all h-full flex items-center justify-center ${originFilter === 'Movidesk' ? 'bg-white text-[#2563eb] shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Movis
                </button>
              </div>
            </div>

            {/* Clear Filters */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <span className="text-[10px] font-extrabold text-[#94a3b8] uppercase tracking-wide ml-1 hidden xl:block opacity-0">-</span>
              <button
                onClick={handleClearFilters}
                className="flex items-center justify-center bg-white text-slate-500 w-[36px] h-[36px] rounded-full border border-slate-200 hover:bg-slate-50 hover:text-red-500 transition-colors shrink-0"
                title="Limpar todos os filtros"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {view === 'atendimentos' ? (
        <>
          <AtendimentosView 
            data={atendimentosData} 
            allUniqueValues={allColumnUniqueValues} 
            searchTerm={searchTerm} 
            onSearchChange={setSearchTerm} 
            dateRange={dateRange}
            setDateRange={setDateRange}
            initialDateRange={initialDateRange}
          />
        </>
      ) : (
        <AnalysisOfTicketsView data={movideskData} allUniqueValues={allColumnUniqueValues} />
      )}
    </div>
  </div>
);
}

const MetricBox = memo(({ 
  label, 
  value, 
  icon: Icon, 
  color, 
  subtitle,
  trendValue,
  className
}: { 
  label: string, 
  value: string, 
  icon: any, 
  color: string,
  subtitle?: string,
  trend?: 'up' | 'down' | 'neutral',
  trendValue?: string,
  className?: string
}) => {
  const isVeryLong = value.length > 25;
  const isMediumLong = value.length > 12 && value.length <= 25;
  
  return (
    <div className={`bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between h-[200px] group transition-all duration-300 hover:shadow-indigo-500/10 ${className || ''}`}>
      {/* Abstract pattern background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
         <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
         <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl -ml-24 -mb-24" />
      </div>

      <div className="relative z-10 flex items-center">
         <div className="flex items-center gap-3 w-full">
            <div className={`p-2.5 bg-slate-50 rounded-xl ${color} border border-slate-100 group-hover:scale-110 transition-transform shrink-0`}>
               <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none truncate">{label}</h4>
              <div className="flex items-center justify-between gap-4 mt-1">
                <p className="text-[8px] text-slate-500 uppercase font-black shrink-0">Live updates</p>
                {trendValue && (
                  <div className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border border-indigo-500/10 shrink-0 whitespace-nowrap">
                    {trendValue}
                  </div>
                )}
              </div>
            </div>
         </div>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center flex-1 my-2 overflow-hidden w-full">
          <div className="w-full relative flex justify-center items-center overflow-hidden h-full">
            {isVeryLong ? (
              <div className="w-full overflow-hidden flex whitespace-nowrap mask-fade">
                <motion.div
                  animate={{ x: [0, -100 + "%"] }}
                  transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                  className="flex"
                >
                  <span className="text-lg font-black text-slate-900 tracking-tight pr-12">{value}</span>
                  <span className="text-lg font-black text-slate-900 tracking-tight pr-12">{value}</span>
                  <span className="text-lg font-black text-slate-900 tracking-tight pr-12">{value}</span>
                </motion.div>
              </div>
            ) : (
              <span className={`font-black text-slate-900 tracking-tighter leading-tight text-center ${isMediumLong ? 'text-xl' : 'text-5xl leading-none'}`}>
                {value}
              </span>
            )}
          </div>
          <div className="h-1 w-12 bg-indigo-500 rounded-full mt-3 opacity-50 shrink-0" />
      </div>

      <div className="relative z-10 flex items-end justify-between pt-3 border-t border-slate-100">
        <div className="flex flex-col min-w-0 flex-1">
           <span className="text-[10px] font-black text-slate-900 truncate">{subtitle || 'Métrica'}</span>
           <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest leading-none">Status Atual</span>
        </div>
        
        <div className="flex gap-1 items-end h-6 shrink-0 ml-2">
          {[30, 60, 45, 90, 55].map((h, i) => (
            <div key={i} className={`w-1 rounded-full bg-indigo-500/20`} style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
});

function MetricsCards({ 
  data, 
  dateRange, 
  setDateRange, 
  initialDateRange 
}: { 
  data: CallData[], 
  dateRange?: DateRange, 
  setDateRange: (range: DateRange | undefined) => void,
  initialDateRange?: DateRange
}) {
  const [activeMetric, setActiveMetric] = useState<'avg' | 'total'>('avg');
  const [localAgent, setLocalAgent] = useState('Todos');
  const [isLocalAgentOpen, setIsLocalAgentOpen] = useState(false);
  const localAgentRef = useRef<HTMLDivElement>(null);
  
  // Auto-switch metrics every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveMetric(prev => prev === 'avg' ? 'total' : 'avg');
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (localAgentRef.current && !localAgentRef.current.contains(event.target as Node)) {
        setIsLocalAgentOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const metricAgents = useMemo(() => {
    const agents = new Set(data.filter(d => d.agentName !== 'Ligações Perdidas').map(d => d.agentName));
    return Array.from(agents).sort();
  }, [data]);

  const cardsData = useMemo(() => {
    let filtered = data;
    if (dateRange?.from) {
      const dStart = startOfDay(dateRange.from);
      const dEnd = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
      filtered = filtered.filter(d => d.startTime >= dStart && d.startTime <= dEnd);
    }
    if (localAgent === 'Todos') return filtered;
    return filtered.filter(d => d.agentName === localAgent);
  }, [data, localAgent, dateRange]);

  const totaisData = useMemo(() => {
    if (!dateRange?.from) return data;
    const dStart = startOfDay(dateRange.from);
    const dEnd = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
    return data.filter(d => d.startTime >= dStart && d.startTime <= dEnd);
  }, [data, dateRange]);

  // Variables for Totais de Atendimentos
  const abandonedCalls = totaisData.filter(d => d.leftQueueReason === 'abandon');
  const lostLongWait = abandonedCalls.filter(d => d.waitTime >= 60);
  const lostShortWait = abandonedCalls.filter(d => d.waitTime < 60);
  
  const pendenteCalls = totaisData.filter(d => d.leftQueueReason === 'pendente');
  const answeredCalls = totaisData.filter(d => d.leftQueueReason === 'answered');

  const totalCalls = totaisData.length;
  const abandonRate = totalCalls > 0 ? Math.round((abandonedCalls.length / totalCalls) * 100) : 0;
  const longWaitRate = totalCalls > 0 ? (lostLongWait.length / totalCalls) * 100 : 0;
  const shortWaitRate = totalCalls > 0 ? (lostShortWait.length / totalCalls) * 100 : 0;
  
  const longWaitPerc = abandonedCalls.length > 0 ? Math.round((lostLongWait.length / abandonedCalls.length) * 100) : 0;
  const shortWaitPerc = abandonedCalls.length > 0 ? Math.round((lostShortWait.length / abandonedCalls.length) * 100) : 0;

  const pendenteRate = totalCalls > 0 ? Math.round((pendenteCalls.length / totalCalls) * 100) : 0;
  const answeredRate = totalCalls > 0 ? Math.round((answeredCalls.length / totalCalls) * 100) : 0;

  // Variables for Desempenho de atendimento (Gauge)
  const gaugeAnsweredCalls = cardsData.filter(d => d.leftQueueReason === 'answered');
  const totalTalkTime = cardsData.reduce((acc, curr) => acc + curr.talkDuration, 0);
  const avgTalkTime = gaugeAnsweredCalls.length > 0 
    ? Math.round(totalTalkTime / gaugeAnsweredCalls.length)
    : 0;

  // Gauge Logic - Better thresholds for "Fidelity"
  const GAUGE_MAX = activeMetric === 'avg' ? 1800 : 90000;
  const currentVal = activeMetric === 'avg' ? avgTalkTime : totalTalkTime;
  const currentValClamped = Math.min(currentVal, GAUGE_MAX);
  
  // percent for the needle position (0-100)
  const percent = (currentValClamped / GAUGE_MAX) * 100;

  // Status Color Logic based on User Requirements
  const getStatusInfo = () => {
    const val = currentVal;
    if (val <= 0) return { label: 'AGUARDANDO', color: '#64748b', tailwind: 'text-slate-600 bg-slate-50 border-slate-100' };
    
    if (activeMetric === 'avg') {
      if (val >= 1 && val <= 89) return { label: 'SUPERFICIAL', color: '#EF4444', tailwind: 'text-rose-600 bg-rose-50 border-rose-100' };
      if (val >= 90 && val <= 300) return { label: 'EFICIENTE', color: '#10B981', tailwind: 'text-emerald-600 bg-emerald-50 border-emerald-100' };
      if (val >= 301 && val <= 600) return { label: 'MODERADO', color: '#FBBF24', tailwind: 'text-amber-600 bg-amber-50 border-amber-100' };
      if (val >= 601 && val <= 1200) return { label: 'PROLONGADO', color: '#F97316', tailwind: 'text-orange-600 bg-orange-50 border-orange-100' };
      if (val >= 1201 && val <= 1800) return { label: 'EXCESSIVO', color: '#2563EB', tailwind: 'text-blue-600 bg-blue-50 border-blue-100' };
      if (val >= 1801) return { label: 'CRÍTICO', color: '#DC2626', tailwind: 'text-red-700 bg-red-100 border-red-200' };
    } else {
      if (val >= 1 && val <= 14400) return { label: 'SUPERFICIAL', color: '#EF4444', tailwind: 'text-rose-600 bg-rose-50 border-rose-100' };
      if (val >= 14401 && val <= 28800) return { label: 'EFICIENTE', color: '#10B981', tailwind: 'text-emerald-600 bg-emerald-50 border-emerald-100' };
      if (val >= 28801 && val <= 43200) return { label: 'MODERADO', color: '#FBBF24', tailwind: 'text-amber-600 bg-amber-50 border-amber-100' };
      if (val >= 43201 && val <= 64800) return { label: 'PROLONGADO', color: '#F97316', tailwind: 'text-orange-600 bg-orange-50 border-orange-100' };
      if (val >= 64801 && val <= 90000) return { label: 'EXCESSIVO', color: '#2563EB', tailwind: 'text-blue-600 bg-blue-50 border-blue-100' };
      if (val >= 90001) return { label: 'CRÍTICO', color: '#DC2626', tailwind: 'text-red-700 bg-red-100 border-red-200' };
    }
    return { label: 'ESTÁVEL', color: '#64748b', tailwind: 'text-slate-600 bg-slate-50 border-slate-100' };
  };

  const statusInfo = getStatusInfo();
  const statusColorClass = statusInfo.tailwind;

  const GaugeNeedle = ({ value, cx, cy, outerRadius, color }: any) => {
    const x0 = cx;
    const y0 = cy;
    
    // Needle points to -90deg at 0% and +90deg at 100%
    // Because the base shape points straight up (0deg)
    const rotation = -90 + (value * 1.8);
    
    return (
      <motion.g 
        initial={{ rotate: -90 }}
        animate={{ rotate: rotation }} 
        transition={{ type: 'spring', stiffness: 50, damping: 20 }}
        style={{ originX: `${x0}px`, originY: `${y0}px`, pointerEvents: 'none' }}
      >
        <circle cx={x0} cy={y0} r={5} fill={color} stroke="#ffffff" strokeWidth="2" />
        <path 
          d={`M ${x0 - 5} ${y0} L ${x0} ${y0 - (outerRadius - 10)} L ${x0 + 5} ${y0} Z`}
          fill={color} 
          stroke={color}
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </motion.g>
    );
  };

  const activeMetricSegments = activeMetric === 'avg' ? [
    { range: 89, color: '#EF4444', label: 'SUPERFICIAL' },
    { range: 211, color: '#10B981', label: 'EFICIENTE' },
    { range: 300, color: '#FBBF24', label: 'MODERADO' },
    { range: 600, color: '#F97316', label: 'PROLONGADO' },
    { range: 600, color: '#A855F7', label: 'EXCESSIVO' },
    { range: 200, color: '#DC2626', label: 'CRÍTICO' }
  ] : [
    { range: 14400, color: '#EF4444', label: 'SUPERFICIAL' },
    { range: 14400, color: '#10B981', label: 'EFICIENTE' },
    { range: 14400, color: '#FBBF24', label: 'MODERADO' },
    { range: 21600, color: '#F97316', label: 'PROLONGADO' },
    { range: 25200, color: '#A855F7', label: 'EXCESSIVO' },
    { range: 10000, color: '#DC2626', label: 'CRÍTICO' }
  ];

  const backgroundPieData = [
    { value: 100, color: '#F1F5F9' }
  ];

  const activePieData = [
    { value: percent, color: statusInfo.color },
    { value: 100 - percent, color: 'transparent' }
  ];

  return (
    <section className="grid grid-cols-1 lg:grid-cols-4 gap-6 shrink-0">
      {/* Totais de atendimentos */}
      <div className="lg:col-span-2 bg-white text-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col relative z-20">
        <div className="flex justify-between items-start mb-8 relative z-30">
          <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide mb-0">Totais de atendimentos</h3>
        </div>
        
        <div className="flex flex-1 items-center gap-12 mb-4">
          <div className="flex flex-col shrink-0">
            <span className="text-5xl font-black tracking-tighter text-slate-900">{totalCalls}</span>
            <span className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-wider">Total de chamadas</span>
          </div>

          <div className="flex-1 space-y-4">
            {/* Abandonadas / Perdidas */}
            <div className="space-y-1 group relative">
              <div className="flex justify-between text-[11px] font-bold text-red-600 uppercase tracking-tight">
                <span>Perdidas &gt; 1m</span>
                <span>{abandonedCalls.length} ({abandonRate}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                <div 
                  className="bg-red-500 h-full transition-all duration-500" 
                  style={{ width: `${longWaitRate}%` }}
                  title={`Perdidas > 1m: ${longWaitPerc}%`}
                />
                <div 
                  className="bg-orange-400 h-full transition-all duration-500" 
                  style={{ width: `${shortWaitRate}%` }}
                  title={`Perdidas < 1m: ${shortWaitPerc}%`}
                />
              </div>
              
              {/* Tooltip on hover */}
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50">
                <div className="bg-slate-900 text-white text-[10px] p-2 rounded shadow-2xl whitespace-nowrap border border-slate-700">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                    <span className="font-medium">Perdidas {'>'} 1m: <span className="text-red-400">{lostLongWait.length}</span> ({longWaitPerc}%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.5)]" />
                    <span className="font-medium">Perdidas {'<'} 1m: <span className="text-orange-300">{lostShortWait.length}</span> ({shortWaitPerc}%)</span>
                  </div>
                  <div className="absolute top-full left-4 w-2 h-2 bg-slate-900 rotate-45 -translate-y-1 border-r border-b border-slate-700" />
                </div>
              </div>
            </div>

            {/* Pendentes */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold text-blue-600 uppercase tracking-tight">
                <span>Pendentes (Chat)</span>
                <span>{pendenteCalls.length} ({pendenteRate}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-500 h-full transition-all duration-500" 
                  style={{ width: `${pendenteRate}%` }}
                />
              </div>
            </div>

            {/* Atendidas */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold text-slate-600 uppercase tracking-tight">
                <span>Atendidas</span>
                <span>{answeredCalls.length} ({answeredRate}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-500" 
                  style={{ width: `${answeredRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 right-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Total parcial do dia
        </div>
      </div>

      {/* Unified Talk Time Metrics Card */}
      <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-full relative z-10">
        <div className="flex justify-between items-start mb-2 relative z-20">
          <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">Desempenho de atendimento</h3>
          
          <div className="relative" ref={localAgentRef}>
            <button 
              onClick={() => setIsLocalAgentOpen(!isLocalAgentOpen)}
              className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-600 hover:border-indigo-300 transition-colors"
            >
              <Users className="h-3 w-3" />
              <span className="truncate max-w-[80px]">{localAgent}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            
            {isLocalAgentOpen && (
              <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-slate-200 shadow-xl rounded-lg z-50 py-1 max-h-48 overflow-y-auto">
                <button 
                  onClick={() => { setLocalAgent('Todos'); setIsLocalAgentOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-[10px] uppercase font-bold hover:bg-slate-50 border-b border-slate-50 ${localAgent === 'Todos' ? 'text-indigo-600' : 'text-slate-600'}`}
                >
                  Todos Operadores
                </button>
                {metricAgents.map(ag => (
                  <button 
                    key={ag}
                    onClick={() => { setLocalAgent(ag); setIsLocalAgentOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-[10px] font-medium hover:bg-slate-50 ${localAgent === ag ? 'text-indigo-600' : 'text-slate-600'}`}
                  >
                    {ag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-between gap-4 mt-6">
          <div className="w-56 h-40 shrink-0 relative flex flex-col items-center" style={{ bottom: '17px' }}>
            {/* Value Display ONLY above gauge */}
            <div className="mb-2 text-center relative z-10">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                 {activeMetric === 'avg' ? 'Tempo Médio' : 'Conversa Total'}
               </span>
               <span className={`text-xl font-black px-3 py-1 rounded-lg border shadow-sm inline-block transition-colors duration-500 ${statusColorClass}`}>
                  {formatSeconds(currentVal)}
               </span>
            </div>

            <div className="w-full h-28 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart style={{ bottom: '20px' }}>
                  {/* Background Track */}
                  <Pie
                    data={backgroundPieData}
                    cx={112}
                    cy={105}
                    startAngle={180}
                    endAngle={0}
                    innerRadius={65}
                    outerRadius={85}
                    dataKey="value"
                    stroke="none"
                    isAnimationActive={false}
                  >
                    <Cell fill="#F1F5F9" />
                  </Pie>
                  {/* Active Value Fill */}
                  <Pie
                    data={activePieData}
                    cx={112}
                    cy={105}
                    startAngle={180}
                    endAngle={0}
                    innerRadius={65}
                    outerRadius={85}
                    dataKey="value"
                    stroke="none"
                    isAnimationActive={true}
                    animationDuration={800}
                  >
                    {activePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  
                  {/* Custom Needle */}
                  <GaugeNeedle 
                    value={percent} 
                    cx={112} 
                    cy={105} 
                    outerRadius={85} 
                    color="#0f172a" 
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend for gauge - Dynamic SLA indicator */}
              <div className="absolute -bottom-5 w-full flex justify-between items-center text-[8px] font-black uppercase tracking-tighter text-slate-400" style={{ left: '26px', paddingRight: '48px', paddingLeft: '5px' }}>
                 <span style={{ paddingTop: '3px', paddingLeft: '3px', marginBottom: '25px', marginLeft: '3px' }}>{activeMetric === 'avg' ? '0m' : '0h'}</span>
                 <span className="text-[13px] -translate-y-5 font-black tracking-tight text-center truncate px-1" style={{ color: statusInfo.color, maxWidth: '100px', marginBottom: '12px', marginLeft: '7px' }}>
                   {statusInfo.label}
                 </span>
                 <span style={{ paddingTop: '3px', paddingLeft: '0px', marginBottom: '25px', marginRight: '3px' }}>{activeMetric === 'avg' ? '30m+' : '25h+'}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 flex-1 h-full justify-center px-2">
            <button 
              onClick={() => setActiveMetric('avg')}
              className={`p-4 rounded-xl border transition-all text-left flex items-center justify-between gap-4 group ${activeMetric === 'avg' ? 'bg-blue-600 border-blue-600 shadow-md ring-4 ring-blue-50' : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-blue-300 shadow-sm'}`}
            >
               <div className="flex flex-col gap-1">
                 <p className={`text-[11px] font-bold uppercase tracking-wider leading-tight ${activeMetric === 'avg' ? 'text-white' : 'text-slate-600 group-hover:text-blue-700'}`}>
                   Tempo Médio de Atendimento
                 </p>
                 <span className={`text-[9px] font-semibold opacity-80 ${activeMetric === 'avg' ? 'text-blue-100' : 'text-slate-400'}`}>Visualizar SLA</span>
               </div>
               <div className={`w-4 h-4 rounded-full shrink-0 border-2 transition-all ${activeMetric === 'avg' ? 'border-white bg-white/20 shadow-[0_0_10px_rgba(255,255,255,0.4)]' : 'border-slate-300 bg-transparent group-hover:border-blue-400'}`} />
            </button>

            <button 
              onClick={() => setActiveMetric('total')}
              className={`p-4 rounded-xl border transition-all text-left flex items-center justify-between gap-4 group ${activeMetric === 'total' ? 'bg-blue-600 border-blue-600 shadow-md ring-4 ring-blue-50' : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-blue-300 shadow-sm'}`}
            >
               <div className="flex flex-col gap-1">
                 <p className={`text-[11px] font-bold uppercase tracking-wider leading-tight ${activeMetric === 'total' ? 'text-white' : 'text-slate-600 group-hover:text-blue-700'}`}>
                   Tempo de Conversa Total
                 </p>
                 <span className={`text-[9px] font-semibold opacity-80 ${activeMetric === 'total' ? 'text-blue-100' : 'text-slate-400'}`}>Carga horária</span>
               </div>
               <div className={`w-4 h-4 rounded-full shrink-0 border-2 transition-all ${activeMetric === 'total' ? 'border-white bg-white/20 shadow-[0_0_10px_rgba(255,255,255,0.4)]' : 'border-slate-300 bg-transparent group-hover:border-blue-400'}`} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricCard({ title, value, subtext, isWarning }: any) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
      <p className="text-xs text-slate-500 font-medium uppercase mb-1">{title}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {subtext && (
        <p className={`text-[10px] mt-1 ${isWarning ? 'text-amber-600' : 'text-slate-400'}`}>
          {subtext}
        </p>
      )}
    </div>
  );
}

function ChartCallsOverTime({ 
  data, 
  dateRange, 
  setDateRange, 
  initialDateRange 
}: { 
  data: CallData[], 
  dateRange?: DateRange, 
  setDateRange: (range: DateRange | undefined) => void,
  initialDateRange?: DateRange
}) {
  const [hiddenKeys, setHiddenKeys] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleLegendClick = (o: any) => {
    const { dataKey } = o;
    setHiddenKeys(prev => 
      prev.includes(dataKey) ? prev.filter(k => k !== dataKey) : [...prev, dataKey]
    );
  };

  const getBarColor = (originalColor: string) => {
    return originalColor;
  };

  const filteredData = useMemo(() => {
    if (!dateRange?.from) return data;
    const dStart = startOfDay(dateRange.from);
    const dEnd = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
    return data.filter(d => d.startTime >= dStart && d.startTime <= dEnd);
  }, [data, dateRange]);

  const chartData = useMemo(() => {
    // Group by day and hour
    const counts = filteredData.reduce((acc, call) => {
      if (!call.startTime || isNaN(call.startTime.getTime())) return acc;
      const key = format(call.startTime, 'dd/MM HH:00');
      
      if (!acc[key]) {
        acc[key] = { time: key, atendidas: 0, perdidas: 0, perdidas_baixo_1m: 0, pendente: 0 };
      }
      
      const reason = call.leftQueueReason?.toLowerCase() || '';
      if (reason === 'abandon') {
        if ((call.waitTime || 0) <= 60) {
          acc[key].perdidas_baixo_1m += 1;
        } else {
          acc[key].perdidas += 1;
        }
      } else if (reason === 'pendente') {
        acc[key].pendente += 1;
      } else if (reason === 'answered') {
        acc[key].atendidas += 1;
      }
      
      return acc;
    }, {} as Record<string, { time: string, atendidas: number, perdidas: number, perdidas_baixo_1m: number, pendente: number }>);

    return Object.values(counts)
      .map(item => ({
        ...item,
        atendidas: hiddenKeys.includes('atendidas') ? 0 : item.atendidas,
        pendente: hiddenKeys.includes('pendente') ? 0 : item.pendente,
        perdidas_baixo_1m: hiddenKeys.includes('perdidas_baixo_1m') ? 0 : item.perdidas_baixo_1m,
        perdidas: hiddenKeys.includes('perdidas') ? 0 : item.perdidas,
      }))
      .sort((a, b) => {
        const [dayA, monthA, hourA] = a.time.split(/[/ ]|:/).map(Number);
        const [dayB, monthB, hourB] = b.time.split(/[/ ]|:/).map(Number);
        if (monthA !== monthB) return monthA - monthB;
        if (dayA !== dayB) return dayA - dayB;
        return hourA - hourB;
      });
  }, [filteredData, hiddenKeys]);

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 p-4 h-80 flex flex-col relative shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Volume de Chamadas por Data/Hora</h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
              title="Expandir visualização"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis 
              dataKey="time" 
              axisLine={false} 
              tickLine={false} 
              tick={false} 
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
            <Tooltip
              cursor={{ fill: '#F1F5F9' }}
              contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '11px', paddingTop: '10px', cursor: 'pointer' }}
              onClick={handleLegendClick}
              formatter={(value) => (
                <span className={hiddenKeys.includes(value === 'Atendidas' ? 'atendidas' : value === 'Pendente' ? 'pendente' : value === 'Perdidas < 1m' ? 'perdidas_baixo_1m' : 'perdidas') ? 'text-slate-300 line-through' : ''}>
                  {value}
                </span>
              )}
            />
            <Bar dataKey="atendidas" stackId="a" fill={getBarColor("#10B981")} radius={[0, 0, 0, 0]} name="Atendidas" isAnimationActive={true} animationDuration={500} />
            <Bar dataKey="pendente" stackId="a" fill={getBarColor("#3B82F6")} radius={[0, 0, 0, 0]} name="Pendente" isAnimationActive={true} animationDuration={500} />
            <Bar dataKey="perdidas_baixo_1m" stackId="a" fill={getBarColor("#FB923C")} radius={[0, 0, 0, 0]} name="Perdidas < 1m" isAnimationActive={true} animationDuration={500} />
            <Bar dataKey="perdidas" stackId="a" fill={getBarColor("#EF4444")} radius={[4, 4, 0, 0]} name="Perdidas > 1m" isAnimationActive={true} animationDuration={500} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
    
    <AnimatePresence>
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0 }}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden w-full max-w-[90vw] h-[90vh]"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900">Volume de Chamadas por Data/Hora (Ampliado)</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 p-6 relative overflow-hidden bg-slate-50/30">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="time" 
                    axisLine={false} 
                    tickLine={false} 
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    tick={{ fontSize: 11, fill: '#64748B' }} 
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                  <Tooltip
                    cursor={{ fill: '#F1F5F9' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '13px', paddingTop: '20px', cursor: 'pointer' }}
                    onClick={handleLegendClick}
                    formatter={(value) => (
                      <span className={hiddenKeys.includes(value === 'Atendidas' ? 'atendidas' : value === 'Pendente' ? 'pendente' : value === 'Perdidas < 1m' ? 'perdidas_baixo_1m' : 'perdidas') ? 'text-slate-300 line-through' : ''}>
                        {value}
                      </span>
                    )}
                  />
                  <Bar dataKey="atendidas" stackId="a" fill={getBarColor("#10B981")} radius={[0, 0, 0, 0]} name="Atendidas" isAnimationActive={true} animationDuration={500} />
                  <Bar dataKey="pendente" stackId="a" fill={getBarColor("#3B82F6")} radius={[0, 0, 0, 0]} name="Pendente" isAnimationActive={true} animationDuration={500} />
                  <Bar dataKey="perdidas_baixo_1m" stackId="a" fill={getBarColor("#FB923C")} radius={[0, 0, 0, 0]} name="Perdidas < 1m" isAnimationActive={true} animationDuration={500} />
                  <Bar dataKey="perdidas" stackId="a" fill={getBarColor("#EF4444")} radius={[4, 4, 0, 0]} name="Perdidas > 1m" isAnimationActive={true} animationDuration={500} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}

function ChartAgentPerformance({ 
  data, 
  dateRange, 
  setDateRange, 
  initialDateRange 
}: { 
  data: CallData[], 
  dateRange?: DateRange, 
  setDateRange: (range: DateRange | undefined) => void,
  initialDateRange?: DateRange
}) {
  const [hiddenKeys, setHiddenKeys] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState('');

  const filteredData = useMemo(() => {
    if (!dateRange?.from) return data;
    const dStart = startOfDay(dateRange.from);
    const dEnd = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
    return data.filter(d => d.startTime >= dStart && d.startTime <= dEnd);
  }, [data, dateRange]);

  const { chartData, techniciansCount, allAgentsData } = useMemo(() => {
    const agents = filteredData.reduce((acc, call) => {
      const name = call.agentName || 'Não Atribuído';
      if (name === 'Não Atribuído' || name.trim() === '') return acc;
      
      const shortName = name.split(' - ')[0]; // Simplify
      if (!acc[shortName]) acc[shortName] = { name: shortName, chamadas: 0, abandonos: 0, perdidas_baixo_1m: 0, pendente: 0 };
      
      const reason = call.leftQueueReason?.toLowerCase() || '';
      if (reason === 'answered') {
        acc[shortName].chamadas += 1;
      } else if (reason === 'abandon') {
        if ((call.waitTime || 0) < 60) {
          acc[shortName].perdidas_baixo_1m += 1;
        } else {
          acc[shortName].abandonos += 1;
        }
      } else if (reason === 'pendente') {
        acc[shortName].pendente += 1;
      }
      return acc;
    }, {} as Record<string, any>);
    
    const sortedAgents = Object.values(agents)
      .map((item: any) => ({
        ...item,
        chamadas: hiddenKeys.includes('chamadas') ? 0 : item.chamadas,
        pendente: hiddenKeys.includes('pendente') ? 0 : item.pendente,
        perdidas_baixo_1m: hiddenKeys.includes('perdidas_baixo_1m') ? 0 : item.perdidas_baixo_1m,
        abandonos: hiddenKeys.includes('abandonos') ? 0 : item.abandonos,
      }))
      .sort((a: any, b: any) => {
        // Sort by total visible value if everything is hidden or specific key
        const totalA = a.chamadas + a.pendente + a.perdidas_baixo_1m + a.abandonos;
        const totalB = b.chamadas + b.pendente + b.perdidas_baixo_1m + b.abandonos;
        return totalB - totalA;
      });

    const techCount = Object.keys(agents).filter(name => name !== 'Ligações Perdidas').length;

    return { 
      chartData: sortedAgents.slice(0, 10),
      allAgentsData: sortedAgents,
      techniciansCount: techCount
    };
  }, [filteredData, hiddenKeys]);

  const filteredModalData = useMemo(() => {
    if (!modalSearch.trim()) return allAgentsData;
    return allAgentsData.filter((a: any) => 
      a.name.toLowerCase().includes(modalSearch.toLowerCase())
    );
  }, [allAgentsData, modalSearch]);

  const activeIdealPoint = useMemo(() => {
    const totalActiveCalls = filteredData.filter(call => {
      const reason = call.leftQueueReason?.toLowerCase() || '';
      const isShortWait = (call.waitTime || 0) < 60;
      
      if (reason === 'answered' && !hiddenKeys.includes('chamadas')) return true;
      if (reason === 'pendente' && !hiddenKeys.includes('pendente')) return true;
      if (reason === 'abandon') {
        if (isShortWait && !hiddenKeys.includes('perdidas_baixo_1m')) return true;
        if (!isShortWait && !hiddenKeys.includes('abandonos')) return true;
      }
      return false;
    }).length;
    
    return techniciansCount > 0 ? Math.round(totalActiveCalls / techniciansCount) : 0;
  }, [filteredData, hiddenKeys, techniciansCount]);

  const handleLegendClick = (o: any) => {
    const { dataKey } = o;
    setHiddenKeys(prev => 
      prev.includes(dataKey) ? prev.filter(k => k !== dataKey) : [...prev, dataKey]
    );
  };

  const getBarColor = (originalColor: string) => {
    return originalColor;
  };

  return (
    <>
    <div className="bg-white rounded-xl border border-slate-200 p-4 h-80 flex flex-col relative shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900">Produtividade dos operadores</h3>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
            title="Expandir visualização"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 25, right: 60, left: 20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
            <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
            <Tooltip
              cursor={{ fill: '#F1F5F9' }}
              contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              formatter={(value: any, name: any, props: any) => {
                const totalActive = 
                  (!hiddenKeys.includes('chamadas') ? props.payload.chamadas : 0) + 
                  (!hiddenKeys.includes('abandonos') ? props.payload.abandonos : 0) + 
                  (!hiddenKeys.includes('pendente') ? props.payload.pendente : 0);
                
                const perc = activeIdealPoint > 0 ? ((totalActive / activeIdealPoint) * 100).toFixed(1) : 0;
                return [`${value}`, name, `Ativo: ${totalActive} (${perc}%)`];
              }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '11px', paddingTop: '10px', cursor: 'pointer' }} 
              onClick={handleLegendClick}
              formatter={(value) => (
                <span className={hiddenKeys.includes(value === 'Atendidas' ? 'chamadas' : value === 'Pendente' ? 'pendente' : value === 'Perdidas < 1m' ? 'perdidas_baixo_1m' : 'abandonos') ? 'text-slate-300 line-through' : ''}>
                  {value}
                </span>
              )}
            />

            <Bar dataKey="chamadas" stackId="a" fill={getBarColor("#10B981")} radius={[0, 0, 0, 0]} name="Atendidas" isAnimationActive={true} animationDuration={500}>
               {chartData.map((entry: any, index: number) => {
                 return (
                   <LabelList 
                     key={`label-${index}`}
                     dataKey="chamadas" 
                     content={(props: any) => {
                        const { x, y, width, height, index: i } = props;
                        if (i !== index) return null;
                        const item = chartData[i];
                        if (item.name === 'Ligações Perdidas') return null;
                        
                        // Recalculate total considering only active keys
                        const totalActiveItem = 
                          (item.chamadas || 0) + 
                          (item.pendente || 0) + 
                          (item.perdidas_baixo_1m || 0) + 
                          (item.abandonos || 0);

                        const percentage = activeIdealPoint > 0 ? Math.round((totalActiveItem / activeIdealPoint) * 100) : 0;
                        
                        const isSomethingActive = !hiddenKeys.includes('chamadas') || !hiddenKeys.includes('abandonos') || !hiddenKeys.includes('pendente') || !hiddenKeys.includes('perdidas_baixo_1m');
                        if (!isSomethingActive) return null;

                        return (
                          <text 
                            x={(x || 0) + (width || 0) + 35} 
                            y={(y || 0) + (height || 0) / 2 + 4} 
                            fill={hiddenKeys.length > 0 ? "#94A3B8" : "#64748B"} 
                            fontSize={10} 
                            fontWeight="bold" 
                            textAnchor="middle"
                          >
                            {percentage}%
                          </text>
                        );
                     }}
                   />
                 );
               })}
            </Bar>
            <Bar dataKey="pendente" stackId="a" fill={getBarColor("#3B82F6")} radius={[0, 0, 0, 0]} name="Pendente" isAnimationActive={true} animationDuration={500} />
            <Bar dataKey="perdidas_baixo_1m" stackId="a" fill={getBarColor("#FB923C")} radius={[0, 0, 0, 0]} name="Perdidas < 1m" isAnimationActive={true} animationDuration={500} />
            <Bar dataKey="abandonos" stackId="a" fill={getBarColor("#EF4444")} radius={[0, 4, 4, 0]} name="Perdidas > 1m" isAnimationActive={true} animationDuration={500} />
            
            {activeIdealPoint > 0 && (
              <ReferenceLine 
                x={activeIdealPoint} 
                stroke="#2563EB" 
                strokeDasharray="5 5" 
                label={({ viewBox }: any) => (
                  <text
                    x={viewBox.x}
                    y={viewBox.y - 5}
                    fill="#2563EB"
                    fontSize={10}
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    Ideal: {activeIdealPoint}
                  </text>
                )} 
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

    {/* Modal for Expanded Agent Performance */}
    <AnimatePresence>
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 text-slate-900">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsModalOpen(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 rounded-xl shadow-md shadow-indigo-100">
                  <BarChart2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Produtividade Operacional</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">Ranking completo de operadores e desempenho</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Stats Summary */}
                <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-5 gap-4 mb-4">
                   <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Operadores</span>
                      <span className="text-2xl font-black text-slate-900">{techniciansCount}</span>
                   </div>
                   <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                      <span className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest block mb-1">Atendidas</span>
                      <span className="text-2xl font-black text-emerald-700">
                        {allAgentsData.reduce((acc: number, a: any) => acc + a.chamadas, 0)}
                      </span>
                   </div>
                   <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <span className="text-[10px] font-black text-blue-600/60 uppercase tracking-widest block mb-1">Pendentes</span>
                      <span className="text-2xl font-black text-blue-700">
                        {allAgentsData.reduce((acc: number, a: any) => acc + a.pendente, 0)}
                      </span>
                   </div>
                   <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                      <span className="text-[10px] font-black text-orange-600/60 uppercase tracking-widest block mb-1">Perdidas &lt; 1m</span>
                      <span className="text-2xl font-black text-orange-700">
                        {allAgentsData.reduce((acc: number, a: any) => acc + a.perdidas_baixo_1m, 0)}
                      </span>
                   </div>
                   <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                      <span className="text-[10px] font-black text-red-600/60 uppercase tracking-widest block mb-1">Perdidas &gt; 1m</span>
                      <span className="text-2xl font-black text-red-700">
                        {allAgentsData.reduce((acc: number, a: any) => acc + a.abandonos, 0)}
                      </span>
                   </div>
                </div>

                {/* Left: Full Chart */}
                <div className="lg:col-span-2 bg-slate-50/50 rounded-2xl border border-slate-100 p-6 flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex flex-col">
                      <h4 className="text-sm font-black text-slate-700 uppercase tracking-tight">Gráfico Comparativo</h4>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Filtros aplicados em tempo real</span>
                    </div>
                    
                    {/* Operator search */}
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-3 w-3 text-slate-400" />
                      </div>
                      <input 
                        type="text"
                        placeholder="BUSCAR OPERADOR..."
                        value={modalSearch}
                        onChange={(e) => setModalSearch(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-48 transition-all"
                      />
                    </div>
                  </div>
                  <div className="h-[600px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={filteredModalData} layout="vertical" margin={{ top: 25, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                        <YAxis dataKey="name" type="category" width={120} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                        <Tooltip
                          cursor={{ fill: '#F1F5F9' }}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          formatter={(value: any, name: any, props: any) => {
                            const totalActive = 
                              (props.payload.chamadas || 0) + 
                              (props.payload.pendente || 0) + 
                              (props.payload.perdidas_baixo_1m || 0) + 
                              (props.payload.abandonos || 0);
                            
                            const perc = activeIdealPoint > 0 ? ((totalActive / activeIdealPoint) * 100).toFixed(1) : 0;
                            return [`${value}`, name, `Ativo: ${totalActive} (${perc}%)`];
                          }}
                        />
                        <Legend 
                          wrapperStyle={{ fontSize: '11px', paddingTop: '10px', cursor: 'pointer' }}
                          onClick={handleLegendClick}
                          formatter={(value) => (
                             <span className={hiddenKeys.includes(value === 'Atendidas' ? 'chamadas' : value === 'Pendente' ? 'pendente' : value === 'Perdidas < 1m' ? 'perdidas_baixo_1m' : 'abandonos') ? 'text-slate-300 line-through' : ''}>
                               {value}
                             </span>
                          )}
                        />

                        <Bar dataKey="chamadas" stackId="a" fill={getBarColor("#10B981")} name="Atendidas" isAnimationActive={true} animationDuration={500} />
                        <Bar dataKey="pendente" stackId="a" fill={getBarColor("#3B82F6")} name="Pendente" isAnimationActive={true} animationDuration={500} />
                        <Bar dataKey="perdidas_baixo_1m" stackId="a" fill={getBarColor("#FB923C")} name="Perdidas < 1m" isAnimationActive={true} animationDuration={500} />
                        <Bar dataKey="abandonos" stackId="a" fill={getBarColor("#EF4444")} name="Perdidas > 1m" isAnimationActive={true} animationDuration={500} />
                        
                        {activeIdealPoint > 0 && (
                          <ReferenceLine 
                            x={activeIdealPoint} 
                            stroke="#2563EB" 
                            strokeDasharray="5 5" 
                            label={({ viewBox }: any) => (
                              <text
                                x={viewBox.x}
                                y={viewBox.y - 10}
                                fill="#2563EB"
                                fontSize={10}
                                fontWeight="black"
                                textAnchor="middle"
                              >
                                IDEAL: {activeIdealPoint}
                              </text>
                            )} 
                          />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Right: Table View */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
                   <div className="p-4 bg-slate-50 border-b border-slate-200">
                      <h4 className="text-sm font-black text-slate-700 uppercase tracking-tight">Listagem Detalhada</h4>
                   </div>
                   <div className="flex-1 overflow-y-auto">
                     <table className="w-full text-left border-collapse">
                       <thead className="sticky top-0 bg-white shadow-sm z-10">
                         <tr className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                           <th className="p-4">Operador</th>
                           <th className="p-4 text-center">Atend.</th>
                           <th className="p-4 text-center">Pend.</th>
                           <th className="p-4 text-center">Perd. {'>'} 1m</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50 text-[11px]">
                         {allAgentsData.map((agent: any, idx: number) => (
                           <tr key={idx} className="hover:bg-slate-50 transition-colors">
                             <td className="p-4 font-bold text-slate-700">{agent.name}</td>
                             <td className="p-4 text-center">
                               <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md font-bold">{agent.chamadas}</span>
                             </td>
                             <td className="p-4 text-center">
                               <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-bold">{agent.pendente}</span>
                             </td>
                             <td className="p-4 text-center">
                               <span className="bg-red-50 text-red-700 px-2 py-1 rounded-md font-bold">{agent.abandonos}</span>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}

function RecurringNumbersCard({ data, onFilter, activeFilter }: { data: CallData[], onFilter: (num: string) => void, activeFilter: string }) {
  const recurring = useMemo(() => {
    const counts = data.reduce((acc, call) => {
      const num = call.callerNumber;
      if (num && num !== 'Unknown' && num !== 'Anonymous') {
        acc[num] = (acc[num] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts)
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [data]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col items-start h-full">
      <h3 className="text-sm font-semibold mb-3 text-slate-900">Padrões de Recorrência</h3>
      {recurring.length === 0 ? (
        <p className="text-slate-400 text-[11px]">Nenhuma recorrência encontrada.</p>
      ) : (
        <ul className="w-full space-y-2">
          {recurring.map(([num, count]) => {
            const isActive = activeFilter === num;
            return (
              <li 
                key={num} 
                className={`flex justify-between items-center p-2 rounded border transition-all cursor-pointer ${isActive ? 'bg-indigo-100 border-indigo-300 ring-2 ring-indigo-50' : 'bg-amber-50 border-amber-100 hover:bg-amber-100'}`}
                onClick={() => onFilter(num)}
                title={isActive ? "Clique para remover filtro" : "Clique para filtrar as chamadas deste número"}
              >
                <span className={`font-mono font-bold text-xs ${isActive ? 'text-indigo-900' : 'text-amber-900'}`}>{formatPhone(num)}</span>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${isActive ? 'bg-indigo-200 text-indigo-900' : 'bg-amber-200 text-amber-900'}`}>{count} vezes</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AgentDetailedProductivityCard({ data }: { data: CallData[] }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedTeams, setSelectedTeams] = useState<string[]>(['Cart. A+B']);
  const [selectedSchedules, setSelectedSchedules] = useState<string[]>([]);
  const [isDatePopupOpen, setIsDatePopupOpen] = useState(false);
  const [isTeamDropdownOpen, setIsTeamDropdownOpen] = useState(false);
  const [isScheduleDropdownOpen, setIsScheduleDropdownOpen] = useState(false);
  const datePopupRef = useRef<HTMLDivElement>(null);
  const teamDropdownRef = useRef<HTMLDivElement>(null);
  const scheduleDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (data.length > 0) {
      const dates = data.map(d => d.startTime.getTime());
      const mostRecent = new Date(Math.max(...dates));
      setSelectedMonth(mostRecent.getMonth());
      setSelectedYear(mostRecent.getFullYear());
    }
  }, [data]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePopupRef.current && !datePopupRef.current.contains(event.target as Node)) {
        setIsDatePopupOpen(false);
      }
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(event.target as Node)) {
        setIsTeamDropdownOpen(false);
      }
      if (scheduleDropdownRef.current && !scheduleDropdownRef.current.contains(event.target as Node)) {
        setIsScheduleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const teamsSet = useMemo(() => {
    const teams = new Set<string>();
    data.forEach(d => {
      if (d._team && d._team !== 'Sem Origem') teams.add(d._team);
    });
    return Array.from(teams).sort();
  }, [data]);

  const calendarData = useMemo(() => {
     const start = startOfMonth(new Date(selectedYear, selectedMonth));
     const end = endOfMonth(start);
     const daysInMonth = eachDayOfInterval({ start, end });
     
     const activeAgentsSet = new Set<string>();

     const isCoordenacaoAgent = (agentStr: string) => {
       const a = agentStr.toLowerCase();
       return a.includes('johnny morais') || a.includes('brener');
     };

     const isCDEAgent = (agentStr: string) => {
       return TEAM_MAPPING['Cart. C+D+E']?.some(a => agentStr.toLowerCase().includes(a.toLowerCase()));
     };
     
     const isCartAQueue = (q: string) => {
       const ql = q.toLowerCase();
       return ql === 'fila carteira a' || ql.includes('carteira b');
     };

     const checkIncludesTeam = (d: CallData) => {
       const qLower = d.queue.toLowerCase();
       const isCartA = isCartAQueue(qLower);
       
       let isAuxCDECall = false;
       if (d.agentName && isCDEAgent(d.agentName) && isCartA) {
          isAuxCDECall = true;
       }

       let matchTeam = selectedTeams.length === 0 || (d._team && selectedTeams.includes(d._team));
       if (isAuxCDECall && (selectedTeams.length === 0 || selectedTeams.includes('Cart. A+B'))) {
          matchTeam = true;
       }
       return { matchTeam, isAuxCDECall };
     };

     data.forEach(d => {
       const dMonth = d.startTime.getMonth();
       const dYear = d.startTime.getFullYear();

       const matchSchedule = selectedSchedules.length === 0 || selectedSchedules.includes(d._schedule || '');

       if (dMonth === selectedMonth && dYear === selectedYear && matchSchedule) {
         const { matchTeam, isAuxCDECall } = checkIncludesTeam(d);

         if (matchTeam) {
           let name = formatAgentName(d.agentName);
           if (name && name !== 'Ligações Perdidas' && name.toUpperCase() !== 'AGENTE QA OFFLINE') {
             if (isCoordenacaoAgent(name)) {
               name = 'Coordenação';
             } else if (isAuxCDECall && (selectedTeams.length === 0 || selectedTeams.includes('Cart. A+B'))) {
               name = 'Auxílio CDE';
             }
             activeAgentsSet.add(name);
           }
         }
       }
     });

     const rawAgents = Array.from(activeAgentsSet).sort();
     const agents = rawAgents.filter(a => a !== 'Coordenação' && a !== 'Auxílio CDE');
     if (activeAgentsSet.has('Coordenação')) agents.push('Coordenação');
     if (activeAgentsSet.has('Auxílio CDE')) agents.push('Auxílio CDE');

     const grid: Record<string, Record<string, number>> = {};
     agents.forEach(a => grid[a] = {});
     
     const dailyTotals: Record<string, { count: number, agentsWorked: number, chat: number, calls: number, total: number, lost: number }> = {};
     
     daysInMonth.forEach(d => {
       const key = format(d, 'yyyy-MM-dd');
       dailyTotals[key] = { count: 0, agentsWorked: 0, chat: 0, calls: 0, total: 0, lost: 0 };
     });

     data.forEach(d => {
       const dMonth = d.startTime.getMonth();
       const dYear = d.startTime.getFullYear();
       
       const matchSchedule = selectedSchedules.length === 0 || selectedSchedules.includes(d._schedule || '');

       if (dMonth === selectedMonth && dYear === selectedYear && matchSchedule) {
         const { matchTeam, isAuxCDECall } = checkIncludesTeam(d);

         if (matchTeam) {
           const key = format(d.startTime, 'yyyy-MM-dd');
           let name = formatAgentName(d.agentName);
           
           if (name && name !== 'Ligações Perdidas' && name.toUpperCase() !== 'AGENTE QA OFFLINE') {
             if (isCoordenacaoAgent(name)) {
               name = 'Coordenação';
             } else if (isAuxCDECall && (selectedTeams.length === 0 || selectedTeams.includes('Cart. A+B'))) {
               name = 'Auxílio CDE';
             }
           }
           
            const isAbandoned = (d.leftQueueReason?.toLowerCase() === 'abandon' || d.status?.toLowerCase() === 'canceled') && (d.waitTime >= 60); 

            if (isAbandoned || (name === 'Ligações Perdidas' && d.waitTime >= 60)) {
              if (dailyTotals[key]) dailyTotals[key].lost += 1;
            } else {
             if (dailyTotals[key]) {
               if (d.origin === 'Chat') dailyTotals[key].chat += 1;
               else dailyTotals[key].calls += 1;
               dailyTotals[key].total += 1;

               if (agents.includes(name)) {
                 grid[name][key] = (grid[name][key] || 0) + 1;
                 dailyTotals[key].count += 1;
               }
             }
           }
         }
       }
     });

     daysInMonth.forEach(d => {
       const key = format(d, 'yyyy-MM-dd');
       let aw = 0;
       agents.forEach(a => {
         if (grid[a][key] > 0) aw++;
       });
       dailyTotals[key].agentsWorked = aw;
     });

     return { daysInMonth, agents, grid, dailyTotals };
  }, [data, selectedMonth, selectedYear, selectedTeams, selectedSchedules]);

  const getTotalColor = (count: number) => {
    if (!count) return 'bg-slate-50 text-slate-400';
    if (count <= 180) return 'bg-rose-400 text-white font-bold';
    if (count <= 220) return 'bg-orange-400 text-white font-bold';
    if (count <= 240) return 'bg-amber-300 text-amber-900 font-bold';
    return 'bg-emerald-400 text-white font-bold';
  };

  const getColor = (count: number) => {
    if (!count) return 'bg-slate-50 border-slate-100 text-slate-400';
    if (count <= 5) return 'bg-red-50 border-red-100 text-red-700 bg-rose-100';
    if (count <= 15) return 'bg-amber-100 border-amber-200 text-amber-800';
    if (count < 30) return 'bg-emerald-200 border-emerald-300 text-emerald-900';
    return 'bg-emerald-400 border-emerald-500 text-white font-bold';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col w-full h-full">
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <h3 className="text-sm font-black text-slate-900 tracking-tight">Produtividade Detalhada por Técnico</h3>
        <div className="flex items-center gap-2">
          <div className="relative" ref={scheduleDropdownRef}>
            <button 
              onClick={() => setIsScheduleDropdownOpen(!isScheduleDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:border-indigo-300 transition-all shadow-sm"
            >
              <Clock className="h-3 w-3" />
              {selectedSchedules.length === 0 ? "Todos Horários" : selectedSchedules.length === 1 ? selectedSchedules[0] : `${selectedSchedules.length} Horários`}
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>
            <AnimatePresence>
              {isScheduleDropdownOpen && (
                <TableFilterDropdown 
                  options={SERVICE_SCHEDULES.filter(s => s !== 'Todos')}
                  selectedValues={selectedSchedules}
                  onToggle={(sch) => {
                    if (selectedSchedules.includes(sch)) {
                      setSelectedSchedules(selectedSchedules.filter(s => s !== sch));
                    } else {
                      setSelectedSchedules([...selectedSchedules, sch]);
                    }
                  }}
                  onClose={() => setIsScheduleDropdownOpen(false)}
                />
              )}
            </AnimatePresence>
          </div>

          <div className="relative" ref={teamDropdownRef}>
            <button 
              onClick={() => setIsTeamDropdownOpen(!isTeamDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:border-indigo-300 transition-all shadow-sm"
            >
              <Users className="h-3 w-3" />
              {selectedTeams.length === 0 ? "Todas Equipes" : selectedTeams.length === 1 ? selectedTeams[0] : `${selectedTeams.length} Equipes`}
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>
            <AnimatePresence>
              {isTeamDropdownOpen && (
                <TableFilterDropdown 
                  options={teamsSet}
                  selectedValues={selectedTeams}
                  onToggle={(team) => {
                    if (selectedTeams.includes(team)) {
                      setSelectedTeams(selectedTeams.filter(t => t !== team));
                    } else {
                      setSelectedTeams([...selectedTeams, team]);
                    }
                  }}
                  onClose={() => setIsTeamDropdownOpen(false)}
                />
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200 relative">
            <button onClick={handlePrevMonth} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-sm rounded-md transition-all shrink-0">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setIsDatePopupOpen(!isDatePopupOpen)} className="px-3 py-1 text-[10px] font-black text-slate-700 uppercase tracking-tighter hover:bg-white hover:shadow-sm rounded-md transition-all whitespace-nowrap min-w-[100px] text-center">
              {monthNames[selectedMonth]} {selectedYear}
            </button>
            <button onClick={handleNextMonth} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-sm rounded-md transition-all shrink-0">
              <ChevronRight className="h-4 w-4" />
            </button>
            <AnimatePresence>
              {isDatePopupOpen && (
                <motion.div ref={datePopupRef} initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute top-full right-0 mt-2 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-4 w-[240px]">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-50">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mês</span>
                    <div className="flex items-center gap-2">
                       <button onClick={() => setSelectedYear(selectedYear - 1)} className="p-1 hover:bg-slate-100 rounded transition-colors"><ChevronLeft className="h-3 w-3" /></button>
                       <span className="text-xs font-black text-slate-900">{selectedYear}</span>
                       <button onClick={() => setSelectedYear(selectedYear + 1)} className="p-1 hover:bg-slate-100 rounded transition-colors"><ChevronRight className="h-3 w-3" /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {monthNames.map((m, i) => (
                      <button key={i} onClick={() => { setSelectedMonth(i); setIsDatePopupOpen(false); }} className={`py-2 text-[9px] font-bold rounded-lg transition-all ${selectedMonth === i ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}>
                        {m.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto mx-4 mb-4 mt-2 flex-1 custom-scrollbar">
        {calendarData.agents.length === 0 ? (
          <div className="text-center text-slate-400 text-[11px] py-8">Nenhum atendimento encontrado para o período selecionado.</div>
        ) : (
          <table className="w-full text-[11px] text-left border-collapse min-w-max border border-slate-200">
            <thead className="bg-slate-50 sticky top-0 z-10 box-border text-[9px] font-black text-slate-600 uppercase">
              <tr>
                <th className="px-3 py-2 border border-slate-200 bg-slate-50 font-bold sticky left-0 z-20 min-w-[120px] shadow-[1px_0_0_0_#e2e8f0]">Mês de {monthNames[selectedMonth]}</th>
                {calendarData.daysInMonth.map((d, i) => (
                  <th key={i} className="px-1 py-1.5 border border-slate-200 text-center min-w-[40px]">
                    <div className="flex flex-col items-center">
                      <span className="text-slate-500 font-black">{format(d, 'dd/MM')}</span>
                      <span className="text-[8px] text-slate-400 font-bold capitalize">{format(d, 'E', { locale: ptBR })}</span>
                    </div>
                  </th>
                ))}
                <th className="px-3 py-1.5 border border-slate-200 bg-slate-50 text-center min-w-[60px] font-bold">Média Dia</th>
                <th className="px-3 py-1.5 border border-slate-200 bg-slate-50 text-center min-w-[60px] font-bold">TOTAL</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {calendarData.agents.map((agent, aIdx) => (
                <tr key={aIdx} className="hover:bg-slate-50">
                  <td className="px-3 py-2 border border-slate-200 font-bold text-slate-700 bg-white sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0] truncate max-w-[140px]">
                    {agent}
                  </td>
                  {calendarData.daysInMonth.map((d, dIdx) => {
                    const key = format(d, 'yyyy-MM-dd');
                    const count = calendarData.grid[agent][key] || 0;
                    return (
                      <td key={dIdx} className="border border-slate-200 p-0 text-center font-mono">
                        <div className={`w-full h-full min-h-[30px] p-1 flex items-center justify-center ${getColor(count)}`}>
                          {count > 0 ? count : '-'}
                        </div>
                      </td>
                    );
                  })}
                  {(() => {
                    let total = 0;
                    let weekdaySum = 0;
                    let weekdayCount = 0;
                    calendarData.daysInMonth.forEach(d => {
                      const key = format(d, 'yyyy-MM-dd');
                      const count = calendarData.grid[agent][key] || 0;
                      total += count;
                      const isWeekday = d.getDay() !== 0 && d.getDay() !== 6;
                      if (isWeekday) {
                        weekdaySum += count;
                        if (count > 0) weekdayCount++;
                      }
                    });
                    const avg = weekdayCount > 0 ? weekdaySum / weekdayCount : 0;
                    return (
                      <>
                        <td className="border border-slate-200 px-2 text-center font-bold text-slate-700 bg-slate-100/50">
                          {avg > 0 ? avg.toFixed(2).replace('.', ',') : '-'}
                        </td>
                        <td className="border border-slate-200 p-0 text-center font-mono relative">
                          <div className={`w-full h-full min-h-[30px] p-1 flex items-center justify-center ${getTotalColor(total)}`}>
                            {total > 0 ? total : '-'}
                          </div>
                        </td>
                      </>
                    );
                  })()}
                </tr>
              ))}

              <tr><td colSpan={calendarData.daysInMonth.length + 3} className="h-4 border-none bg-transparent"></td></tr>

              <tr className="bg-slate-50">
                <td className="px-3 py-2 border border-slate-200 font-black text-slate-800 bg-slate-100 sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0]">Total diário</td>
                {calendarData.daysInMonth.map((d, dIdx) => {
                  const key = format(d, 'yyyy-MM-dd');
                  const count = calendarData.dailyTotals[key].count;
                  return <td key={dIdx} className="px-1 py-2 border border-slate-200 text-center font-black text-slate-800 bg-slate-100/50">{count}</td>;
                })}
                <td className="border border-slate-200 px-2 py-2 text-center font-black text-slate-400 bg-slate-100 uppercase text-[10px]">#</td>
                {(() => {
                  let overall = 0;
                  calendarData.daysInMonth.forEach(d => {
                     const key = format(d, 'yyyy-MM-dd');
                     overall += calendarData.dailyTotals[key].count;
                  });
                  return <td className="border border-slate-200 px-2 py-2 text-center font-black text-slate-800 bg-slate-200">{overall}</td>;
                })()}
              </tr>
              <tr className="bg-slate-50">
                <td className="px-3 py-2 border border-slate-200 font-black text-slate-800 bg-slate-100 sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0]">Média</td>
                {calendarData.daysInMonth.map((d, dIdx) => {
                  const key = format(d, 'yyyy-MM-dd');
                  const count = calendarData.dailyTotals[key].count;
                  const aw = calendarData.dailyTotals[key].agentsWorked;
                  const avg = (count > 0 && aw > 0) ? (count / aw) % 1 === 0 ? (count / aw) : (count / aw).toFixed(1).replace('.', ',') : '-';
                  return <td key={dIdx} className="px-1 py-2 border border-slate-200 text-center font-bold text-slate-600 bg-slate-100/50">{avg}</td>;
                })}
                <td className="border border-slate-200 px-2 py-2 text-center font-black text-slate-400 bg-slate-100 uppercase text-[10px]">#</td>
                {(() => {
                  let sumCount = 0;
                  let sumAw = 0;
                  calendarData.daysInMonth.forEach(d => {
                     const key = format(d, 'yyyy-MM-dd');
                     sumCount += calendarData.dailyTotals[key].count;
                     sumAw += calendarData.dailyTotals[key].agentsWorked;
                  });
                  const ovAvg = (sumCount && sumAw) ? (sumCount / sumAw) : 0;
                  return <td className="border border-slate-200 px-2 py-2 text-center font-bold text-slate-700 bg-slate-200">{ovAvg > 0 ? ovAvg.toFixed(1).replace('.', ',') : '-'}</td>;
                })()}
              </tr>

              <tr><td colSpan={calendarData.daysInMonth.length + 3} className="h-4 border-none bg-transparent"></td></tr>

              {(() => {
                const renderSummaryRowValues = (type: 'chat' | 'calls' | 'total' | 'lost') => {
                  let total = 0;
                  let weekdaySum = 0;
                  let weekdayCount = 0;
                  calendarData.daysInMonth.forEach(d => {
                    const key = format(d, 'yyyy-MM-dd');
                    const count = calendarData.dailyTotals[key][type];
                    total += count;
                    const isWeekday = d.getDay() !== 0 && d.getDay() !== 6;
                    if (isWeekday) {
                      weekdaySum += count;
                      if (count > 0) weekdayCount++;
                    }
                  });
                  const avg = weekdayCount > 0 ? weekdaySum / weekdayCount : 0;
                  return (
                    <>
                      <td className="border border-slate-200 px-2 py-2 text-center font-bold text-slate-700 bg-slate-100/50">
                        {avg > 0 ? avg.toFixed(2).replace('.', ',') : type === 'total' || type === 'lost' ? '0' : '-'}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 text-center font-black text-slate-700 bg-slate-200/80">
                        {total > 0 ? total : type === 'total' || type === 'lost' ? '0' : '-'}
                      </td>
                    </>
                  );
                };

                return (
                  <>
                    <tr>
                      <td className="px-3 py-2 border border-slate-200 font-bold text-slate-700 bg-white sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0]">Total chat</td>
                      {calendarData.daysInMonth.map((d, dIdx) => {
                        const key = format(d, 'yyyy-MM-dd');
                        const count = calendarData.dailyTotals[key].chat;
                        return <td key={dIdx} className="px-1 py-2 border border-slate-200 text-center text-slate-600 bg-slate-50/50">{count > 0 ? count : '-'}</td>;
                      })}
                      {renderSummaryRowValues('chat')}
                    </tr>
                    <tr>
                      <td className="px-3 py-2 border border-slate-200 font-bold text-slate-700 bg-white sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0]">Total ligações atendidas</td>
                      {calendarData.daysInMonth.map((d, dIdx) => {
                        const key = format(d, 'yyyy-MM-dd');
                        const count = calendarData.dailyTotals[key].calls;
                        return <td key={dIdx} className="px-1 py-2 border border-slate-200 text-center text-slate-600 bg-slate-50/50">{count > 0 ? count : '-'}</td>;
                      })}
                      {renderSummaryRowValues('calls')}
                    </tr>
                    <tr>
                      <td className="px-3 py-2 border border-slate-200 font-bold text-slate-700 bg-emerald-50 sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0]">Total de atendimentos</td>
                      {calendarData.daysInMonth.map((d, dIdx) => {
                        const key = format(d, 'yyyy-MM-dd');
                        const count = calendarData.dailyTotals[key].total;
                        return (
                          <td key={dIdx} className="border border-slate-200 p-0 text-center font-mono">
                            <div className={`w-full h-full min-h-[30px] p-1 flex items-center justify-center ${getColor(count)}`}>
                              {count > 0 ? count : '-'}
                            </div>
                          </td>
                        );
                      })}
                      {renderSummaryRowValues('total')}
                    </tr>
                    <tr>
                      <td className="px-3 py-2 border border-slate-200 font-bold text-slate-700 bg-rose-50 sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0]">Ligações perdidas</td>
                      {calendarData.daysInMonth.map((d, dIdx) => {
                        const key = format(d, 'yyyy-MM-dd');
                        const count = calendarData.dailyTotals[key].lost;
                        return (
                          <td key={dIdx} className="border border-slate-200 p-0 text-center font-mono">
                            <div className={`w-full h-full min-h-[30px] p-1 flex items-center justify-center font-bold ${count > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-50 text-slate-400'}`}>
                              {count > 0 ? count : '-'}
                            </div>
                          </td>
                        );
                      })}
                      {renderSummaryRowValues('lost')}
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RecurringAgentsCard({ data, onFilter, activeFilter }: { data: CallData[], onFilter: (num: string) => void, activeFilter: string }) {
  const recurringByNumber = useMemo(() => {
    const counts = data.reduce((acc, call) => {
      const num = call.callerNumber;
      const agent = call.agentName;
      const isAbandoned = call.leftQueueReason?.toLowerCase() === 'abandon';
      
      if (num && num !== 'Unknown' && num !== 'Anonymous') {
        if (!acc[num]) acc[num] = { total: 0, perdidas: 0, agents: {} as Record<string, number> };
        
        if (agent && agent !== 'Ligações Perdidas') {
          acc[num].total += 1;
          acc[num].agents[agent] = (acc[num].agents[agent] || 0) + 1;
        }

        if (isAbandoned) {
          acc[num].perdidas += 1;
        }
      }
      return acc;
    }, {} as Record<string, { total: number; perdidas: number; agents: Record<string, number> }>);
    
    return Object.entries(counts)
      .filter(([_, val]) => (val.total + val.perdidas) > 1)
      .sort((a, b) => (b[1].total + b[1].perdidas) - (a[1].total + a[1].perdidas))
      .slice(0, 15)
      .map(([num, val]) => {
        // Create a summary of agents like "Rodrigo (2), Tamara (3)"
        const agentSummary = Object.entries(val.agents)
          .map(([name, count]) => `${name} (${count})`)
          .join(', ');
        
        return { 
          num: formatPhone(num), 
          rawNum: num, 
          total: val.total,
          perdidas: val.perdidas,
          agentList: agentSummary || 'Apenas perdidas > 1m'
        };
      });
  }, [data]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col col-span-1 lg:col-span-2 h-full">
      <h3 className="text-sm font-semibold mb-1 text-slate-900">Padrões de Reincidência</h3>
      <p className="text-[10px] text-slate-400 mb-3">Histórico de reatendimento por número de cliente.</p>
      {recurringByNumber.length === 0 ? (
        <p className="text-slate-400 text-[11px]">Nenhuma recorrência de atendimento encontrada.</p>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-3 py-2 font-medium">Número (Cliente)</th>
                <th className="px-3 py-2 font-medium text-center">Reincidência</th>
                <th className="px-3 py-2 font-medium text-center">Perdidas</th>
                <th className="px-3 py-2 font-medium">Operadores e Interações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recurringByNumber.map((item, idx) => {
                const isActive = activeFilter === item.rawNum;
                return (
                  <tr 
                    key={idx} 
                    className={`transition-all cursor-pointer ${isActive ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'hover:bg-amber-50'}`}
                    onClick={() => onFilter(item.rawNum)}
                    title={isActive ? "Clique para remover filtro" : "Clique para filtrar as chamadas deste número"}
                  >
                    <td className={`px-3 py-2 font-mono text-[11px] font-bold ${isActive ? 'text-indigo-700' : 'text-slate-900'}`}>{item.num}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full inline-block ${isActive ? 'bg-indigo-200 text-indigo-800' : 'bg-indigo-50 text-indigo-700'}`}>
                        {item.total}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {item.perdidas > 0 ? (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full inline-block ${isActive ? 'bg-rose-200 text-rose-800' : 'bg-rose-50 text-rose-600'}`}>
                          {item.perdidas}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[10px] px-2">-</span>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-[10px] italic max-w-xs truncate ${isActive ? 'text-indigo-600' : 'text-slate-500'}`} title={item.agentList}>
                      {item.agentList}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdvancedRecurrenceIndex({ data }: { data: CallData[] }) {
  const callerCounts = data.reduce((acc, call) => {
    if (call.callerNumber && call.callerNumber !== 'Unknown' && call.callerNumber !== 'Anonymous') {
      acc[call.callerNumber] = (acc[call.callerNumber] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  const uniqueCallers = Object.keys(callerCounts).length;
  const recurringCallers = Object.values(callerCounts).filter(count => count > 1).length;
  const recurrenceRate = uniqueCallers > 0 ? Math.round((recurringCallers / uniqueCallers) * 100) : 0;

  return (
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between h-[200px] group transition-all duration-300 hover:shadow-indigo-500/10">
        {/* Abstract pattern background */}
        <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
           <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl -ml-24 -mb-24" />
        </div>

        <div className="relative z-10 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-50 rounded-xl text-indigo-400 border border-slate-100 group-hover:scale-110 transition-transform">
                 <Users className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Índice de Recorrência</h4>
                <p className="text-[8px] text-slate-500 uppercase font-black mt-1">Frequência de Clientes</p>
              </div>
           </div>
           {recurrenceRate > 20 && (
             <div className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border border-indigo-500/10">
               Relevante
             </div>
           )}
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center flex-1 my-2">
            <span className="text-5xl font-black text-slate-900 tracking-tighter leading-none group-hover:scale-105 transition-transform duration-500">{recurrenceRate}%</span>
            <div className="h-1 w-12 bg-indigo-500 rounded-full mt-3 opacity-50" />
        </div>

        <div className="relative z-10 flex items-end justify-between pt-3 border-t border-slate-100">
          <div className="flex flex-col">
             <span className="text-[10px] font-black text-slate-900">{uniqueCallers}</span>
             <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Base Única</span>
          </div>
          
          <div className="flex gap-1 items-end h-6">
            {[30, 60, 45, 90, 55].map((h, i) => (
              <div key={i} className={`w-1 rounded-full bg-indigo-500/20`} style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
  );
}

function ProductivityCalendar({ data }: { data: CallData[] }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedAgent, setSelectedAgent] = useState('Todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [isDatePopupOpen, setIsDatePopupOpen] = useState(false);
  const [isModalDatePopupOpen, setIsModalDatePopupOpen] = useState(false);
  const datePopupRef = useRef<HTMLDivElement>(null);
  const modalDatePopupRef = useRef<HTMLDivElement>(null);

  // Sync calendar with data month/year when data changes
  useEffect(() => {
    if (data.length > 0) {
      // Find the most recent call date to set the calendar view
      const dates = data.map(d => d.startTime.getTime());
      const mostRecent = new Date(Math.max(...dates));
      setSelectedMonth(mostRecent.getMonth());
      setSelectedYear(mostRecent.getFullYear());
    }
  }, [data]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePopupRef.current && !datePopupRef.current.contains(event.target as Node)) {
        setIsDatePopupOpen(false);
      }
      if (modalDatePopupRef.current && !modalDatePopupRef.current.contains(event.target as Node)) {
        setIsModalDatePopupOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const agents = useMemo(() => {
    const s = new Set<string>();
    data.forEach(d => {
      const name = formatAgentName(d.agentName);
      if (name && name !== 'Ligações Perdidas') s.add(name);
    });
    return ['Todos', ...Array.from(s).sort()];
  }, [data]);

  const calendarData = useMemo(() => {
    const start = startOfMonth(new Date(selectedYear, selectedMonth));
    const end = endOfMonth(start);
    const daysInMonth = eachDayOfInterval({ start, end });
    
    const stats: Record<string, number> = {};
    data.forEach(d => {
      const dMonth = d.startTime.getMonth();
      const dYear = d.startTime.getFullYear();
      if (dMonth === selectedMonth && dYear === selectedYear) {
        // Exclude lost calls (abandon) from productivity count
        if (d.leftQueueReason?.toLowerCase() === 'abandon') return;

        const prettyName = formatAgentName(d.agentName);
        if (selectedAgent === 'Todos' || prettyName === selectedAgent) {
          const key = format(d.startTime, 'yyyy-MM-dd');
          stats[key] = (stats[key] || 0) + 1;
        }
      }
    });

    return { daysInMonth, stats, firstDayIdx: start.getDay() };
  }, [data, selectedMonth, selectedYear, selectedAgent]);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const getColor = (count: number) => {
    if (!count) return 'bg-slate-50 border-slate-100';
    if (count <= 5) return 'bg-red-50 border-red-100 text-red-700';
    if (count <= 10) return 'bg-orange-50 border-orange-100 text-orange-700';
    if (count <= 15) return 'bg-yellow-100 border-yellow-200 text-yellow-800';
    if (count <= 30) return 'bg-emerald-200 border-emerald-300 text-emerald-900';
    return 'bg-emerald-400 border-emerald-500 text-white font-bold';
  };

  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = Array(7).fill(null);
  
  calendarData.daysInMonth.forEach((day) => {
    const idx = day.getDay();
    if (idx === 0 && day.getDate() !== 1) {
      weeks.push(currentWeek);
      currentWeek = Array(7).fill(null);
    }
    currentWeek[idx] = day;
  });
  weeks.push(currentWeek);

  return (
    <>
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col h-[424px]">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-6 relative">
        <div className="flex items-center justify-between">
          <div className="w-8" /> {/* Spacer */}
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight text-center">Produtividade</h3>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
            title="Expandir visualização"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
        
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200 relative">
            <button 
              onClick={handlePrevMonth}
              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-sm rounded-md transition-all shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <button 
              onClick={() => setIsDatePopupOpen(!isDatePopupOpen)}
              className="px-3 py-1 text-[10px] font-black text-slate-700 uppercase tracking-tighter hover:bg-white hover:shadow-sm rounded-md transition-all whitespace-nowrap min-w-[100px] text-center"
            >
              {monthNames[selectedMonth]} {selectedYear}
            </button>

            <button 
              onClick={handleNextMonth}
              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-sm rounded-md transition-all shrink-0"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Date Quick Selector Popup */}
            <AnimatePresence>
              {isDatePopupOpen && (
                <motion.div 
                  ref={datePopupRef}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full left-0 mt-2 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-4 w-[240px]"
                >
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-50">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Escolha Rápida</span>
                    <div className="flex items-center gap-2">
                       <button onClick={() => setSelectedYear(selectedYear - 1)} className="p-1 hover:bg-slate-100 rounded transition-colors"><ChevronLeft className="h-3 w-3" /></button>
                       <span className="text-xs font-black text-slate-900">{selectedYear}</span>
                       <button onClick={() => setSelectedYear(selectedYear + 1)} className="p-1 hover:bg-slate-100 rounded transition-colors"><ChevronRight className="h-3 w-3" /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {monthNames.map((m, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setSelectedMonth(i);
                          setIsDatePopupOpen(false);
                        }}
                        className={`py-2 text-[9px] font-bold rounded-lg transition-all ${selectedMonth === i ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}
                      >
                        {m.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <select 
            value={selectedAgent} 
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="text-[10px] font-bold bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none max-w-[140px] truncate shrink-0 hover:border-indigo-300 transition-colors cursor-pointer"
          >
            {agents.map(a => <option key={a} value={a}>{formatAgentName(a)}</option>)}
          </select>
        </div>
      </div>

      {/* Week Header */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-1 mb-1">
        <div />
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-black text-slate-400">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex flex-col gap-1">
        {weeks.map((week, wIdx) => (
          <div key={wIdx} className="grid grid-cols-[60px_repeat(7,1fr)] gap-1 items-center min-h-[40px]">
            <div className="text-[9px] font-black text-slate-400 uppercase whitespace-nowrap">{wIdx + 1}ª Sem</div>
            {week.map((day, dIdx) => {
              const key = day ? format(day, 'yyyy-MM-dd') : null;
              const count = key ? calendarData.stats[key] || 0 : 0;
              return (
                <div 
                  key={dIdx}
                  className={`aspect-square rounded-md border relative transition-all ${day ? getColor(count) : 'bg-transparent border-transparent'}`}
                  title={day ? `${format(day, 'dd/MM')}: ${count} chamadas` : ''}
                >
                  {day && (
                    <span className="absolute top-1 left-1 text-[7px] leading-none opacity-50 font-bold select-none">
                      {day.getDate()}
                    </span>
                  )}
                  {day && count > 0 && (
                    <div className="flex items-center justify-center w-full h-full">
                      <span className="text-[11px] font-black">{count}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>

    {/* Modal for Expanded Calendar */}
    <AnimatePresence>
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsModalOpen(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 rounded-xl shadow-md shadow-indigo-100">
                  <CalendarIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Produtividade Detalhada</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">Visão Mensal de Atendimentos</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <AnimatePresence>
                  {copyFeedback && (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="bg-emerald-500 text-white text-[10px] font-black px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-2"
                    >
                      <Check className="h-3 w-3" />
                      COPIADO: {copyFeedback}
                    </motion.div>
                  )}
                </AnimatePresence>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-8 overflow-y-auto overflow-x-hidden">
              <div className="flex flex-wrap items-center justify-between gap-6 mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-200/50">
                <div className="flex items-center gap-6">
                  <div className="flex flex-col relative">
                    <span className="text-[9px] font-black text-slate-400 uppercase mb-2 ml-1">Período</span>
                    <div className="flex items-center gap-1 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm relative">
                      <button 
                        onClick={handlePrevMonth}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all shrink-0"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      
                      <button 
                        onClick={() => setIsModalDatePopupOpen(!isModalDatePopupOpen)}
                        className="px-6 py-1.5 text-sm font-black text-slate-700 uppercase tracking-tight hover:bg-slate-50 rounded-lg transition-all whitespace-nowrap min-w-[160px] text-center"
                      >
                        {monthNames[selectedMonth]} {selectedYear}
                      </button>

                      <button 
                        onClick={handleNextMonth}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all shrink-0"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>

                      {/* Modal Date Quick Selector Popup */}
                      <AnimatePresence>
                        {isModalDatePopupOpen && (
                          <motion.div 
                            ref={modalDatePopupRef}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-[280px]"
                          >
                            <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-50">
                              <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Seleção Rápida</span>
                              <div className="flex items-center gap-3">
                                 <button onClick={() => setSelectedYear(selectedYear - 1)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><ChevronLeft className="h-4 w-4" /></button>
                                 <span className="text-sm font-black text-slate-900">{selectedYear}</span>
                                 <button onClick={() => setSelectedYear(selectedYear + 1)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><ChevronRight className="h-4 w-4" /></button>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {monthNames.map((m, i) => (
                                <button
                                  key={i}
                                  onClick={() => {
                                    setSelectedMonth(i);
                                    setIsModalDatePopupOpen(false);
                                  }}
                                  className={`py-3 text-[10px] font-black rounded-xl transition-all uppercase tracking-tighter ${selectedMonth === i ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                  {m.substring(0, 3)}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase mb-2 ml-1">Filtrar por Operador</span>
                  <select 
                    value={selectedAgent} 
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className="text-sm font-bold bg-white border border-slate-200 rounded-xl px-5 py-2.5 outline-none min-w-[240px] hover:border-indigo-300 transition-all cursor-pointer shadow-sm"
                  >
                    {agents.map(a => <option key={a} value={a}>{formatAgentName(a)}</option>)}
                  </select>
                </div>
              </div>

              {/* Grid Header (Weekdays) */}
              <div className="grid grid-cols-[70px_repeat(7,1fr)] gap-2 sm:gap-4 mb-2 w-full">
                <div />
                {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((d, i) => (
                  <div key={i} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest py-3 bg-slate-50/50 rounded-t-xl border-x border-transparent">{d}</div>
                ))}
              </div>

              {/* Grid Body */}
              <div className="flex flex-col gap-2 sm:gap-4 w-full">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="grid grid-cols-[70px_repeat(7,1fr)] gap-2 sm:gap-4 items-stretch">
                    <button 
                      onClick={() => {
                        const counts = week
                          .map(day => {
                            if (!day) return null;
                            const key = format(day, 'yyyy-MM-dd');
                            return calendarData.stats[key] || 0;
                          })
                          .filter(c => c !== null);
                        handleCopy(counts.join(', '), `${wIdx + 1}ª Semana`);
                      }}
                      className="flex flex-col items-center justify-center bg-white hover:bg-indigo-50 rounded-2xl border border-slate-200 p-2 transition-all group relative overflow-hidden"
                      title="Clique para copiar todos os números desta semana"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className="text-[9px] font-black text-slate-400 group-hover:text-indigo-600 uppercase tracking-tighter text-center leading-tight">
                        {wIdx + 1}ª<br/>Semana
                      </span>
                      <Copy className="h-3 w-3 mt-1.5 opacity-0 group-hover:opacity-100 transition-all text-indigo-400" />
                    </button>
                    {week.map((day, dIdx) => {
                      const key = day ? format(day, 'yyyy-MM-dd') : null;
                      const count = key ? calendarData.stats[key] || 0 : 0;
                      return (
                        <div 
                          key={dIdx}
                          onClick={() => day && handleCopy(count.toString(), format(day, 'dd/MM/yyyy'))}
                          className={`aspect-square rounded-xl border relative transition-all group cursor-pointer ${day ? getColor(count).replace('border-2', 'border') : 'bg-transparent border-transparent cursor-default'}`}
                        >
                          {day && (
                            <span className="absolute top-2 left-3 text-[10px] opacity-40 font-black">
                              {day.getDate()}
                            </span>
                          )}
                          {day && (
                            <div className="flex flex-col items-center justify-center h-full">
                              <span className={`text-2xl font-black tracking-tighter ${count > 0 ? 'opacity-100' : 'opacity-20'}`}>
                                {count}
                              </span>
                              {count > 0 && <span className="text-[7px] uppercase font-black opacity-50 tracking-widest mt-0.5 text-center">Atendimentos</span>}
                            </div>
                          )}
                          {day && (
                             <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400">
                               <Copy className="h-3 w-3" />
                             </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="mt-12 flex items-center justify-center gap-8 py-6 border-t border-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-slate-50 border border-slate-100" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Sem Chamadas</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-red-50 border border-red-200" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">1 - 5</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-orange-50 border border-orange-100" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">6 - 10</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-200" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">11 - 15</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-emerald-200 border border-emerald-300" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">16 - 30</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-emerald-400 border border-emerald-500" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">31+</span>
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              Isolamento de Dados de Produtividade • v2.1
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}

function AgentPerformanceSummary({ data }: { data: CallData[] }) {
  const [sortCol, setSortCol] = useState<string>('atendidas');
  const [sortDesc, setSortDesc] = useState(true);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDesc(!sortDesc);
    } else {
      setSortCol(col);
      setSortDesc(col !== 'name'); // default descending for numbers
    }
  };

  const summaryData = useMemo(() => {
    const agents = data.reduce((acc, call) => {
      const name = call.agentName || 'Não Atribuído';
      if (name === 'Não Atribuído' || name.trim() === '') return acc;
      
      const shortName = name.split(' - ')[0];
      if (!acc[shortName]) acc[shortName] = { 
        name: shortName, 
        atendidas: 0, 
        atendidasGoTo: 0,
        atendidasChat: 0,
        totalTalkTime: 0, 
        callsByNumber: {} as Record<string, number> 
      };
      
      const reason = call.leftQueueReason?.toLowerCase() || '';
      if (reason === 'answered') {
        acc[shortName].atendidas += 1;
        acc[shortName].totalTalkTime += call.talkDuration;
        
        if (call.origin === 'GoTo') {
          acc[shortName].atendidasGoTo += 1;
        } else if (call.origin === 'Chat') {
          acc[shortName].atendidasChat += 1;
        }
      }
      
      const num = call.callerNumber;
      if (num && num !== 'Unknown' && num !== 'Anonymous') {
         acc[shortName].callsByNumber[num] = (acc[shortName].callsByNumber[num] || 0) + 1;
      }

      return acc;
    }, {} as Record<string, any>);

    return Object.values(agents).map((agent: any) => {
      let recurrences = 0;
      for (const count of Object.values(agent.callsByNumber) as number[]) {
        if (count > 1) {
          recurrences += count;
        }
      }
      
      return {
        name: agent.name,
        atendidas: agent.atendidas,
        atendidasGoTo: agent.atendidasGoTo,
        atendidasChat: agent.atendidasChat,
        totalTalkTime: agent.totalTalkTime,
        avgTalkTime: agent.atendidas > 0 ? Math.round(agent.totalTalkTime / agent.atendidas) : 0,
        recurrences: recurrences
      };
    }).filter((agent: any) => agent.name !== 'Ligações Perdidas');
  }, [data]);

  const sortedSummary = useMemo(() => {
    return [...summaryData].sort((a: any, b: any) => {
      let valA = a[sortCol];
      let valB = b[sortCol];
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
      }
      return sortDesc ? valB - valA : valA - valB;
    });
  }, [summaryData, sortCol, sortDesc]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 shrink-0 overflow-x-auto">
      <h3 className="text-sm font-semibold mb-3 text-slate-900">Resumo do desempenho individual</h3>
      <table className="w-full text-xs text-left cursor-default">
        <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
          <tr>
            <th 
              className="px-3 py-2 font-medium cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => handleSort('name')}
            >
              <div className="flex items-center gap-1">Operador <ArrowUpDown className="h-3 w-3" /></div>
            </th>
            <th 
              className="px-3 py-2 font-medium cursor-pointer hover:bg-slate-100 transition-colors text-center"
              onClick={() => handleSort('atendidas')}
            >
              <div className="flex items-center justify-center gap-1">Total Atendidas <ArrowUpDown className="h-3 w-3" /></div>
            </th>
            <th 
              className="px-3 py-2 font-medium cursor-pointer hover:bg-slate-100 transition-colors text-center"
              onClick={() => handleSort('atendidasGoTo')}
            >
              <div className="flex items-center justify-center gap-1 text-indigo-600">GoTo <ArrowUpDown className="h-3 w-3" /></div>
            </th>
            <th 
              className="px-3 py-2 font-medium cursor-pointer hover:bg-slate-100 transition-colors text-center"
              onClick={() => handleSort('atendidasChat')}
            >
              <div className="flex items-center justify-center gap-1 text-emerald-600">Chat <ArrowUpDown className="h-3 w-3" /></div>
            </th>
            <th 
              className="px-3 py-2 font-medium cursor-pointer hover:bg-slate-100 transition-colors text-center"
              onClick={() => handleSort('avgTalkTime')}
            >
              <div className="flex items-center justify-center gap-1">T. Médio de Atendimento <ArrowUpDown className="h-3 w-3" /></div>
            </th>
            <th 
              className="px-3 py-2 font-medium cursor-pointer hover:bg-slate-100 transition-colors text-center"
              onClick={() => handleSort('totalTalkTime')}
            >
              <div className="flex items-center justify-center gap-1">T. de Conversa Total <ArrowUpDown className="h-3 w-3" /></div>
            </th>
            <th 
              className="px-3 py-2 font-medium cursor-pointer hover:bg-slate-100 transition-colors text-center"
              onClick={() => handleSort('recurrences')}
            >
              <div className="flex items-center justify-center gap-1">Nº de Recorrências <ArrowUpDown className="h-3 w-3" /></div>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {sortedSummary.length === 0 ? (
            <tr><td colSpan={7} className="px-3 py-4 text-center text-slate-400">Nenhum dado encontrado</td></tr>
          ) : (
            sortedSummary.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2 font-medium text-[11px] text-slate-900">{formatAgentName(item.name)}</td>
                <td className="px-3 py-2 text-[11px] font-mono text-indigo-900 text-center font-bold bg-slate-50/50">{item.atendidas}</td>
                <td className="px-3 py-2 text-[11px] font-mono text-indigo-600 text-center">{item.atendidasGoTo}</td>
                <td className="px-3 py-2 text-[11px] font-mono text-emerald-600 text-center">{item.atendidasChat}</td>
                <td className="px-3 py-2 text-[11px] font-mono text-center">
                  <CustomTooltip title="Métricas de Atendimento (SLA)" items={SLA_METRICS}>
                    <span className={`cursor-help transition-all ${getSlaColor(item.avgTalkTime)}`}>
                      {formatSeconds(item.avgTalkTime)}
                    </span>
                  </CustomTooltip>
                </td>
                <td className="px-3 py-2 text-[11px] font-mono text-center">
                  <CustomTooltip title="Métricas de Conversa Total" items={TOTAL_TALK_METRICS}>
                    <span className={`cursor-help transition-all ${getTotalTalkTimeColor(item.totalTalkTime)}`}>
                      {formatSeconds(item.totalTalkTime)}
                    </span>
                  </CustomTooltip>
                </td>
                <td className="px-3 py-2 text-[11px] font-mono text-slate-600 text-center">{item.recurrences}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function LogsTable({ data, allUniqueValues }: { data: CallData[], allUniqueValues: Record<string, string[]> }) {
  const [sortCol, setSortCol] = useState<keyof CallData | null>('startTime');
  const [sortDesc, setSortDesc] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [filterDropdownOpen, setFilterDropdownOpen] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const handleSort = (col: keyof CallData) => {
    setCurrentPage(1);
    if (sortCol === col) {
      setSortDesc(!sortDesc);
    } else {
      setSortCol(col);
      setSortDesc(true);
    }
  };

  const toggleFilterValue = (col: string, value: string) => {
    setCurrentPage(1);
    setColumnFilters(prev => {
      const current = prev[col] || [];
      const next = current.includes(value) 
        ? current.filter(v => v !== value) 
        : [...current, value];
      
      const newFilters = { ...prev };
      if (next.length === 0) {
        delete newFilters[col];
      } else {
        newFilters[col] = next;
      }
      return newFilters;
    });
  };

  const filteredData = useMemo(() => {
    return data.filter(item => {
      return Object.entries(columnFilters).every(([col, values]) => {
        let stringVal = '';
        if (col === 'startTime') {
          stringVal = item._dateFormatted || '-';
        } else if (col === 'status' || col === 'leftQueueReason') {
          stringVal = item._status || '-';
        } else if (col === 'movedAt' || col === 'resolutionDate' || col === 'slaN2FirstEntry' || col === 'slaN2FirstExit') {
          const val = item[col as keyof CallData];
          stringVal = val instanceof Date ? format(val, 'dd/MM/yyyy HH:mm') : String(val || '-');
        } else {
          const val = item[col as keyof CallData];
          stringVal = String(val || '-');
        }
        return values.includes(stringVal);
      });
    });
  }, [data, columnFilters]);

  const sortedData = useMemo(() => {
    const dataSource = filteredData;
    if (!sortCol) return dataSource;
    return [...dataSource].sort((a, b) => {
      let valA = a[sortCol];
      let valB = b[sortCol];
      
      if (valA instanceof Date && valB instanceof Date) {
        return sortDesc ? valB.getTime() - valA.getTime() : valA.getTime() - valB.getTime();
      }
      
      if (typeof valA === 'string' && typeof valB === 'string') {
        const strA = String(valA || '');
        const strB = String(valB || '');
        return sortDesc ? strB.localeCompare(strA) : strA.localeCompare(strB);
      }
      
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDesc ? valB - valA : valA - valB;
      }
      return 0;
    });
  }, [filteredData, sortCol, sortDesc]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(start, start + itemsPerPage);
  }, [sortedData, currentPage]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  const handleExport = () => {
    const headers = ["Ticket", "Origem", "Data", "Espera", "Hora Inicio", "Hora Fim", "Conversa", "Telefone", "Operador", "Fila", "Status"];
    const dataSource = sortedData;
    const csvData = dataSource.map(call => {
      const startTime = new Date(call.startTime);
      const endTime = new Date(startTime.getTime() + (call.talkDuration * 1000));
      const status = call._status;
      
      return [
        call.ticketNumber || '-',
        call.origin,
        call._dateFormatted,
        formatSeconds(call.waitTime),
        format(startTime, 'HH:mm:ss'),
        format(endTime, 'HH:mm:ss'),
        formatSeconds(call.talkDuration),
        call.callerNumber,
        call.agentName,
        call.queue,
        status
      ].join(';');
    });

    const csvContent = [headers.join(';'), ...csvData].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `logs-atendimento-${format(new Date(), 'dd-MM-yyyy')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const Th = ({ label, colKey, extraClass = "" }: { label: string, colKey: keyof CallData, extraClass?: string }) => {
    const uniqueValues = allUniqueValues[colKey as string] || [];
    const activeFilters = columnFilters[colKey as string] || [];
    const isFiltered = activeFilters.length > 0;

    return (
      <th 
        className={`p-4 bg-slate-50/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-20 ${extraClass}`}
      >
        <div className="flex items-center justify-between gap-1.5">
          <div 
            className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-600 transition-colors select-none flex-1 truncate"
            onClick={() => handleSort(colKey)}
          >
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">{label}</span>
            {sortCol === colKey && (
              sortDesc ? <ChevronDown className="h-3 w-3 text-indigo-500 shrink-0" /> : <ChevronUp className="h-3 w-3 text-indigo-500 shrink-0" />
            )}
          </div>
          <div className="relative shrink-0">
             <button 
               onClick={(e) => {
                  e.stopPropagation();
                  setFilterDropdownOpen(filterDropdownOpen === (colKey as string) ? null : (colKey as string));
               }}
               className={`p-1 rounded-md transition-all ${isFiltered ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
             >
               <Filter className="h-3 w-3" />
             </button>
             {filterDropdownOpen === colKey && (
               <TableFilterDropdown 
                 options={uniqueValues}
                 selectedValues={activeFilters}
                 onToggle={(val) => toggleFilterValue(colKey as string, val)}
                 onClose={() => setFilterDropdownOpen(null)}
               />
             )}
          </div>
        </div>
      </th>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 flex-1 flex flex-col overflow-hidden shadow-sm h-[600px] mt-6">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 bg-blue-600 rounded-full" />
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Logs de Atendimento</h2>
          <AnimatePresence>
            {copiedId && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="bg-emerald-500 text-white text-[10px] px-3 py-1 rounded-full font-bold shadow-lg shadow-emerald-200 flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-3 w-3" />
                Ticket {copiedId} Copiado
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button 
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 active:scale-95"
        >
          <Download className="h-3.5 w-3.5" />
          Exportar
        </button>
      </div>
      <div className="overflow-x-auto flex-1 h-full overflow-y-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-20 text-[10px]">
            <tr>
              <Th label="Ticket" colKey="ticketNumber" extraClass="w-[100px] min-w-[100px] max-w-[100px]" />
              <Th label="Origem" colKey="origin" />
              <Th label="Data" colKey="startTime" />
              <Th label="Espera" colKey="waitTime" />
              <Th label="Hora Inicio" colKey="startTime" />
              <Th label="Hora Fim" colKey="startTime" />
              <Th label="Conversa" colKey="talkDuration" />
              <Th label="Telefone" colKey="callerNumber" />
              <Th label="Operador" colKey="agentName" />
              <Th label="Fila" colKey="queue" />
              <Th label="Status" colKey="leftQueueReason" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[11px]">
            {paginatedData.map((call, idx) => {
              const status = call._status || '-';
              
              const statusColors = status === 'Atendida' || status === 'Resolvido'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-rose-50 text-rose-700 border-rose-200';
              
              const startTime = new Date(call.startTime);
              const endTime = new Date(startTime.getTime() + (call.talkDuration * 1000));
              
              const handleCopyTicket = (ticket: string | undefined) => {
                if (!ticket) return;
                navigator.clipboard.writeText(ticket);
                setCopiedId(ticket);
                setTimeout(() => setCopiedId(null), 2000);
              };

              return (
                <tr key={idx} className="group hover:bg-slate-50/80 transition-colors">
                  <td className="p-4 w-[100px] min-w-[100px] max-w-[100px]">
                    <div className="flex items-center gap-1.5">
                      {call.ticketNumber ? (
                        <>
                          <div className="bg-blue-50 border border-blue-100 rounded-lg px-2 py-1.5 flex items-center justify-center min-w-[60px]">
                            <a 
                              href={`https://atendimento.movidesk.com/Ticket/Details/${call.ticketNumber}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-700 font-black hover:text-blue-800 transition-colors text-[11px] font-mono"
                            >
                              {call.ticketNumber}
                            </a>
                          </div>
                          <button 
                            onClick={() => handleCopyTicket(call.ticketNumber)}
                            className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all flex items-center justify-center shadow-sm"
                            title="Copiar Ticket"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                      call.origin === 'Chat' ? 'bg-teal-50 text-teal-700 border-teal-100' :
                      call.origin === 'GoTo' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                      'bg-indigo-50 text-indigo-700 border-indigo-100'
                    }`}>
                      {call.origin}
                    </span>
                  </td>
                  <td className="p-4 whitespace-nowrap font-medium text-slate-600">
                    {call._dateFormatted}
                  </td>
                  <td className="p-4 font-mono text-slate-500">
                    {formatSeconds(call.waitTime)}
                  </td>
                  <td className="p-4 whitespace-nowrap font-mono text-slate-500">
                    {format(startTime, 'HH:mm:ss')}
                  </td>
                  <td className="p-4 whitespace-nowrap font-mono text-slate-500">
                    {format(endTime, 'HH:mm:ss')}
                  </td>
                  <td className="p-4 font-mono text-indigo-700 font-bold">
                    {formatSeconds(call.talkDuration)}
                  </td>
                  <td className="p-4 font-mono text-slate-500">
                    {formatPhone(call.callerNumber)}
                  </td>
                  <td className="p-4 font-semibold text-slate-700">
                    {call.agentName}
                  </td>
                  <td className="p-4 text-slate-600 max-w-[150px] truncate" title={call.queue}>
                    {call.queue}
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${statusColors}`}>
                      {status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sortedData.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-xs">
            Nenhum dado encontrado com os filtros aplicados.
          </div>
        )}
      </div>

      {/* Pagination UI */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Página {currentPage} de {totalPages} ({sortedData.length} resultados)
          </div>
          <div className="flex items-center gap-1">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="p-2 hover:bg-white rounded-lg border border-slate-200 disabled:opacity-30 transition-all text-slate-600"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1">
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                let pageNum = currentPage;
                if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;
                
                if (pageNum <= 0 || pageNum > totalPages) return null;

                return (
                  <button 
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`h-8 w-8 flex items-center justify-center rounded-lg text-[11px] font-bold transition-all border ${
                      currentPage === pageNum 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20' 
                        : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="p-2 hover:bg-white rounded-lg border border-slate-200 disabled:opacity-30 transition-all text-slate-600"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DataTable({ data, allUniqueValues }: { data: CallData[], allUniqueValues: Record<string, string[]> }) {
  const [sortCol, setSortCol] = useState<keyof CallData | null>('startTime');
  const [sortDesc, setSortDesc] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [filterDropdownOpen, setFilterDropdownOpen] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const handleSort = (col: keyof CallData) => {
    setCurrentPage(1);
    if (sortCol === col) {
      setSortDesc(!sortDesc);
    } else {
      setSortCol(col);
      setSortDesc(false);
    }
  };

  const toggleFilterValue = (col: string, value: string) => {
    setCurrentPage(1);
    setColumnFilters(prev => {
      const current = prev[col] || [];
      const next = current.includes(value) 
        ? current.filter(v => v !== value) 
        : [...current, value];
      
      const newFilters = { ...prev };
      if (next.length === 0) {
        delete newFilters[col];
      } else {
        newFilters[col] = next;
      }
      return newFilters;
    });
  };

  const filteredData = useMemo(() => {
    return data.filter(item => {
      return Object.entries(columnFilters).every(([col, values]) => {
        let stringVal = '';
        if (col === 'startTime') {
          stringVal = item._dateFormatted || '-';
        } else if (col === 'status' || col === 'leftQueueReason') {
          stringVal = item._status || '-';
        } else if (col === 'movedAt' || col === 'resolutionDate' || col === 'slaN2FirstEntry' || col === 'slaN2FirstExit') {
          const val = item[col as keyof CallData];
          stringVal = val instanceof Date ? format(val, 'dd/MM/yyyy HH:mm') : String(val || '-');
        } else {
          const val = item[col as keyof CallData];
          stringVal = String(val || '-');
        }
        return values.includes(stringVal);
      });
    });
  }, [data, columnFilters]);

  const sortedData = useMemo(() => {
    const dataSource = filteredData;
    if (!sortCol) return dataSource;
    return [...dataSource].sort((a, b) => {
      let valA = a[sortCol];
      let valB = b[sortCol];
      
      if (valA instanceof Date && valB instanceof Date) {
        return sortDesc ? valB.getTime() - valA.getTime() : valA.getTime() - valB.getTime();
      }
      
      if (typeof valA === 'string' && typeof valB === 'string') {
        const strA = String(valA || '');
        const strB = String(valB || '');
        return sortDesc ? strB.localeCompare(strA) : strA.localeCompare(strB);
      }
      
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDesc ? valB - valA : valA - valB;
      }
      return 0;
    });
  }, [filteredData, sortCol, sortDesc]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(start, start + itemsPerPage);
  }, [sortedData, currentPage]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  const exportCSV = () => {
    const head = [
      'Ticket', 'Origem', 'Aberto em', 'Movimentado em', 'Resolvido em', 
      'Responsável: Equipe', 'Criado por', 'Responsável', 'Status', 'Assunto', 
      'Descrição do Ticket', 'Urgência', 'Tags', 'Cliente (Completo)', 
      'Cliente: CPF / CNPJ (Pessoa)', 'Serviço (Completo)', 'Tipo', 
      'SLA N2 - 1ª Entrada', 'SLA N2 - 1ª Saída', '1° Resposta (Horas Corridas)', 
      'Tempo de vida (Horas corridas)'
    ].join(';');

    const rows = sortedData.map(d => {
      return [
        `"${d.ticketNumber || ''}"`,
        `"${d.origin}"`,
        `"${d.startTimeString || ''}"`,
        `"${d.movedAt || ''}"`,
        `"${d.resolutionDate ? format(d.resolutionDate, 'dd/MM/yyyy') : ''}"`,
        `"${d.team || ''}"`,
        `"${d.createdBy || ''}"`,
        `"${formatAgentName(d.agentName)}"`,
        `"${d.status || ''}"`,
        `"${d.subject || ''}"`,
        `"${d.description || ''}"`,
        `"${d.urgency || ''}"`,
        `"${d.tags || ''}"`,
        `"${d.clientName || ''}"`,
        `"${d.cnpj || ''}"`,
        `"${d.service || ''}"`,
        `"${d.type || ''}"`,
        `"${d.slaN2FirstEntry || ''}"`,
        `"${d.slaN2FirstExit || ''}"`,
        `"${d.firstResponseTime || ''}"`,
        `"${d.totalLifeTime || ''}"`
      ].join(';');
    });
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [head, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `exportacao_tickets_${format(new Date(), 'ddMMyyyy_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const Th = ({ label, colKey, align = "left", extraClass = "" }: { label: string, colKey: keyof CallData, align?: "left" | "center" | "right", extraClass?: string }) => {
    const uniqueValues = allUniqueValues[colKey as string] || [];
    const activeFilters = columnFilters[colKey as string] || [];
    const isFiltered = activeFilters.length > 0;

    return (
      <th 
        className={`p-4 bg-slate-50/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-20 ${extraClass}`}
      >
        <div className="flex items-center justify-between gap-1.5">
          <div 
            className={`flex items-center gap-1.5 cursor-pointer hover:text-indigo-600 transition-colors select-none flex-1 truncate text-${align}`}
            onClick={() => handleSort(colKey)}
          >
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">{label}</span>
            {sortCol === colKey && (
              sortDesc ? <ChevronDown className="h-3 w-3 text-indigo-500 shrink-0" /> : <ChevronUp className="h-3 w-3 text-indigo-500 shrink-0" />
            )}
          </div>
          <div className="relative shrink-0">
             <button 
               onClick={(e) => {
                  e.stopPropagation();
                  setFilterDropdownOpen(filterDropdownOpen === (colKey as string) ? null : (colKey as string));
               }}
               className={`p-1 rounded-md transition-all ${isFiltered ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
             >
               <Filter className="h-3 w-3" />
             </button>
             {filterDropdownOpen === colKey && (
               <TableFilterDropdown 
                 options={uniqueValues}
                 selectedValues={activeFilters}
                 onToggle={(val) => toggleFilterValue(colKey as string, val)}
                 onClose={() => setFilterDropdownOpen(null)}
               />
             )}
          </div>
        </div>
      </th>
    );
  };

  const getStatusBadge = (status: string | undefined) => {
    if (!status) return null;
    const s = status.toLowerCase();
    let config = { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
    
    if (s.includes('resolvido') || s.includes('finalizado') || s === 'answered') {
      config = { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    } else if (s.includes('novo') || s === 'pendente') {
      config = { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
    } else if (s.includes('cancelado') || s === 'abandon') {
      config = { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    } else if (s.includes('atendimento')) {
      config = { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    }

    return (
      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${config.bg} ${config.text} ${config.border} whitespace-nowrap`}>
        {status === 'answered' ? 'Atendida' : status === 'abandon' ? 'Perdida' : status}
      </span>
    );
  };

  const getUrgencyBadge = (urgency: string | undefined) => {
    if (!urgency) return <span className="text-slate-300">-</span>;
    const u = urgency.toLowerCase();
    let color = 'text-slate-500';
    if (u.includes('alta') || u.includes('urgente')) color = 'text-rose-600 font-bold';
    if (u.includes('media')) color = 'text-amber-600 font-bold';
    if (u.includes('baixa')) color = 'text-emerald-600 font-bold';
    
    return <span className={`text-[10px] uppercase tracking-tight ${color}`}>{urgency}</span>;
  };

  const getOriginBadge = (origin: string) => {
    const colors: Record<string, string> = {
      'Movidesk': 'bg-blue-50 text-blue-700 border-blue-100',
      'Chat': 'bg-blue-50 text-blue-700 border-blue-100',
      'GoTo': 'bg-blue-50 text-blue-700 border-blue-100'
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${colors[origin] || 'bg-blue-50 text-blue-700 border-blue-100'}`}>
        {origin}
      </span>
    );
  };

  const formatCellDate = (val: Date | string | undefined) => {
    if (!val) return '-';
    if (val instanceof Date) return format(val, 'dd/MM/yyyy HH:mm');
    return val;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 flex-1 flex flex-col overflow-hidden shadow-sm h-[600px]">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 bg-blue-600 rounded-full" />
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Histórico de Tickets</h2>
          <AnimatePresence>
            {copiedId && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="bg-emerald-500 text-white text-[10px] px-3 py-1 rounded-full font-bold shadow-lg shadow-emerald-200 flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-3 w-3" />
                Ticket {copiedId} Copiado
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button 
          onClick={exportCSV}
          className="bg-blue-600 text-white px-5 py-2 rounded-xl text-[11px] font-bold hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2 tracking-wide uppercase shadow-md shadow-blue-500/20"
        >
          <Download className="h-3.5 w-3.5" />
          Exportar Base (CSV)
        </button>
      </div>
      <div className="overflow-x-auto flex-1 h-full overflow-y-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-20">
            <tr>
              <Th label="Origem" colKey="origin" />
              <Th label="Ticket" colKey="ticketNumber" extraClass="w-[100px] min-w-[100px] max-w-[100px]" />
              <Th label="Aberto em" colKey="startTime" />
              <Th label="Movimentado em" colKey="movedAt" />
              <Th label="Resolvido em" colKey="resolutionDate" />
              <Th label="Responsável: Equipe" colKey="team" />
              <Th label="Criado por" colKey="createdBy" />
              <Th label="Responsável" colKey="agentName" />
              <Th label="Status" colKey="status" />
              <Th label="Assunto" colKey="subject" />
              <Th label="Descrição do Ticket" colKey="description" />
              <Th label="Urgência" colKey="urgency" />
              <Th label="Tags" colKey="tags" />
              <Th label="Cliente (Completo)" colKey="clientName" />
              <Th label="Cliente: CPF / CNPJ (Pessoa)" colKey="cnpj" />
              <Th label="Serviço (Completo)" colKey="service" />
              <Th label="Tipo" colKey="type" />
              <Th label="SLA N2 - 1ª Entrada" colKey="slaN2FirstEntry" />
              <Th label="SLA N2 - 1ª Saída" colKey="slaN2FirstExit" />
              <Th label="1° Resposta (Horas Corridas)" colKey="firstResponseTime" />
              <Th label="Tempo de vida (Horas corridas)" colKey="totalLifeTime" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[11px]">
            {paginatedData.map((call, idx) => {
              const handleCopyTicket = (ticket: string | undefined) => {
                if (!ticket) return;
                navigator.clipboard.writeText(ticket);
                setCopiedId(ticket);
                setTimeout(() => setCopiedId(null), 2000);
              };

              return (
              <tr key={idx} className="group hover:bg-slate-50/80 transition-colors cursor-default">
                <td className="p-4">{getOriginBadge(call.origin)}</td>
                <td className="p-4 w-[100px] min-w-[100px] max-w-[100px]">
                  <div className="flex items-center gap-1.5">
                    {call.ticketNumber ? (
                      <>
                        <div className="bg-blue-50 border border-blue-100 rounded-lg px-2 py-1.5 flex items-center justify-center min-w-[60px]">
                          <a 
                            href={`https://atendimento.movidesk.com/Ticket/Details/${call.ticketNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-700 font-black hover:text-blue-800 transition-colors text-[11px] font-mono"
                          >
                            {call.ticketNumber}
                          </a>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyTicket(call.ticketNumber);
                          }}
                          className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all flex items-center justify-center shadow-sm"
                          title="Copiar Ticket"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </div>
                </td>
                <td className="p-4 font-medium text-slate-600 whitespace-nowrap">
                  {formatCellDate(call.startTime)}
                </td>
                <td className="p-4 text-slate-500 whitespace-nowrap italic">{formatCellDate(call.movedAt)}</td>
                <td className="p-4 font-bold text-slate-700 whitespace-nowrap">
                  {formatCellDate(call.resolutionDate)}
                </td>
                <td className="p-4 text-slate-600 whitespace-nowrap">{call.team || '-'}</td>
                <td className="p-4 text-slate-500 whitespace-nowrap truncate max-w-[120px]" title={call.createdBy}>{call.createdBy || '-'}</td>
                <td className="p-4 font-semibold text-slate-700 whitespace-nowrap">{formatAgentName(call.agentName)}</td>
                <td className="p-4">{getStatusBadge(call.status || call.leftQueueReason)}</td>
                <td className="p-4 text-slate-600 truncate max-w-[200px]" title={call.subject}>{call.subject || '-'}</td>
                <td className="p-4 text-slate-400 truncate max-w-[200px]" title={call.description}>{call.description || '-'}</td>
                <td className="p-4">{getUrgencyBadge(call.urgency)}</td>
                <td className="p-4">
                   <div className="flex flex-wrap gap-1">
                      {call.tags?.split(',').map((tag, tIdx) => (
                        <span key={tIdx} className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase">{tag.trim()}</span>
                      )) || '-'}
                   </div>
                </td>
                <td className="p-4 font-bold text-slate-900 whitespace-nowrap truncate max-w-[200px]" title={call.clientName}>{call.clientName || '-'}</td>
                <td className="p-4 font-mono text-slate-500 tabular-nums">{call.cnpj || '-'}</td>
                <td className="p-4 text-slate-600 truncate max-w-[180px]" title={call.service}>{call.service || '-'}</td>
                <td className="p-4 text-slate-500">{call.type || '-'}</td>
                <td className="p-4 text-slate-600 whitespace-nowrap">{formatCellDate(call.slaN2FirstEntry)}</td>
                <td className="p-4 text-slate-600 whitespace-nowrap">{formatCellDate(call.slaN2FirstExit)}</td>
                <td className="p-4 text-slate-600 font-bold tabular-nums">{call.firstResponseTime || '-'}</td>
                <td className="p-4 text-indigo-700 font-black tabular-nums whitespace-nowrap">{call.totalLifeTime || '-'}</td>
              </tr>
            )})}
          </tbody>
        </table>
        {sortedData.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-xs">
            Nenhuma chamada corresponde aos filtros aplicados.
          </div>
        )}
      </div>

      {/* Pagination UI */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Página {currentPage} de {totalPages} ({sortedData.length} resultados)
          </div>
          <div className="flex items-center gap-1">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="p-2 hover:bg-white rounded-lg border border-slate-200 disabled:opacity-30 transition-all text-slate-600"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1">
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                let pageNum = currentPage;
                if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;
                
                if (pageNum <= 0 || pageNum > totalPages) return null;

                return (
                  <button 
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`h-8 w-8 flex items-center justify-center rounded-lg text-[11px] font-bold transition-all border ${
                      currentPage === pageNum 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20' 
                        : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="p-2 hover:bg-white rounded-lg border border-slate-200 disabled:opacity-30 transition-all text-slate-600"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const AnalysisOfTicketsView = memo(({ data, allUniqueValues }: { data: CallData[], allUniqueValues: Record<string, string[]> }) => {
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const n1Agents = useMemo(() => [...TEAM_MAPPING['Cart. A+B'], ...TEAM_MAPPING['Cart. C+D+E']], []);
  const n2Agents = useMemo(() => TEAM_MAPPING['N2'], []);

  const n1Calls = useMemo(() => data.filter(d => n1Agents.some(ag => d.agentName.includes(ag))), [data, n1Agents]);
  const n2Calls = useMemo(() => data.filter(d => n2Agents.some(ag => d.agentName.includes(ag))), [data, n2Agents]);

  const resN1 = useMemo(() => {
    const answered = n1Calls.filter(d => d._status === 'Resolvido' || d._status === 'Atendida');
    return n1Calls.length > 0 ? Math.round((answered.length / n1Calls.length) * 100) : 0;
  }, [n1Calls]);

  const escRate = useMemo(() => data.length > 0 ? Math.round((n2Calls.length / data.length) * 100) : 0, [data, n2Calls]);
  const avgRespN2 = useMemo(() => n2Calls.length > 0 ? Math.round(n2Calls.reduce((acc, curr) => acc + curr.waitTime, 0) / n2Calls.length) : 0, [n2Calls]);

  const queueData = useMemo(() => {
    const counts = data.reduce((acc, call) => {
      const q = call._team || 'Sem Origem';
      acc[q] = (acc[q] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [data]);

  const statusData = useMemo(() => {
    const counts = data.reduce((acc, call) => {
      const status = call._status;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [data]);

  // New metrics for Column 1 & 2
  const ticketsAnalisados = data.length;
  const uniqueGroups = useMemo(() => {
    const teams = new Set(data.map(d => d._team).filter(Boolean));
    return teams.size;
  }, [data]);

  const subjectsRanking = useMemo(() => {
    if (data.length === 0) return [];
    
    const rawCounts = data.reduce((acc, d) => {
       const s = d.subject || 'Sem assunto';
       acc[s] = (acc[s] || 0) + 1;
       return acc;
    }, {} as Record<string, number>);

    const sortedRaw = Object.entries(rawCounts).sort((a, b) => b[1] - a[1]);
    
    const groups: { name: string, value: number, names: string[] }[] = [];
    
    // Process only top items for grouping to avoid performance death when many unique subjects exist
    // Usually the long tail doesn't need complex grouping
    const processItems = sortedRaw.slice(0, 300);
    const remainingItems = sortedRaw.slice(300);

    processItems.forEach(([name, value]) => {
      let foundGroup = false;
      const nameNorm = name.toLowerCase().replace(/[^\w\s]/gi, '').trim();
      const nameLen = nameNorm.length;
      
      for (const group of groups) {
         const groupNameNorm = group.name.toLowerCase().replace(/[^\w\s]/gi, '').trim();
         const groupLen = groupNameNorm.length;
         
         // Fast normalization check
         if (nameNorm === groupNameNorm || Math.abs(nameLen - groupLen) <= Math.max(nameLen, groupLen) * 0.2) {
           if (isSimilarSubject(name, group.name)) {
             group.value += value;
             group.names.push(name);
             foundGroup = true;
             break;
           }
         }
      }
      if (!foundGroup) {
        groups.push({ name, value, names: [name] });
      }
    });

    // Add remaining items as their own groups without similarity checking
    remainingItems.forEach(([name, value]) => {
      groups.push({ name, value, names: [name] });
    });

    return groups.map(g => ({ 
      name: g.names.length > 1 ? `${g.name} (${g.names.length} variações)` : g.name, 
      primaryName: g.name,
      value: g.value,
      names: g.names,
      percentage: ticketsAnalisados > 0 ? Math.round((g.value / ticketsAnalisados) * 100) : 0
    }))
    .sort((a, b) => b.value - a.value);
  }, [data, ticketsAnalisados]);

  const topSubject = subjectsRanking[0]?.primaryName || '-';
  const topSubjectPerc = subjectsRanking[0]?.percentage ? `${subjectsRanking[0].percentage}%` : '0%';

  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [selectedSubjectNames, setSelectedSubjectNames] = useState<string[]>([]);
  const [selectedSubjectTitle, setSelectedSubjectTitle] = useState<string>('');
  const [isSubjectDetailModalOpen, setIsSubjectDetailModalOpen] = useState(false);

  const handleQueueClick = (queue: string) => {
    setSelectedQueue(queue);
    setIsModalOpen(true);
  };

  const handleSubjectClick = (names: string[], title: string) => {
    setSelectedSubjectNames(names);
    setSelectedSubjectTitle(title);
    setIsSubjectDetailModalOpen(true);
  };

  const filteredTickets = useMemo(() => {
    if (!selectedQueue) return [];
    return data.filter(d => (d._team || 'Sem Origem') === selectedQueue);
  }, [data, selectedQueue]);

  const filteredSubjectTickets = useMemo(() => {
    if (selectedSubjectNames.length === 0) return [];
    return data.filter(d => {
      const s = d.subject || 'Sem assunto';
      return selectedSubjectNames.includes(s);
    });
  }, [data, selectedSubjectNames]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* 1st Row: 4 metrics - Tickets Analisados, Equipes Identificadas, Assunto Principal, Taxa de Resolução */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricBox 
          label="Tickets Analisados" 
          value={ticketsAnalisados.toString()} 
          icon={BarChart2} 
          color="text-blue-600"
          subtitle="Total processado"
          trendValue="Volume Global"
        />
        <MetricBox 
          label="Equipes Identificadas" 
          value={uniqueGroups.toString()} 
          icon={Users} 
          color="text-blue-700"
          subtitle="Equipes únicas"
          trendValue="Classificação"
        />
        <div onClick={() => setIsSubjectModalOpen(true)} className="cursor-pointer">
          <MetricBox 
            label="Assunto Principal" 
            value={topSubject} 
            icon={Search} 
            color="text-orange-600"
            subtitle={`${topSubjectPerc} do volume total`}
            trendValue="Ver Todos"
          />
        </div>
        <MetricBox 
          label="Taxa de Resolução no N1" 
          value={`${resN1}%`} 
          icon={CheckCircle2} 
          color="text-emerald-600"
          subtitle="Primeiro contato"
          trendValue="Eficiente"
        />
      </div>

      <SubjectsRankingModal 
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        subjects={subjectsRanking}
        onSubjectClick={handleSubjectClick}
      />

      {/* Main Analysis Layout */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Top-Left: Distribuição por Fila */}
          <div className="lg:col-span-3">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[424px]">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <ListTree className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Distribuição por Fila</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Volume de chamados por setor</p>
                </div>
              </div>
              <div className="flex-1 h-0 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={queueData.slice(0, 8)} onClick={(data) => data && data.activePayload && handleQueueClick(data.activeLabel)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={40} className="cursor-pointer hover:opacity-80 transition-opacity" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[9px] text-center font-bold text-slate-400 uppercase mt-4">Dica: Clique nas barras para ver os detalhes da fila</p>
            </div>
          </div>

          {/* Top-Right: Key Metrics */}
          <div className="flex flex-col gap-6">
            <MetricBox 
              label="Volume de Escalonamento" 
              value={`${escRate}%`} 
              icon={TrendingUp} 
              color="text-amber-600"
              subtitle="N1 para N2"
              trendValue="Sob controle"
            />
            <MetricBox 
              label="Tempo de Resposta N2" 
              value={formatToHMM(avgRespN2)} 
              icon={Timer} 
              color="text-indigo-600"
              subtitle="Média de espera"
              trendValue="Estável"
            />
          </div>
        </div>

        {/* Bottom Partition: Performance and Recurrence Rankings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RankingPerformance data={data} />
          <RankingDeRecorrencia data={data} ticketsAnalisados={ticketsAnalisados} onViewDetail={handleQueueClick} />
        </div>
      </div>


      {/* Modal de Detalhes dos Tickets (Queues) */}
      <TicketDetailsModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        queueName={selectedQueue || ''} 
        tickets={filteredTickets} 
        allUniqueValues={allUniqueValues}
      />

      {/* Modal de Detalhes dos Tickets (Subject) */}
      <TicketDetailsModal 
        isOpen={isSubjectDetailModalOpen} 
        onClose={() => setIsSubjectDetailModalOpen(false)} 
        queueName={selectedSubjectTitle} 
        tickets={filteredSubjectTickets} 
        allUniqueValues={allUniqueValues}
      />


      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <DataTable data={data} allUniqueValues={allUniqueValues} />
      </div>
    </div>
  );
});

function RankingDeRecorrencia({ data, ticketsAnalisados, onViewDetail }: { data: CallData[], ticketsAnalisados: number, onViewDetail: (queue: string) => void }) {
  const ranking = useMemo(() => {
    // 1. Group data by Team/Queue using pre-calculated _team
    const teamGroups = data.reduce((acc, call) => {
      const q = call._team || 'Sem Origem';
      if (!acc[q]) acc[q] = [];
      acc[q].push(call);
      return acc;
    }, {} as Record<string, CallData[]>);

    // 2. For each team, count tickets that have a recurrent subject (subject appears > 1 time)
    return Object.entries(teamGroups).map(([name, teamTickets]) => {
      const subjectCounts = teamTickets.reduce((acc, call) => {
        const s = call.subject || 'Sem assunto';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const recurrentTicketsCount = Object.values(subjectCounts).reduce((sum, count) => {
        return sum + (count > 1 ? count : 0);
      }, 0);

      const percentage = ticketsAnalisados > 0 ? Math.round((recurrentTicketsCount / ticketsAnalisados) * 100) : 0;
      
      return { 
        name, 
        value: recurrentTicketsCount, 
        percentage 
      };
    })
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
  }, [data, ticketsAnalisados]);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[480px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">RANKING DE RECORRÊNCIA</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">DISTRIBUIÇÃO DE VOLUME POR CATEGORIA</p>
        </div>
        <button 
          onClick={() => onViewDetail(ranking[0]?.name || '')}
          className="flex items-center gap-2 px-6 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all group"
        >
          <TrendingUp className="h-3 w-3 group-hover:scale-110 transition-transform" />
          VER TICKETS
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-8 scrollbar-thin scrollbar-thumb-slate-200">
        {ranking.map((item, idx) => (
          <div key={idx} className="group cursor-pointer" onClick={() => onViewDetail(item.name)}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-slate-700 tracking-tight">{item.name}</span>
                <span className="px-2 py-0.5 bg-slate-50 border border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-widest rounded-md">Automático</span>
              </div>
              <div className="flex items-center gap-8">
                <div className="flex flex-col items-end">
                   <span className="text-sm font-black text-slate-800 leading-none">{item.value}</span>
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Tickets</span>
                </div>
                <span className="text-sm font-black text-indigo-600 min-w-[40px] text-right">{item.percentage}%</span>
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
              </div>
            </div>
            <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${item.percentage}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: idx * 0.1 }}
                className="h-full bg-indigo-500 rounded-full"
              />
            </div>
          </div>
        ))}
        {ranking.length === 0 && (
          <div className="h-full flex items-center justify-center text-slate-400 text-[10px] font-black uppercase">
            Nenhum dado de recorrência identificado
          </div>
        )}
      </div>
    </div>
  );
}

function RankingPerformance({ data }: { data: CallData[] }) {
  const [activeTab, setActiveTab] = useState<'score' | 'tickets'>('tickets');
  
  const rankings = useMemo(() => {
    const agentStats = data.reduce((acc, call) => {
      const rawName = call.agentName || 'Não atribuído';
      const name = formatAgentName(rawName);
      if (!acc[name]) acc[name] = { tickets: 0, totalSeconds: 0 };
      acc[name].tickets += 1;
      
      const durationStr = call.totalLifeTime || '';
      const days = parseInt((durationStr.match(/(\d+)d/) || ['0', '0'])[1]);
      const hours = parseInt((durationStr.match(/(\d+)h/) || ['0', '0'])[1]);
      const minutes = parseInt((durationStr.match(/(\d+)min/) || (durationStr.match(/(\d+)m/) || ['0', '0']))[1]);
      
      acc[name].totalSeconds += (days * 86400) + (hours * 3600) + (minutes * 60);
      
      return acc;
    }, {} as Record<string, { tickets: number, totalSeconds: number }>);

    return Object.entries(agentStats).map(([name, stats]) => {
      const avgSeconds = stats.tickets > 0 ? stats.totalSeconds / stats.tickets : 0;
      const avgHours = avgSeconds / 3600;
      // Score calculation - slightly arbitrary to look like the image scores
      const ticketsWeight = stats.tickets * 0.05;
      const timeFactor = avgHours > 0 ? Math.min(5, 48 / (avgHours + 1)) : 5;
      const score = Math.min(10, parseFloat((ticketsWeight + timeFactor).toFixed(2)));
      
      return {
        name,
        tickets: stats.tickets,
        avgSeconds,
        score
      };
    })
    .sort((a, b) => activeTab === 'score' ? b.score - a.score : b.tickets - a.tickets)
    .slice(0, 7);
  }, [data, activeTab]);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[480px] overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-50 text-orange-500 rounded-xl transition-transform hover:scale-105 duration-300">
             <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none mb-0.5">Ranking de Performance</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Metas semanais</p>
          </div>
        </div>
        <div className="px-2.5 py-1 bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest rounded-lg border border-slate-100/50">
          TOP 7
        </div>
      </div>

      <div className="flex bg-slate-100/50 p-1 rounded-xl mb-6 border border-slate-200/50">
        <button 
          onClick={() => setActiveTab('score')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'score' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/60 ring-1 ring-slate-100/10' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Activity className="h-3 w-3" />
          Por Score
        </button>
        <button 
          onClick={() => setActiveTab('tickets')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'tickets' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/60 ring-1 ring-slate-100/10' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Hash className="h-3 w-3" />
          Por Tickets
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 pr-1">
        <table className="w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <th className="text-left px-2 pb-1">Técnico</th>
              <th className="text-center pb-1">Tickets</th>
              <th className="text-center pb-1">Média</th>
              <th className="text-right px-2 pb-1">
                <div className="flex items-center justify-end gap-1">
                  Score <Info className="h-3 w-3 opacity-30" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((item, idx) => {
               const h = Math.floor(item.avgSeconds / 3600);
               const m = Math.floor((item.avgSeconds % 3600) / 60);
               
               return (
                <tr key={idx} className="group transition-all duration-300">
                  <td className="py-2.5 px-2 bg-white group-hover:bg-slate-50/50 rounded-l-xl border-y border-l border-slate-100/50 group-hover:border-blue-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black shadow-sm shrink-0 ${
                        idx === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-orange-200' : 
                        idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-slate-100' : 
                        idx === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-amber-100' : 
                        'bg-slate-50 text-slate-400 border border-slate-100'
                      }`}>
                        {idx + 1}
                      </div>
                      <span className="text-xs font-bold text-slate-700 tracking-tight group-hover:text-blue-700 transition-colors truncate max-w-[110px]">
                        {item.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 text-center bg-white group-hover:bg-slate-50/50 border-y border-slate-100/50 group-hover:border-blue-100 transition-colors">
                    <span className="text-xs font-black text-blue-600 tabular-nums">{item.tickets}</span>
                  </td>
                  <td className="py-2.5 text-center bg-white group-hover:bg-slate-50/50 border-y border-slate-100/50 group-hover:border-blue-100 transition-colors">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-black text-slate-600 tabular-nums text-nowrap">
                        {h > 0 ? `${h}h ` : ''}{m}min
                      </span>
                      <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-1000 ${h >= 48 ? 'bg-red-500' : h >= 24 ? 'bg-orange-400' : 'bg-emerald-400'}`} 
                          style={{ width: `${Math.min(100, (item.avgSeconds / (48 * 3600)) * 100)}%` }} 
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-right bg-white group-hover:bg-slate-50/50 rounded-r-xl border-y border-r border-slate-100/50 group-hover:border-blue-100 transition-colors">
                    <div className="flex flex-col items-end">
                      <div className={`px-2 py-0.5 rounded-md text-[11px] font-black transition-colors ${
                        item.score >= 8 ? 'bg-emerald-50 text-emerald-600' :
                        item.score >= 5 ? 'bg-blue-50 text-blue-600' :
                        'bg-slate-50 text-slate-500'
                      }`}>
                        {item.score.toFixed(2)}
                      </div>
                      <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest mt-0.5">Score</span>
                    </div>
                  </td>
                </tr>
               )
            })}
          </tbody>
        </table>
        {rankings.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2 py-10">
            <Activity className="h-8 w-8 opacity-20" />
            <span className="text-[10px] font-black uppercase tracking-widest">Sem dados no período</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SubjectsRankingModal({ isOpen, onClose, subjects, onSubjectClick }: { isOpen: boolean, onClose: () => void, subjects: { name: string, primaryName: string, value: number, percentage: number, names: string[] }[], onSubjectClick: (names: string[], primaryName: string) => void }) {
  const [searchTerm, setSearchTerm] = useState('');

  // Clear search on open/close
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const filteredSubjects = useMemo(() => {
    if (!searchTerm) return subjects;
    const lower = searchTerm.toLowerCase();
    return subjects.filter(sub => 
      sub.name.toLowerCase().includes(lower) || 
      sub.names.some(n => n.toLowerCase().includes(lower))
    );
  }, [subjects, searchTerm]);

  const totalFilteredTickets = useMemo(() => {
    return filteredSubjects.reduce((acc, sub) => acc + sub.value, 0);
  }, [filteredSubjects]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-600 rounded-2xl shadow-lg shadow-orange-100">
                  <Search className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Ranking de Assuntos</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Distribuição total por assunto do ticket (Agrupados por semelhança)</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl transition-all">
                <X className="h-6 w-6 text-slate-400" />
              </button>
            </div>
            
            <div className="px-6 pt-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar assunto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-24 py-2.5 bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all placeholder:text-slate-400"
                  />
                  {searchTerm && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                      {totalFilteredTickets} tickets
                    </div>
                  )}
                </div>
                {searchTerm && filteredSubjects.length > 0 && (
                  <button
                    onClick={() => onSubjectClick(filteredSubjects.flatMap(s => s.names), `Resultados da busca: ${searchTerm}`)}
                    className="shrink-0 px-4 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-sm uppercase tracking-wide"
                  >
                    Ver Todos
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6 pt-4 space-y-4">
              {filteredSubjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <Search className="h-8 w-8 mb-3 opacity-20" />
                  <p className="text-sm font-medium">Nenhum assunto encontrado para "{searchTerm}"</p>
                </div>
              ) : (
                filteredSubjects.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="space-y-2 p-3 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all cursor-pointer group"
                    onClick={() => onSubjectClick(item.names, item.primaryName)}
                  >
                    <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                      <div className="flex flex-col truncate pr-4">
                        <span className="truncate group-hover:text-orange-600 transition-colors uppercase">{item.name}</span>
                        {item.names.length > 1 && (
                          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5 block truncate">
                            Variações: {item.names.slice(1, 4).join(' | ')}{item.names.length > 4 ? '...' : ''}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0">{item.value} tickets ({item.percentage}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${item.percentage}%` }}
                        className="h-full bg-orange-500 rounded-full"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button 
                onClick={onClose}
                className="px-8 py-3 bg-slate-800 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-slate-900 transition-all shadow-xl shadow-slate-200"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function TicketDetailsModal({ isOpen, onClose, queueName, tickets, allUniqueValues }: { isOpen: boolean, onClose: () => void, queueName: string, tickets: CallData[], allUniqueValues: Record<string, string[]> }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100">
                  <ListTree className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">{queueName}</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Listagem de {tickets.length} tickets identificados</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl transition-all">
                <X className="h-6 w-6 text-slate-400" />
              </button>
            </div>

            {/* Content Table using DataTable Component */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <DataTable data={tickets} allUniqueValues={allUniqueValues} />
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between px-6">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtros ativos aplicados na listagem</p>
              </div>
              <button 
                onClick={onClose}
                className="px-8 py-2 bg-slate-800 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-slate-900 transition-all shadow-xl shadow-slate-200"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}


