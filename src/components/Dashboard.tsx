import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  ArrowUpDown, Search, Filter, Calendar as CalendarIcon, ChevronDown, Check, X,
  CheckCircle2, Timer, TrendingUp, Thermometer, Maximize2, Copy, ChevronLeft, ChevronRight, BarChart2, ListTree
} from 'lucide-react';

interface DashboardProps {
  data: CallData[];
  view?: 'atendimentos' | 'chamados';
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

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
  if (val >= 1201 && val <= 1800) return 'text-purple-600 font-bold'; // PURPLE (EXCESSIVO)
  if (val >= 1801) return 'text-red-600 font-bold'; // RED (CRITICAL)
  return 'text-slate-600';
};

const getTotalTalkTimeColor = (val: number) => {
  if (val <= 0) return 'text-slate-400';
  if (val >= 1 && val <= 14400) return 'text-rose-600 font-bold'; // RED (SUPERFICIAL)
  if (val >= 14401 && val <= 28800) return 'text-emerald-600 font-bold'; // GREEN (EFICIENTE)
  if (val >= 28801 && val <= 43200) return 'text-amber-500 font-bold'; // YELLOW (MODERADO)
  if (val >= 43201 && val <= 64800) return 'text-orange-500 font-bold'; // ORANGE (PROLONGADO)
  if (val >= 64801 && val <= 90000) return 'text-purple-600 font-bold'; // PURPLE (EXCESSIVO)
  if (val >= 90001) return 'text-red-600 font-bold'; // RED (CRITICAL)
  return 'text-slate-600';
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
  { label: 'EXCESSIVO', range: '20:01 - 30:00', color: 'bg-purple-500', desc: 'Muito longo' },
  { label: 'CRÍTICO', range: '≥ 30:01', color: 'bg-red-600', desc: 'Crítico' },
];

const TOTAL_TALK_METRICS: MetricStep[] = [
  { label: 'SUPERFICIAL', range: '0 - 4h', color: 'bg-rose-500' },
  { label: 'EFICIENTE', range: '4 - 8h', color: 'bg-emerald-500' },
  { label: 'MODERADO', range: '8 - 12h', color: 'bg-amber-500' },
  { label: 'PROLONGADO', range: '12 - 18h', color: 'bg-orange-500' },
  { label: 'EXCESSIVO', range: '18 - 25h', color: 'bg-purple-500' },
  { label: 'CRÍTICO', range: '≥ 25:01h', color: 'bg-red-600' },
];

const CustomTooltip = ({ title, items, children }: { title: string; items: MetricStep[]; children: React.ReactNode }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  return (
    <div className="relative inline-block" onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)} onClick={() => setIsVisible(!isVisible)}>
      {children}
      {isVisible && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-0 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 pointer-events-none animate-in fade-in zoom-in duration-200 origin-bottom">
           <div className="p-3 border-b border-slate-100 dark:border-slate-800">
             <h4 className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-wider text-center">{title}</h4>
           </div>
           <div className="p-2 space-y-1">
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
           <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-200 dark:border-t-slate-800" />
           <div className="absolute top-full left-1/2 -translate-x-1/2 mt-[-1px] border-[6px] border-transparent border-t-white dark:border-t-slate-900" />
        </div>
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
  
  // Unification requested by user
  if (lower.includes('tamara marques') || lower.includes('tamara costa')) return 'Tamara Costa';
  if (lower.includes('rosilene siqueira') || lower === 'rosilene') return 'Rosilene';
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
  'Cart. A+B': ['Rodrigo', 'Kerlaine', 'Giane', 'Tamara Costa', 'Vinicius', 'Johnny Silva', 'Brener'],
  'Cart. C+D+E': ['Johnny Viriato', 'Julia', 'Andrezza', 'Maria Luiza', 'Thiago', 'Nilton', 'Illana', 'Marcelo Bezerra', 'Rosilene', 'Wallace Evangelista', 'Victor Oliveira'],
  'N2': ['Gutemberg', 'Wesley Rodrigues', 'Paulo', 'Marcelo Freitas', 'Nathan']
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

export function Dashboard({ data: rawData, view = 'atendimentos' }: DashboardProps) {
  // Normalize data first to ensure exact same grouping everywhere between Chat and GoTo.
  const data = useMemo(() => {
    return rawData.map(d => ({
      ...d,
      agentName: formatAgentName(d.agentName)
    }));
  }, [rawData]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('Todos');
  const [selectedSchedule, setSelectedSchedule] = useState('Todos');
  const [originFilter, setOriginFilter] = useState<'All' | 'Chat' | 'GoTo'>('All');
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

  useEffect(() => {
    if (data.length > 0) {
      const dates = data.map(d => d.startTime.getTime()).filter(t => !isNaN(t));
      if (dates.length > 0) {
        const min = new Date(Math.min(...dates));
        const max = new Date(Math.max(...dates));
        setDateRange({
          from: startOfDay(min),
          to: endOfDay(max)
        });
      }
    }
  }, [data]);

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
    return data.filter(d => {
      const isVerySpecific = searchTerm.length >= 8 && /^\d+$/.test(searchTerm);
      
      const matchSearch = d.callerNumber.includes(searchTerm) || 
                          d.queue.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          d.agentName.toLowerCase().includes(searchTerm.toLowerCase());
      
      // If search is active, don't restrict by agent unless the search term is very short
      // This allows seeing all interactions of a specific client number.
      let matchAgent = selectedAgents.length === 0 || selectedAgents.includes(d.agentName);
      if (searchTerm.length >= 4 && d.callerNumber.includes(searchTerm)) {
        matchAgent = true;
      }
      
      // "Ligações Perdidas" should always appear by default unless a very specific search (not matching this call) is active
      if (d.agentName === 'Ligações Perdidas' && !isVerySpecific) {
        matchAgent = true;
      }
      
      // Strict Team/Queue filtering (User Request)
      let matchTeamStrict = true;
      if (selectedTeam !== 'Todos') {
        const callTeam = getTeamForCall(d);
        if (selectedTeam === 'N1') {
          matchTeamStrict = (callTeam === 'Cart. A+B' || callTeam === 'Cart. C+D+E' || callTeam === 'N1');
        } else {
          matchTeamStrict = (callTeam === selectedTeam);
        }
      }

      const matchOrigin = originFilter === 'All' || d.origin === originFilter;
      
      let matchSchedule = true;
      if (selectedSchedule !== 'Todos') {
        matchSchedule = getCallSchedule(d.startTime, d.queue) === selectedSchedule;
      }
      
      let matchDate = true;
      if (dateRange?.from && !isNaN(d.startTime.getTime())) {
        const dStart = startOfDay(dateRange.from);
        const dEnd = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        matchDate = d.startTime >= dStart && d.startTime <= dEnd;
      }

      return matchSearch && matchAgent && matchTeamStrict && matchOrigin && matchDate && matchSchedule;
    });
  }, [data, searchTerm, selectedAgents, selectedSchedule, originFilter, dateRange]);

  const handleTeamChange = (team: string) => {
    setSelectedTeam(team);
    if (team === 'Todos') {
      setSelectedAgents([]);
    } else {
      let members: string[] = [];
      if (team === 'N1') {
        members = [...TEAM_MAPPING['Cart. A+B'], ...TEAM_MAPPING['Cart. C+D+E']];
      } else {
        members = TEAM_MAPPING[team] || [];
      }
      
      // Filter uniqueAgents to find any that match the team member names (by prefix or exact)
      const matchedFullNames = uniqueAgents.filter(ag => 
        members.some(m => ag.toLowerCase().includes(m.toLowerCase()))
      );
      
      setSelectedAgents(matchedFullNames);
    }
    setIsTeamOpen(false);
  };

  const toggleAgent = (ag: string) => {
    setSelectedAgents(prev => 
      prev.includes(ag) ? prev.filter(a => a !== ag) : [...prev, ag]
    );
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedAgents([]);
    setSelectedTeam('Todos');
    setSelectedSchedule('Todos');
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

    const n1Agents = [...TEAM_MAPPING['Cart. A+B'], ...TEAM_MAPPING['Cart. C+D+E']];
    const n2Agents = TEAM_MAPPING['N2'];

    const metricsData = useMemo(() => {
      const n1Calls = filteredData.filter(d => n1Agents.some(ag => d.agentName.includes(ag)));
      const n2Calls = filteredData.filter(d => n2Agents.some(ag => d.agentName.includes(ag)));

      const n1Answered = n1Calls.filter(d => d.leftQueueReason === 'answered');
      const n1Total = n1Calls.length;
      const resolutionN1 = n1Total > 0 ? Math.round((n1Answered.length / n1Total) * 100) : 0;

      const escalationRate = filteredData.length > 0 ? Math.round((n2Calls.length / filteredData.length) * 100) : 0;

      const avgResponseN2 = n2Calls.length > 0 ? Math.round(n2Calls.reduce((acc, curr) => acc + curr.waitTime, 0) / n2Calls.length) : 0;

      return { resolutionN1, escalationRate, avgResponseN2 };
    }, [filteredData]);

    // Consolidate filter for components down below
    const filteredDataWithoutDate = useMemo(() => {
      return data.filter(d => {
        const isVerySpecific = searchTerm.length >= 8 && /^\d+$/.test(searchTerm);
        
        const matchSearch = d.callerNumber.includes(searchTerm) || 
                            d.queue.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            d.agentName.toLowerCase().includes(searchTerm.toLowerCase());
        
        let matchAgent = selectedAgents.length === 0 || selectedAgents.includes(d.agentName);
        if (searchTerm.length >= 4 && d.callerNumber.includes(searchTerm)) {
          matchAgent = true;
        }
        
        if (d.agentName === 'Ligações Perdidas' && !isVerySpecific) {
          matchAgent = true;
        }
        
        let matchTeamStrict = true;
        if (selectedTeam !== 'Todos') {
          const callTeam = getTeamForCall(d);
          if (selectedTeam === 'N1') {
            matchTeamStrict = (callTeam === 'Cart. A+B' || callTeam === 'Cart. C+D+E' || callTeam === 'N1');
          } else {
            matchTeamStrict = (callTeam === selectedTeam);
          }
        }

        const matchSchedule = selectedSchedule === 'Todos' || getCallSchedule(d.startTime, d.queue) === selectedSchedule;
        
        return matchSearch && matchAgent && matchTeamStrict && matchSchedule;
      });
    }, [data, selectedTeam, selectedSchedule, searchTerm, selectedAgents]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8 font-sans transition-all duration-500">
      <div className="max-w-[1600px] mx-auto space-y-8">
      <div className="relative z-[60] flex flex-wrap items-center gap-1 w-full">
        <div className="flex bg-slate-100 rounded-md p-1 border border-slate-200 items-center">
          <Search className="h-4 w-4 text-slate-400 ml-2 shrink-0" />
          <input
            type="text"
            placeholder="Buscar..."
            className="bg-transparent text-[11px] px-2 focus:outline-none w-24 sm:w-40 border-r border-slate-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Filter className="h-4 w-4 text-slate-400 ml-2 shrink-0" />
          
          <div className="relative flex items-center border-r border-slate-200" ref={scheduleRef}>
            <button
              onClick={() => setIsScheduleOpen(!isScheduleOpen)}
              className="bg-transparent text-[10px] px-2 focus:outline-none min-w-[80px] sm:min-w-[100px] flex justify-between items-center h-full hover:text-indigo-600"
            >
              <span className="truncate max-w-[60px] sm:max-w-[80px]">
                {selectedSchedule === 'Todos' ? "Horário" : selectedSchedule}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400 ml-1" />
            </button>
            {isScheduleOpen && (
              <div className="absolute top-full mt-2 left-0 w-56 bg-white border border-slate-200 shadow-xl rounded-lg z-50 flex flex-col py-1">
                {SERVICE_SCHEDULES.map(sch => (
                  <button 
                    key={sch} 
                    onClick={() => { setSelectedSchedule(sch); setIsScheduleOpen(false); }}
                    className={`text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center ${selectedSchedule === sch ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'}`}
                  >
                    <div className="w-4 mr-2 flex justify-center">{selectedSchedule === sch && <Check className="h-3 w-3" />}</div>
                    {sch === 'Todos' ? "Horário Atendimento" : sch}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative flex items-center border-r border-slate-200" ref={teamRef}>
            <button
              onClick={() => setIsTeamOpen(!isTeamOpen)}
              className="bg-transparent text-[10px] px-2 focus:outline-none min-w-[80px] sm:min-w-[100px] flex justify-between items-center h-full hover:text-indigo-600"
            >
              <span className="truncate max-w-[60px] sm:max-w-[80px]">
                {selectedTeam === 'Todos' ? "Equipes" : selectedTeam}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400 ml-1" />
            </button>
            {isTeamOpen && (
              <div className="absolute top-full mt-2 left-0 w-48 bg-white border border-slate-200 shadow-xl rounded-lg z-50 flex flex-col py-1">
                {ALL_TEAMS.map(team => (
                  <button 
                    key={team} 
                    onClick={() => handleTeamChange(team)}
                    className={`text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center ${selectedTeam === team ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'}`}
                  >
                    <div className="w-4 mr-2 flex justify-center">{selectedTeam === team && <Check className="h-3 w-3" />}</div>
                    {team === 'Todos' ? "Todas Equipes" : team}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative flex items-center" ref={agentRef}>
            <button
              onClick={() => setIsAgentOpen(!isAgentOpen)}
              className="bg-transparent text-[10px] px-2 focus:outline-none min-w-[100px] sm:min-w-[120px] flex justify-between items-center h-full hover:text-indigo-600"
            >
              <span className="truncate max-w-[80px] sm:max-w-[100px]">
                {selectedAgents.length === 0 
                  ? "Operadores" 
                  : `${selectedAgents.length} sel.`}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400 ml-1" />
            </button>
            {isAgentOpen && (
              <div className="absolute top-full mt-2 right-0 w-64 bg-white border border-slate-200 shadow-xl rounded-lg z-50 max-h-64 overflow-y-auto overflow-x-hidden flex flex-col py-1">
                <button 
                  onClick={() => setSelectedAgents([])}
                  className={`text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center ${selectedAgents.length === 0 ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'}`}
                >
                  <div className="w-4 mr-2 flex justify-center">{selectedAgents.length === 0 && <Check className="h-3 w-3" />}</div>
                  Todos Operadores
                </button>
                {uniqueAgents.map(ag => (
                  <button 
                    key={ag} 
                    onClick={() => toggleAgent(ag)}
                    className={`text-left px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center ${selectedAgents.includes(ag) ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'}`}
                  >
                    <div className="w-4 mr-2 shrink-0 flex justify-center">{selectedAgents.includes(ag) && <Check className="h-3 w-3" />}</div>
                    <span className="truncate">{ag}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="relative shrink-0" ref={calendarRef}>
          <button 
            type="button"
            className="flex bg-slate-100 rounded-md p-2 border border-slate-200 items-center hover:bg-slate-200 transition-colors h-[38px]"
            onClick={() => setIsCalendarOpen(!isCalendarOpen)}
          >
            <CalendarIcon className="h-4 w-4 text-slate-500 mr-2 shrink-0" />
            <span className="text-[10px] font-semibold text-slate-700 whitespace-nowrap">
              {dateRange?.from ? (
                dateRange.to && dateRange.from.getTime() !== dateRange.to.getTime()
                  ? `${format(dateRange.from, 'dd/MM/yy')} - ${format(dateRange.to, 'dd/MM/yy')}`
                  : format(dateRange.from, 'dd/MM/yyyy')
              ) : (
                "Selecionar data"
              )}
            </span>
          </button>
          
          {isCalendarOpen && (
            <div className="absolute top-full mt-2 left-0 z-50 bg-white border border-slate-200 shadow-xl rounded-lg p-3">
              <DayPicker
                mode="range"
                locale={ptBR}
                selected={dateRange}
                onSelect={(range) => {
                  setDateRange(range);
                }}
                className="text-xs"
                styles={{
                  cell: { padding: '2px' },
                  day: { width: '32px', height: '32px', fontSize: '12px' }
                }}
              />
            </div>
          )}
        </div>

        <button
          onClick={handleClearFilters}
          className="flex items-center gap-1.5 bg-white text-slate-600 px-3 h-[38px] rounded-md border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors shrink-0 text-[10px] sm:text-xs font-medium whitespace-nowrap"
          title="Remover todos os filtros"
        >
          <X className="h-3.5 w-3.5 text-slate-400" />
          Limpar Filtros
        </button>

        <div className="flex bg-slate-100 rounded-md p-1 border border-slate-200 shrink-0 ml-auto h-[38px] items-center">
          <button
            onClick={() => setOriginFilter('All')}
            className={`px-2 sm:px-3 py-1 text-[9px] sm:text-[10px] uppercase font-bold rounded-md transition-all h-full ${originFilter === 'All' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Todos
          </button>
          <button
            onClick={() => setOriginFilter('Chat')}
            className={`px-2 sm:px-3 py-1 text-[9px] sm:text-[10px] uppercase font-bold rounded-md transition-all h-full ${originFilter === 'Chat' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Chat
          </button>
          <button
            onClick={() => setOriginFilter('GoTo')}
            className={`px-2 sm:px-3 py-1 text-[9px] sm:text-[10px] uppercase font-bold rounded-md transition-all h-full ${originFilter === 'GoTo' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            GoTo
          </button>
        </div>
      </div>

      {view === 'atendimentos' ? (
        <>
          <MetricsCards data={filteredData} />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 shrink-0">
            <ChartCallsOverTime data={filteredData} />
            <ChartAgentPerformance data={filteredData} />
          </div>

          <div className="shrink-0 flex flex-col gap-6">
            <AgentPerformanceSummary data={filteredData} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0 mt-2">
            <div className="lg:col-span-1 h-full">
              <ProductivityCalendar data={filteredDataWithoutDate} />
            </div>
            
            <div className="lg:col-span-1 flex flex-col gap-6">
              <MetricBox 
                label="Taxa de Resolução no N1" 
                value={`${metricsData.resolutionN1}%`} 
                icon={CheckCircle2} 
                color="text-emerald-600"
                subtitle="Primeiro contato"
                trend="up"
                trendValue="Eficiente"
              />
              <AdvancedRecurrenceIndex data={filteredData} />
            </div>

            <div className="lg:col-span-1 flex flex-col gap-6">
              <MetricBox 
                label="Volume de Escalonamento" 
                value={`${metricsData.escalationRate}%`} 
                icon={TrendingUp} 
                color="text-amber-600"
                subtitle="N1 para N2"
                trend="down"
                trendValue="Sob controle"
              />
              <MetricBox 
                label="Tempo de Resposta N2" 
                value={formatToHMM(metricsData.avgResponseN2)} 
                icon={Timer} 
                color="text-indigo-600"
                subtitle="Média de espera"
                trend="neutral"
                trendValue="Estável"
              />
            </div>
          </div>

          <div className="shrink-0">
            <RecurringAgentsCard 
              data={filteredData} 
              onFilter={(num) => setSearchTerm(prev => prev === num ? '' : num)} 
              activeFilter={searchTerm}
            />
          </div>

          <DataTable data={filteredData} />
        </>
      ) : (
        <AnalysisOfTicketsView data={filteredData} />
      )}
    </div>
  </div>
);
}

function MetricBox({ 
  label, 
  value, 
  icon: Icon, 
  color, 
  subtitle,
  trendValue
}: { 
  label: string, 
  value: string, 
  icon: any, 
  color: string,
  subtitle?: string,
  trend?: 'up' | 'down' | 'neutral',
  trendValue?: string
}) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between h-[200px] group transition-all duration-300 hover:shadow-indigo-500/10">
      {/* Abstract pattern background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
         <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
         <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl -ml-24 -mb-24" />
      </div>

      <div className="relative z-10 flex items-center justify-between">
         <div className="flex items-center gap-3">
            <div className={`p-2.5 bg-slate-50 rounded-xl ${color} border border-slate-100 group-hover:scale-110 transition-transform`}>
               <Icon className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{label}</h4>
              <p className="text-[8px] text-slate-500 uppercase font-black mt-1">Live updates</p>
            </div>
         </div>
         {trendValue && (
           <div className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border border-indigo-500/10">
             {trendValue}
           </div>
         )}
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center flex-1 my-2">
          <span className="text-5xl font-black text-slate-900 tracking-tighter leading-none group-hover:scale-105 transition-transform duration-500">{value}</span>
          <div className="h-1 w-12 bg-indigo-500 rounded-full mt-3 opacity-50" />
      </div>

      <div className="relative z-10 flex items-end justify-between pt-3 border-t border-slate-100">
        <div className="flex flex-col">
           <span className="text-[10px] font-black text-slate-900">{subtitle || 'Métrica'}</span>
           <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest leading-none">Status Atual</span>
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

function MetricsCards({ data }: { data: CallData[] }) {
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
    if (localAgent === 'Todos') return data;
    return data.filter(d => d.agentName === localAgent);
  }, [data, localAgent]);

  const abandonedCalls = cardsData.filter(d => d.leftQueueReason === 'abandon');
  const lostLongWait = abandonedCalls.filter(d => d.waitTime > 60);
  const lostShortWait = abandonedCalls.filter(d => d.waitTime <= 60);
  
  const pendenteCalls = cardsData.filter(d => d.leftQueueReason === 'pendente');
  const answeredCalls = cardsData.filter(d => d.leftQueueReason === 'answered');

  const totalCalls = cardsData.length;
  const abandonRate = totalCalls > 0 ? Math.round((abandonedCalls.length / totalCalls) * 100) : 0;
  const longWaitRate = totalCalls > 0 ? (lostLongWait.length / totalCalls) * 100 : 0;
  const shortWaitRate = totalCalls > 0 ? (lostShortWait.length / totalCalls) * 100 : 0;
  
  const longWaitPerc = abandonedCalls.length > 0 ? Math.round((lostLongWait.length / abandonedCalls.length) * 100) : 0;
  const shortWaitPerc = abandonedCalls.length > 0 ? Math.round((lostShortWait.length / abandonedCalls.length) * 100) : 0;

  const pendenteRate = totalCalls > 0 ? Math.round((pendenteCalls.length / totalCalls) * 100) : 0;
  const answeredRate = totalCalls > 0 ? Math.round((answeredCalls.length / totalCalls) * 100) : 0;

  const totalTalkTime = cardsData.reduce((acc, curr) => acc + curr.talkDuration, 0);
  const avgTalkTime = answeredCalls.length > 0 
    ? Math.round(totalTalkTime / answeredCalls.length)
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
      if (val >= 1201 && val <= 1800) return { label: 'EXCESSIVO', color: '#A855F7', tailwind: 'text-purple-600 bg-purple-50 border-purple-100' };
      if (val >= 1801) return { label: 'CRÍTICO', color: '#DC2626', tailwind: 'text-red-700 bg-red-100 border-red-200' };
    } else {
      if (val >= 1 && val <= 14400) return { label: 'SUPERFICIAL', color: '#EF4444', tailwind: 'text-rose-600 bg-rose-50 border-rose-100' };
      if (val >= 14401 && val <= 28800) return { label: 'EFICIENTE', color: '#10B981', tailwind: 'text-emerald-600 bg-emerald-50 border-emerald-100' };
      if (val >= 28801 && val <= 43200) return { label: 'MODERADO', color: '#FBBF24', tailwind: 'text-amber-600 bg-amber-50 border-amber-100' };
      if (val >= 43201 && val <= 64800) return { label: 'PROLONGADO', color: '#F97316', tailwind: 'text-orange-600 bg-orange-50 border-orange-100' };
      if (val >= 64801 && val <= 90000) return { label: 'EXCESSIVO', color: '#A855F7', tailwind: 'text-purple-600 bg-purple-50 border-purple-100' };
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
      <div className="lg:col-span-2 bg-white text-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col relative overflow-hidden">
        <h3 className="text-base font-bold mb-8 text-slate-900 uppercase tracking-wide">Totais de atendimentos</h3>
        
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
                  title={`Perdidas <= 1m: ${shortWaitPerc}%`}
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
                    <span className="font-medium">Perdidas ≤ 1m: <span className="text-orange-300">{lostShortWait.length}</span> ({shortWaitPerc}%)</span>
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
      <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-full relative overflow-hidden">
        <div className="flex justify-between items-start mb-2">
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

          <div className="flex flex-col gap-3 flex-1 h-full justify-center">
            <button 
              onClick={() => setActiveMetric('avg')}
              className={`p-4 rounded-2xl border transition-all text-left flex items-center gap-4 ${activeMetric === 'avg' ? 'bg-indigo-600 border-indigo-600 shadow-lg ring-4 ring-indigo-50' : 'bg-slate-50 border-slate-100 hover:border-indigo-200'}`}
            >
               <div className={`w-3 h-3 rounded-full shrink-0 ${activeMetric === 'avg' ? 'bg-white shadow-[0_0_8px_white]' : 'bg-emerald-500 opacity-50'}`} />
               <p className={`text-[10px] font-black uppercase tracking-wider leading-tight ${activeMetric === 'avg' ? 'text-white' : 'text-slate-500'}`}>
                 Tempo Médio de Atendimento (SLA)
               </p>
            </button>

            <button 
              onClick={() => setActiveMetric('total')}
              className={`p-4 rounded-2xl border transition-all text-left flex items-center gap-4 ${activeMetric === 'total' ? 'bg-indigo-600 border-indigo-600 shadow-lg ring-4 ring-indigo-50' : 'bg-slate-50 border-slate-100 hover:border-indigo-200'}`}
            >
               <div className={`w-3 h-3 rounded-full shrink-0 ${activeMetric === 'total' ? 'bg-white shadow-[0_0_8px_white]' : 'bg-indigo-800 opacity-50'}`} />
               <p className={`text-[10px] font-black uppercase tracking-wider leading-tight ${activeMetric === 'total' ? 'text-white' : 'text-slate-500'}`}>
                 Tempo de Conversa Total
               </p>
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

function ChartCallsOverTime({ data }: { data: CallData[] }) {
  const [hiddenKeys, setHiddenKeys] = useState<string[]>([]);

  const handleLegendClick = (o: any) => {
    const { dataKey } = o;
    setHiddenKeys(prev => 
      prev.includes(dataKey) ? prev.filter(k => k !== dataKey) : [...prev, dataKey]
    );
  };

  const getBarColor = (originalColor: string) => {
    return originalColor;
  };

  const chartData = useMemo(() => {
    // Group by day and hour
    const counts = data.reduce((acc, call) => {
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
  }, [data, hiddenKeys]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 h-80 flex flex-col relative shadow-sm">
      <h3 className="text-sm font-semibold mb-3 text-slate-900">Volume de Chamadas por Data/Hora</h3>
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
  );
}

function ChartAgentPerformance({ data }: { data: CallData[] }) {
  const [hiddenKeys, setHiddenKeys] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState('');

  const { chartData, techniciansCount, allAgentsData } = useMemo(() => {
    const agents = data.reduce((acc, call) => {
      const name = call.agentName || 'Não Atribuído';
      if (name === 'Não Atribuído' || name.trim() === '') return acc;
      
      const shortName = name.split(' - ')[0]; // Simplify
      if (!acc[shortName]) acc[shortName] = { name: shortName, chamadas: 0, abandonos: 0, perdidas_baixo_1m: 0, pendente: 0 };
      
      const reason = call.leftQueueReason?.toLowerCase() || '';
      if (reason === 'answered') {
        acc[shortName].chamadas += 1;
      } else if (reason === 'abandon') {
        if ((call.waitTime || 0) <= 60) {
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
  }, [data, hiddenKeys]);

  const filteredModalData = useMemo(() => {
    if (!modalSearch.trim()) return allAgentsData;
    return allAgentsData.filter((a: any) => 
      a.name.toLowerCase().includes(modalSearch.toLowerCase())
    );
  }, [allAgentsData, modalSearch]);

  const activeIdealPoint = useMemo(() => {
    const totalActiveCalls = data.filter(call => {
      const reason = call.leftQueueReason?.toLowerCase() || '';
      const isShortWait = (call.waitTime || 0) <= 60;
      
      if (reason === 'answered' && !hiddenKeys.includes('chamadas')) return true;
      if (reason === 'pendente' && !hiddenKeys.includes('pendente')) return true;
      if (reason === 'abandon') {
        if (isShortWait && !hiddenKeys.includes('perdidas_baixo_1m')) return true;
        if (!isShortWait && !hiddenKeys.includes('abandonos')) return true;
      }
      return false;
    }).length;
    
    return techniciansCount > 0 ? Math.round(totalActiveCalls / techniciansCount) : 0;
  }, [data, hiddenKeys, techniciansCount]);

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
        <button 
          onClick={() => setIsModalOpen(true)}
          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
          title="Expandir visualização"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
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
                <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
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
      if (d.agentName && d.agentName !== 'Ligações Perdidas') s.add(d.agentName);
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

        if (selectedAgent === 'Todos' || d.agentName === selectedAgent) {
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
    if (count <= 15) return 'bg-yellow-100 border-yellow-200 text-yellow-800';
    if (count < 30) return 'bg-emerald-200 border-emerald-300 text-emerald-900';
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
                  <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-200" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">5 - 15</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-emerald-200 border border-emerald-300" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">15 - 30</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-emerald-400 border border-emerald-500" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">30+</span>
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

function DataTable({ data }: { data: CallData[] }) {
  const [sortCol, setSortCol] = useState<keyof CallData | null>('startTime');
  const [sortDesc, setSortDesc] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSort = (col: keyof CallData) => {
    if (sortCol === col) {
      setSortDesc(!sortDesc);
    } else {
      setSortCol(col);
      setSortDesc(false);
    }
  };

  const sortedData = useMemo(() => {
    if (!sortCol) return data;
    return [...data].sort((a, b) => {
      let valA = a[sortCol];
      let valB = b[sortCol];
      
      if (valA instanceof Date && valB instanceof Date) {
        return sortDesc ? valB.getTime() - valA.getTime() : valA.getTime() - valB.getTime();
      }
      
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
      }
      
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDesc ? valB - valA : valA - valB;
      }
      return 0;
    });
  }, [data, sortCol, sortDesc]);

  const exportCSV = () => {
    const head = ['Nº Ticket', 'Origem', 'Data', 'Hora (Entrada)', 'Tempo de Espera', 'Hora Início', 'Hora Fim', 'Tempo de Conversa', 'Número', 'Fila', 'Operador', 'Status'].join(';');
    const rows = sortedData.map(d => {
      const statusLbl = d.leftQueueReason === 'answered' ? 'Atendida' : 
                        d.leftQueueReason === 'abandon' ? 'Perdida > 1m' : 
                        d.leftQueueReason === 'pendente' ? 'Pendente' : d.leftQueueReason;
                        
      const horaInicioTime = new Date(d.startTime.getTime() + d.waitTime * 1000);
      const horaFimTime = new Date(horaInicioTime.getTime() + d.talkDuration * 1000);

      return [
        `"${d.ticketNumber || ''}"`,
        `"${d.origin}"`,
        format(d.startTime, 'dd/MM/yyyy'),
        format(d.startTime, 'HH:mm:ss'),
        `"${formatSeconds(d.waitTime)}"`,
        format(horaInicioTime, 'HH:mm:ss'),
        format(horaFimTime, 'HH:mm:ss'),
        `"${formatSeconds(d.talkDuration)}"`,
        `"${formatPhone(d.callerNumber)}"`,
        `"${d.queue}"`,
        `"${formatAgentName(d.agentName)}"`,
        `"${statusLbl}"`
      ].join(';');
    });
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [head, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `exportacao_ligacoes_${format(new Date(), 'ddMMyyyy_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const Th = ({ label, colKey, align = "left" }: { label: string, colKey: keyof CallData, align?: "left" | "center" | "right" }) => (
    <th 
      className={`p-3 cursor-pointer hover:text-indigo-600 transition-colors select-none whitespace-nowrap text-${align}`}
      onClick={() => handleSort(colKey)}
    >
      {label} {sortCol === colKey && (sortDesc ? '↓' : '↑')}
    </th>
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 flex-1 flex flex-col overflow-hidden shadow-sm h-[400px]">
      <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Logs de Chamadas</span>
          <AnimatePresence>
            {copiedId && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm flex items-center gap-1"
              >
                <Check className="h-3 w-3" />
                Ticket {copiedId} Copiado!
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button 
          onClick={exportCSV}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md text-[11px] font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2 tracking-wide uppercase"
        >
          <Download className="h-3 w-3" />
          Exportar CSV
        </button>
      </div>
      <div className="overflow-x-auto flex-1 h-full overflow-y-auto">
        <table className="w-full text-left">
          <thead className="text-[11px] font-semibold text-slate-500 border-b border-slate-100 uppercase bg-white sticky top-0 z-10">
            <tr>
              <Th label="Nº Ticket" colKey="ticketNumber" />
              <Th label="Origem" colKey="origin" />
              <Th label="Data" colKey="startTime" />
              <Th label="Hora" colKey="startTime" />
              <Th label="Tempo de Espera" colKey="waitTime" align="center" />
              <Th label="Hora Início" colKey="startTime" />
              <Th label="Hora Fim" colKey="startTime" />
              <Th label="Tempo de Conversa" colKey="talkDuration" align="center" />
              <Th label="Número" colKey="callerNumber" />
              <Th label="Fila" colKey="queue" />
              <Th label="Operador" colKey="agentName" />
              <Th label="Status" colKey="leftQueueReason" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-[11px] font-mono">
            {sortedData.map((call, idx) => {
              const horaInicioTime = new Date(call.startTime.getTime() + call.waitTime * 1000);
              const horaFimTime = new Date(horaInicioTime.getTime() + call.talkDuration * 1000);
              
              const handleCopyTicket = (e: React.MouseEvent, ticket: string | undefined) => {
                e.stopPropagation();
                if (!ticket) return;
                navigator.clipboard.writeText(ticket);
                setCopiedId(ticket);
                setTimeout(() => setCopiedId(null), 2000);
              };

              const isRecentlyCopied = copiedId === call.ticketNumber;

              return (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="p-3">
                   {call.ticketNumber ? (
                     <button 
                        onClick={(e) => handleCopyTicket(e, call.ticketNumber)}
                        className={`group flex items-center gap-2 px-2 py-1 rounded border transition-all duration-200 w-fit max-w-[120px] ${
                          isRecentlyCopied 
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-inner' 
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-400 hover:bg-white hover:text-indigo-600 hover:shadow-sm'
                        }`}
                        title="Clique para copiar"
                      >
                        <span className="truncate max-w-[80px] font-mono font-bold">{call.ticketNumber}</span>
                        {isRecentlyCopied ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-500 animate-in zoom-in duration-300" />
                        ) : (
                          <Copy className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                   ) : (
                     <span className="text-slate-300 px-2">-</span>
                   )}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                    call.origin === 'Chat' ? 'bg-teal-50 text-teal-700 border border-teal-100' : 'bg-orange-50 text-orange-700 border border-orange-100'
                  }`}>
                    {call.origin}
                  </span>
                </td>
                <td className="p-3 text-slate-500 whitespace-nowrap">
                  {format(call.startTime, 'dd/MM/yyyy')}
                </td>
                <td className="p-3 text-slate-500 whitespace-nowrap">
                  {format(call.startTime, 'HH:mm:ss')}
                </td>
                <td className="p-3 text-slate-600 text-center">{formatSeconds(call.waitTime)}</td>
                <td className="p-3 font-semibold text-indigo-700 whitespace-nowrap">
                  {format(horaInicioTime, 'HH:mm:ss')}
                </td>
                <td className="p-3 font-semibold text-slate-600 whitespace-nowrap">
                  {format(horaFimTime, 'HH:mm:ss')}
                </td>
                <td className="p-3 text-center">
                  <CustomTooltip title="Métricas de Atendimento (SLA)" items={SLA_METRICS}>
                    <span className={`font-bold cursor-help transition-all ${getSlaColor(call.talkDuration)}`}>
                      {formatSeconds(call.talkDuration)}
                    </span>
                  </CustomTooltip>
                </td>
                <td className="p-3 font-bold text-slate-900 whitespace-nowrap">{formatPhone(call.callerNumber)}</td>
                <td className="p-3 truncate max-w-[150px] text-slate-600" title={call.queue}>{call.queue}</td>
                <td className="p-3 truncate max-w-[200px] text-slate-700" title={call.agentName}>
                  {formatAgentName(call.agentName)}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded uppercase font-bold text-[9px] tracking-wider whitespace-nowrap ${
                    call.leftQueueReason === 'answered' ? 'bg-emerald-100 text-emerald-700' :
                    call.leftQueueReason === 'abandon' ? 'bg-red-100 text-red-700' : 
                    call.leftQueueReason === 'pendente' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {call.leftQueueReason === 'answered' ? 'Atendida' : 
                     call.leftQueueReason === 'abandon' ? 'Perdida > 1m' : 
                     call.leftQueueReason === 'pendente' ? 'Pendente' : call.leftQueueReason}
                  </span>
                </td>
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
    </div>
  );
}

function AnalysisOfTicketsView({ data }: { data: CallData[] }) {
  const queueData = useMemo(() => {
    const counts = data.reduce((acc, call) => {
      acc[call.queue] = (acc[call.queue] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [data]);

  const statusData = useMemo(() => {
    const counts = data.reduce((acc, call) => {
      const status = call.leftQueueReason === 'answered' ? 'Atendida' : 
                     call.leftQueueReason === 'abandon' ? 'Perdida > 1m' : 
                     call.leftQueueReason === 'pendente' ? 'Pendente' : 'Outro';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [data]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <ListTree className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Distribuição por Fila</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Volume de chamados por setor</p>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={queueData.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Status dos Chamados</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Proporção de resolutividade</p>
            </div>
          </div>
          <div className="flex-1 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.name === 'Atendida' ? '#10b981' : entry.name === 'Perdida > 1m' ? '#EF4444' : '#3b82f6'} 
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <Clock className="h-5 w-5" />
             </div>
             <div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Evolução Temporal</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Acompanhamento de volumetria</p>
             </div>
          </div>
        </div>
        <div className="h-80">
           <ChartCallsOverTime data={data} />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
           <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Base de Dados Completa</h3>
        </div>
        <DataTable data={data} />
      </div>
    </div>
  );
}

