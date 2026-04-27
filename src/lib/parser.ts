import Papa from 'papaparse';
import { CallData } from './types';
import { parseISO, isValid } from 'date-fns';

export function parseCSVData(csvString: string): CallData[] {
  // Try to detect if it's semicolon separated (common in Brazilian exports)
  let delimiter = ',';
  if (csvString.includes(';') && (csvString.split(';').length > csvString.split(',').length)) {
    delimiter = ';';
  }

  // Read as text, handle encoding if necessary, potentially use a better charset library if needed.
  // For now, let's treat it as UTF-8 but handle potential character replacement in post-processing if still needed.
  const result = (Papa.parse as any)(csvString, {
    header: true,
    skipEmptyLines: true,
    delimiter: delimiter,
    // encoding: 'ISO-8859-1', // Removed, PapaParse handles UTF-8 by default and often struggles with other encodings without Blob/File API
    sync: true,
  });

  const parsedData: CallData[] = [];

  const formatCNPJ = (val: string | number) => {
    let s = String(val).replace(/[^0-9]/g, '');
    // If it's in scientific notation
    if (String(val).toLowerCase().includes('e+')) {
        s = Number(val).toLocaleString('fullwide', {useGrouping:false}).replace(/[^0-9]/g, '');
    }
    s = s.padStart(14, '0');
    return s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  result.data.forEach((row: any) => {
    // Keep raw values
    const r: any = row;
    
    // Normalize keys to handle accents/special chars in keys, and strip non-ASCII
    const normalizedRow: any = {};
    Object.keys(r).forEach(key => {
        const normalizedKey = key.replace(/[^\x20-\x7E]/g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        normalizedRow[normalizedKey] = r[key];
    });

    // Header helper - relaxed matching
    const findValue = (possibleKeys: string[]) => {
      for (const k of possibleKeys) {
        const normalizedKey = k.replace(/[^\x20-\x7E]/g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        if (normalizedRow[normalizedKey] !== undefined) return normalizedRow[normalizedKey];
      }
      return undefined;
    };

    const parseMoviDate = (dateStr: string | undefined): Date | undefined => {
      if (!dateStr || dateStr.trim() === '') return undefined;
      const cleanVal = dateStr.trim();

      // Look for time in the string (HH:mm or HH:mm:ss)
      const timeRegex = /(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/;
      const timeMatch = cleanVal.match(timeRegex);
      let h = 0, m = 0, s = 0, hasTime = false;
      if (timeMatch) {
        h = Number(timeMatch[1]);
        m = Number(timeMatch[2]);
        s = Number(timeMatch[3]) || 0;
        hasTime = true;
      }

      // Look for DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
      const dateRegex = /^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})/;
      const match = cleanVal.match(dateRegex);

      if (match) {
        let day = Number(match[1]);
        let month = Number(match[2]);
        let year = Number(match[3]);
        if (year < 100) year += 2000;
        
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year > 1900 && year < 2100) {
          // If no time is found, default to midday to avoid timezone issues for date-only fields
          const finalH = hasTime ? h : 12;
          const d = new Date(year, month - 1, day, finalH, m, s);
          if (isValid(d)) return d;
        }
      }

      // Look for YYYY-MM-DD
      const isoRegex = /^(\d{4})-(\d{1,2})-(\d{1,2})/;
      const isoMatch = cleanVal.match(isoRegex);
      if (isoMatch) {
         const y = Number(isoMatch[1]);
         const mon = Number(isoMatch[2]);
         const d = Number(isoMatch[3]);
         const finalH = hasTime ? h : 12;
         const d2 = new Date(y, mon - 1, d, finalH, m, s);
         if (isValid(d2)) return d2;
      }

      const fallback = new Date(cleanVal);
      if (isValid(fallback) && fallback.getFullYear() > 1900 && fallback.getFullYear() < 2100) {
        if (hasTime) {
          return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate(), h, m, s);
        }
        return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate(), 12, 0, 0);
      }
      return undefined;
    };

    const moviNumeroValue = findValue(['Número', 'Numero', 'Nmero']);
    const moviAbertoEmValue = findValue(['Aberto em']);
    const moviCnpjValue = findValue(['Cliente: CPF / CNPJ (Pessoa)', 'Cliente: CPF / CNPJ']);

    if (moviNumeroValue !== undefined && moviAbertoEmValue !== undefined) {
    // Movidesk Ticket Format
      const resolutionDate = parseMoviDate(findValue(['Resolvido em']));
      const parsedDate = parseMoviDate(moviAbertoEmValue) || new Date();

      parsedData.push({
        startTime: parsedDate,
        startTimeString: moviAbertoEmValue,
        callerNumber: '',
        queue: findValue(['Responsável: Equipe', 'Equipe', 'Responsvel: Equipe', 'Responsvel: Equipe']) || '',
        waitTime: 0,
        leftQueueReason: findValue(['Status', 'Status']) || '',
        talkDuration: 0,
        callDuration: 0,
        agentName: findValue(['Responsável', 'Responsavel', 'Responsvel', 'Responsvel']) || '',
        dialedNumberName: '',
        origin: 'Movidesk',
        ticketNumber: moviNumeroValue,
        subject: findValue(['Assunto']),
        urgency: findValue(['Urgência', 'Urgencia', 'Urgncia', 'Urgncia']),
        clientName: findValue(['Cliente (Completo)']),
        cnpj: moviCnpjValue ? formatCNPJ(moviCnpjValue) : undefined,
        status: findValue(['Status']),
        team: findValue(['Responsável: Equipe', 'Equipe', 'Responsvel: Equipe', 'Responsvel: Equipe']),
        resolutionDate: resolutionDate,
        description: findValue(['Descrição do Ticket', 'Descricao do Ticket', 'Descrio do Ticket', 'Descrio do Ticket']),
        totalLifeTime: findValue(['Tempo de vida (Horas corridas)', 'Tempo de vida', 'Tempo de vida (Horas corridas)']),
        
        // Map new fields
        movedAt: parseMoviDate(findValue(['Movimentado em'])) || findValue(['Movimentado em']),
        createdBy: findValue(['Criado por']),
        tags: findValue(['Tags']),
        service: findValue(['Serviço (Completo)', 'Servico (Completo)', 'Servio (Completo)']),
        type: findValue(['Tipo']),
        slaN2FirstEntry: parseMoviDate(findValue(['SLA N2 - 1ª Entrada', 'SLA N2 - 1 Entrada', 'SLA N2 - 1 Entrada'])) || findValue(['SLA N2 - 1ª Entrada', 'SLA N2 - 1 Entrada', 'SLA N2 - 1 Entrada']),
        slaN2FirstExit: parseMoviDate(findValue(['SLA N2 - 1ª Saída', 'SLA N2 - 1 Saida', 'SLA N2 - 1 Sada'])) || findValue(['SLA N2 - 1ª Saída', 'SLA N2 - 1 Saida', 'SLA N2 - 1 Sada']),
        firstResponseTime: findValue(['1ª Resposta (Horas Corridas)', '1 Resposta (Horas Corridas)', '1 Resposta (Horas Corridas)']),
        downtimeHours: findValue(['Tempo parado (Horas úteis)', 'Tempo parado (Horas uteis)', 'Tempo parado (Horas teis)']),
      });

      return;
    }


    if (r['Cliente'] !== undefined && r['Data'] !== undefined) {
      // Chat Format
      const dataStr = r['Data']; // e.g. "13/04/2026, 08:28"
      let parsedDate = new Date();
      if (dataStr) {
        const [datePart, timePart] = dataStr.split(', ');
        if (datePart && timePart) {
          const [day, month, year] = datePart.split('/');
          parsedDate = new Date(`${year}-${month}-${day}T${timePart}:00`);
        }
      }

      let callerNumber = '';
      const clienteStr = String(r['Cliente'] || '');
      const numberMatch = clienteStr.match(/\d{8,}$/);
      if (numberMatch) {
         callerNumber = numberMatch[0];
      } else {
         callerNumber = clienteStr;
      }

      const duration = parseFloat(r['Duração']) || 0;
      const resultado = r['Resultado']?.toUpperCase() || '';
      
      // Ignorar completamente linhas com AGENTE QA OFFLINE
      if (resultado === 'AGENTE QA OFFLINE') {
         return;
      }
      
      let leftQueueReason = resultado;
      if (resultado === 'FINALIZADO') { 
         leftQueueReason = 'answered'; 
      } else if (resultado === 'PENDENTE') {
         leftQueueReason = 'pendente';
      } else if (!leftQueueReason && r['Etiqueta']) {
         leftQueueReason = 'answered';
      }

      parsedData.push({
        startTime: parsedDate,
        startTimeString: dataStr,
        callerNumber: callerNumber,
        queue: r['Etiqueta'] || '',
        waitTime: 0,
        leftQueueReason: leftQueueReason,
        talkDuration: duration,
        callDuration: duration,
        agentName: r['Último agente'] || r['Último Agente'] || '',
        dialedNumberName: '',
        origin: 'Chat',
        ticketNumber: r['Protocolo'] || '',
      });

      return;
    }

    // GoTo CSV Format
    const startTimeStr = r['Start time [America/Sao_Paulo]'] || r['Start time'];
    
    if (!startTimeStr) return;

    let parsedDate = parseISO(startTimeStr);
    if (!isValid(parsedDate)) {
      parsedDate = new Date(startTimeStr); // Fallback
    }

    if (!isValid(parsedDate)) return; // Skip rows with invalid dates

    let rawName = String(r['Caller Name'] || '').trim();
    let rawNum = String(r['Caller Number'] || '').trim();
    let callerNumber = rawNum;
    
    if (/^\d+$/.test(rawName) && rawName.length > 5) {
      callerNumber = '55' + rawName;
    } else if (rawNum.includes('E+') || rawNum.includes('e+')) {
      const numStr = rawNum.replace(',', '.');
      callerNumber = Number(numStr).toLocaleString('fullwide', {useGrouping:false}).replace(/,/g, '');
    }

    const queue = r['Queue'] || '';
    const waitTime = parseFloat(r['Wait time (s)']) || 0;
    const leftQueueReason = r['Left Queue Reason'] || '';
    const talkDuration = parseFloat(r['Talk duration (s)']) || 0;
    const callDuration = parseFloat(r['Call duration (s)']) || 0;
    const agentName = r['Agent Name'] || '';
    const dialedNumberName = r['Dialed number name'] || '';

    parsedData.push({
      startTime: parsedDate,
      startTimeString: startTimeStr,
      callerNumber: callerNumber,
      queue: queue,
      waitTime: waitTime,
      leftQueueReason: leftQueueReason,
      talkDuration: talkDuration,
      callDuration: callDuration,
      agentName: agentName,
      dialedNumberName: dialedNumberName,
      origin: 'GoTo',
      ticketNumber: '',
    });
  });

  return parsedData;
}
