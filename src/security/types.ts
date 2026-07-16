export type SecurityCategory = 'cryptography' | 'session' | 'access' | 'ledger' | 'network';
export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';
export type SecurityStatus = 'active' | 'inactive';

export interface SecurityModuleResult {
  success: boolean;
  message: string;
  timestamp: string;
  data?: any;
}

export interface SecurityModule {
  id: string;
  name: string;
  description: string;
  category: SecurityCategory;
  severity: SecuritySeverity;
  status: SecurityStatus;
  lastRun?: string;
  lastResult?: SecurityModuleResult;
  execute: (context?: any) => Promise<SecurityModuleResult>;
}
