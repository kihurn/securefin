import { UserProfile, SessionDevice, Transaction, ScheduledObligation, InsightArticle } from './types';

export const initialUserProfile: UserProfile = {
  name: 'Alexander Sterling',
  email: 'a.sterling@fintrust.global',
  jobTitle: 'Chief Investment Officer',
  organization: 'Sterling Capital Partners',
  avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCDg2yG6DeqvdFwBESDNXlONVdCtr1aBiY4ahp8X0f265ny53vQXuo6eM10puU9igTk5H_7pn7F64jqcwU2KK5SlLtJABoyJxI7eK5NJ7-AQgUu9R84vnE8awaEm6fJkuWTYUrhwpj3n7f3pd8Km7B5xSswspwo-cYt0O-NmvLcwguzRgNs5pnnhegb7xC5ubIeZpsrXlJkfl3IF0MIFDL2E4PwFoG-RY4i8IqLJJuJTi3fY_9tnKuoylCtaxDvzoUsTlsBNkG7WVAy',
  twoFactorEnabled: true,
  defaultCurrency: 'USD ($) - United States Dollar',
  language: 'English (Global)',
  emailAlerts: true,
  pushNotifications: false,
  smsMarketing: false
};

export const initialSessions: SessionDevice[] = [
  {
    id: 'SESS-1',
    device: 'MacBook Pro 16" • London, UK',
    location: 'Current Session • Chrome',
    status: 'active',
    lastActive: 'Just now'
  },
  {
    id: 'SESS-2',
    device: 'iPhone 15 Pro • Zurich, CH',
    location: 'Last active: 2 hours ago • FinTrust App',
    status: 'inactive',
    lastActive: '2 hours ago'
  }
];

export const initialTransactions: Transaction[] = [
  {
    id: 'TRX-94821',
    date: 'Oct 24, 2024',
    time: '14:32 PM',
    description: 'Amazon Web Services',
    merchant: 'Amazon Web Services',
    category: 'Technology',
    amount: -1420.00,
    status: 'Verified',
    notes: "Monthly compute usage for production cluster 'Sigma'. Approved by Financial Controller.",
    attachmentName: 'Invoiced_94821.pdf',
    attachmentSize: '2.4 MB',
    iconName: 'cloud'
  },
  {
    id: 'TRX-94822',
    date: 'Oct 22, 2024',
    time: '09:15 AM',
    description: 'Internal Transfer',
    merchant: 'From Savings *4920',
    category: 'Financial Services',
    amount: 15000.00,
    status: 'Verified',
    notes: 'Quarterly liquidity rebalancing between operational vault and main vault.',
    attachmentName: 'Transfer_Receipt_94822.pdf',
    attachmentSize: '1.1 MB',
    iconName: 'account_balance'
  },
  {
    id: 'TRX-94823',
    date: 'Oct 21, 2024',
    time: '18:45 PM',
    description: 'Delta Air Lines',
    merchant: 'Delta Air Lines',
    category: 'Travel',
    amount: -840.50,
    status: 'Pending',
    notes: 'Round-trip flights for Q4 investment board meeting in Geneva.',
    attachmentName: 'E-Ticket_Delta_94823.pdf',
    attachmentSize: '950 KB',
    iconName: 'flight'
  },
  {
    id: 'TRX-94824',
    date: 'Oct 20, 2024',
    time: '11:02 AM',
    description: 'Cloudflare Inc.',
    merchant: 'Cloudflare Inc.',
    category: 'Infrastructure',
    amount: -2100.00,
    status: 'Verified',
    notes: 'Enterprise DDoS protection and SSL certificate renewals for primary trading gateway.',
    attachmentName: 'Cloudflare_Invoice_Oct.pdf',
    attachmentSize: '1.8 MB',
    iconName: 'security'
  },
  {
    id: 'TRX-94825',
    date: 'Oct 18, 2024',
    time: '20:10 PM',
    description: 'The Grillhouse',
    merchant: 'The Grillhouse',
    category: 'Dining',
    amount: -342.15,
    status: 'Verified',
    notes: 'Executive client dinner with principal officers from Sterling Partners.',
    attachmentName: 'Grillhouse_Receipt_94825.pdf',
    attachmentSize: '430 KB',
    iconName: 'restaurant'
  },
  {
    id: 'TRX-94826',
    date: 'Oct 15, 2024',
    time: '12:00 PM',
    description: 'Apple Store',
    merchant: 'Apple Store Regent St',
    category: 'Technology',
    amount: -2499.00,
    status: 'Verified',
    notes: 'Hardware upgrade: MacBook Pro M3 for quantitative analysis development.',
    attachmentName: 'Apple_Store_Invoice_94826.pdf',
    attachmentSize: '3.2 MB',
    iconName: 'shopping_bag'
  },
  {
    id: 'TRX-94827',
    date: 'Oct 12, 2024',
    time: '08:00 AM',
    description: 'Monthly Dividend',
    merchant: 'Investment Portfolio SPY',
    category: 'Income',
    amount: 1250.00,
    status: 'Verified',
    notes: 'Automated reinvested dividend payout from SPDR S&P 500 ETF Trust.',
    attachmentName: 'Dividend_Statement_Oct.pdf',
    attachmentSize: '1.5 MB',
    iconName: 'south_west'
  }
];

export const initialScheduledObligations: ScheduledObligation[] = [
  {
    id: 'SCH-1',
    day: '24',
    month: 'Oct',
    description: 'Vanguard Global REIT Fund',
    category: 'Recurring Investment • Monthly',
    amount: 12500.00,
    status: 'Processing'
  },
  {
    id: 'SCH-2',
    day: '01',
    month: 'Nov',
    description: 'Manhattan Sky Residence',
    category: 'Lease Payment • Automatic',
    amount: 8200.00,
    status: 'Scheduled'
  }
];

export const initialInsights: InsightArticle[] = [
  {
    id: 'INS-1',
    category: 'Tax Strategy',
    title: 'Maximizing Q4 Deductions for Trusts',
    description: 'How current treasury rates impact your institutional yield allocations and dynamic trust distribution strategies for high-net-worth brackets.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB2HH3uxqOScDzU1UbmRDHZe9C-H_PQMTiOY-oK1Xf0fYxhU7ylsx8K80HN3b0rtnAzb67ffZgIqCjSn_sWA-CfFmCRhTRW8qpSNGXxWf8yIkgxVpUrPErhIoW4pJqP8I6LdVEQ4LfA8mCTMbvarDDGmjvWLtlsVWLvdEgb8_edli78vEHiRuljyKXr5AzUjhN7jCRHBXsI-4WexD0lFgPG_BCOFoR5B35poUk950BZhuvh985pFtoyoSt_3DQbWNeBI4YjZxWbia4q'
  },
  {
    id: 'INS-2',
    category: 'Market Alert',
    title: 'Global Equity Pivot Trends',
    description: 'Institutional capital is shifting heavily toward green sovereign bonds, infrastructure funds, and next-generation sovereign debt indexes.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAOLLxcPjzSHgbV_hrvel6UvEWhxcsf_1kJtAybOMHdQbrQoqHep4rolkhLgp51tNJ7GpAIL4q32nw2aKeKWBtCoENp3Mpq6N_MztwjxGHksNUdK8fknp7FsWfTxAd7de-C0_K5X-gYIM9vn8VPaYawWj6mXSS0fydqAnUjTPKFAegtZvtNI3IQSFyV4g5TcOaVU1B2IMCBp18Pk-4CpNMIf8na-HqZ-RCa4ePp5-XtTo8dNi54EYSdXkQyqAqYf4eB2LdZRTpn8r8h'
  },
  {
    id: 'INS-3',
    category: 'Security',
    title: 'Enhanced Vault Protocols',
    description: 'Introducing new multi-sig authorization keys, hardware validation criteria, and latency gates for high-volume cross-border liquidity.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCF1mt1E7KrhguhoLRFvVo7sjt9X3qqrR8wbWkoaLk8bdxo3HhBqKs6_mjSZWMKBqDum_CQpYAzQyAaWpqZc5As8494XOmkcHMLhBZ10LAedUqZ09xp0prhp2KGEvhTourjmO2SHpSFw3OHjm3sHJuLnTO8Tb1MB7WBHwleDv7_qzkqGLeLhAy-B8UrwYCUqfgdQbvhfOOWRHnv_CCbRAf7o4r1WCfAH-6w0NO3PEppN5kC1PGDtlr3Z4YZuFpDsIz8IOkB590HMo7j'
  }
];
