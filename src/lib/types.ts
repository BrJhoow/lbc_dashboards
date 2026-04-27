export interface CallData {
  startTime: Date;
  startTimeString: string;
  callerNumber: string;
  queue: string;
  waitTime: number;
  leftQueueReason: string;
  talkDuration: number;
  callDuration: number;
  agentName: string;
  dialedNumberName: string;
  origin: 'Chat' | 'GoTo' | 'Movidesk';
  ticketNumber?: string;
  
  // Movidesk specific fields
  subject?: string;
  urgency?: string;
  clientName?: string;
  cnpj?: string;
  status?: string;
  team?: string;
  resolutionDate?: Date;
  description?: string;
  totalLifeTime?: string;
  
  // Additional Movidesk fields
  movedAt?: string | Date;
  createdBy?: string;
  tags?: string;
  service?: string;
  type?: string;
  slaN2FirstEntry?: string | Date;
  slaN2FirstExit?: string | Date;
  firstResponseTime?: string;
  downtimeHours?: string;

  // Internal optimization fields
  _status?: string;
  _dateFormatted?: string;
  _searchable?: string;
  _team?: string;
  _schedule?: string;
}
