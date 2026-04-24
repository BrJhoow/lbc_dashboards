import Papa from 'papaparse';
import { CallData } from './types';
import { parseISO, isValid } from 'date-fns';

export function parseCSVData(csvString: string): CallData[] {
  const result = Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true,
  });

  const parsedData: CallData[] = [];

  result.data.forEach((row: any) => {
    // Normalize keys to handle BOM or extra spaces
    const r: any = {};
    Object.keys(row).forEach(key => {
      const cleanKey = key.replace(/^\ufeff/, '').trim();
      r[cleanKey] = row[key];
    });

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
