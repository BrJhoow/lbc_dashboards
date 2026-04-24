export interface CallData {
  startTime: Date;
  startTimeString: string; // Original or formatted string
  callerNumber: string;
  queue: string;
  waitTime: number;
  leftQueueReason: string;
  talkDuration: number;
  callDuration: number;
  agentName: string;
  dialedNumberName: string;
  origin: 'Chat' | 'GoTo';
  ticketNumber?: string;
}
