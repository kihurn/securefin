export interface UserProfile {
  name: string;
  email: string;
  role?: 'user' | 'admin';
  jobTitle: string;
  organization: string;
  avatarUrl: string;
  twoFactorEnabled: boolean;
  defaultCurrency: string;
  language: string;
  emailAlerts: boolean;
  pushNotifications: boolean;
  smsMarketing: boolean;
  faceDescriptor?: string | null;
  balanceOperational?: number;
  balanceVault?: number;
  balanceReserve?: number;
}

export interface SessionDevice {
  id: string;
  device: string;
  location: string;
  status: 'active' | 'inactive';
  lastActive: string;
}

export interface Transaction {
  id: string;
  date: string;
  time: string;
  description: string;
  merchant: string;
  category: 'Technology' | 'Financial Services' | 'Travel' | 'Infrastructure' | 'Dining' | 'Income' | 'Utilities';
  amount: number; // positive for income, negative for expense
  status: 'Verified' | 'Pending' | 'Processing';
  notes?: string;
  attachmentName?: string;
  attachmentSize?: string;
  iconName: 'cloud' | 'account_balance' | 'flight' | 'security' | 'shopping_bag' | 'south_west' | 'payments' | 'restaurant';
}

export interface ScheduledObligation {
  id: string;
  day: string;
  month: string;
  description: string;
  category: string;
  amount: number;
  status: 'Processing' | 'Scheduled';
}

export interface InsightArticle {
  id: string;
  category: string;
  title: string;
  description: string;
  imageUrl: string;
}
