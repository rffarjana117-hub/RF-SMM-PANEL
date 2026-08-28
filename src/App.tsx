import React, { useState, useEffect, useRef } from 'react';
import { Live3DCanvas, ThreeDTheme, THEME_CONFIGS } from './components/Live3DCanvas';
import { Welcome3DModal } from './components/Welcome3DModal';
import { LiveAISupportModal } from './components/LiveAISupportModal';
import { AdminLiveSupportPanel } from './components/AdminLiveSupportPanel';
import {
  db,
  auth,
  signOut,
  doc,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  getDoc,
  getDocs,
  DEFAULT_SERVICES
} from './firebase';

interface ServiceData {
  id: string;
  category: string;
  name: string;
  price: number;
  min: number;
  max: number;
  desc?: string;
  apiServiceId?: string;
}

interface OrderData {
  id: string;
  uid: string;
  service: string;
  qty: number;
  link: string;
  cost: number;
  status: string;
  timestamp?: any;
  createdAt?: string;
  apiOrderId?: string | number;
  apiError?: string;
  apiStatus?: string;
}

export interface PaymentMethodConfig {
  id: string;
  label: string;
  number: string;
  type?: 'Send Money' | 'Cash Out' | 'Payment';
  ussd?: string;
  color?: string;
  logoUrl?: string;
  iconType?: 'bkash' | 'nagad' | 'rocket' | 'upay' | 'binance' | 'usdt' | 'bank' | 'custom';
  note?: string;
  isCrypto?: boolean;
  active?: boolean;
}

interface DepositRequest {
  id: string;
  uid: string;
  amount: number;
  trxId: string;
  method: string;
  status: string;
  screenshotUrl?: string;
  timestamp?: any;
}

interface UserSession {
  uid: string;
  username: string;
  name: string;
  email?: string;
  photoURL?: string;
  referredBy?: string | null;
  referredByUsername?: string | null;
}

export interface ReferralCommission {
  id: string;
  referrerUid: string;
  referrerUsername?: string;
  referredUid: string;
  referredUsername?: string;
  depositAmount: number;
  bonusPercent: number;
  commissionAmount: number;
  depositTrxId?: string;
  timestamp?: any;
  status?: string;
  createdAt?: string;
}

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  channels: string;
  customPhotoUrl?: string;
  captionStyle?: 'vip' | 'minimal' | 'cyber';
  customHeader?: string;
  customFooter?: string;
  miniAppUrl?: string;
}

export interface ReferralConfig {
  enabled: boolean;
  bonusPercent: number;
  websiteUrl?: string;
}

export interface TaskSubmission {
  id: string;
  taskId: string;
  taskTitle: string;
  reward: number;
  userId: string;
  userName: string;
  proofText: string;
  screenshots: string[]; // up to 5 screenshot base64 strings
  status: 'Pending' | 'Approved' | 'Rejected';
  submittedAt: string;
  adminNote?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  reward: number;
  link: string;
  icon?: string;
  image?: string;
}

// Image compression helper to support up to 5 screenshots
const compressImageToBase64 = (file: File, maxWidth = 900, maxHeight = 900, quality = 0.75): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } else {
          resolve(event.target?.result as string);
        }
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

// Legacy Service ID Mapper to ensure SMMGen API receives real working service IDs
const SERVICE_ID_MAP: Record<string, string> = {
  '101': '15806', // FB Followers (30D Refill)
  '102': '16869', // FB Post Likes
  '201': '19382', // IG Followers
  '202': '13330', // IG Likes
  '301': '16393', // TikTok Followers
  '302': '16356', // TikTok Likes
  '401': '9622',  // YouTube Subscribers
  '402': '18918', // YouTube Views
  '501': '18384'  // Telegram Members
};

// Social Platforms Meta with icons and colors
const SOCIAL_PLATFORMS = [
  { id: 'facebook', name: 'Facebook', icon: 'fab fa-facebook-f', color: '#1877F2', bg: 'from-blue-600/25 to-blue-500/10' },
  { id: 'instagram', name: 'Instagram', icon: 'fab fa-instagram', color: '#E4405F', bg: 'from-pink-600/25 to-purple-600/10' },
  { id: 'tiktok', name: 'TikTok', icon: 'fab fa-tiktok', color: '#00F2FE', bg: 'from-cyan-500/25 to-pink-500/10' },
  { id: 'youtube', name: 'YouTube', icon: 'fab fa-youtube', color: '#FF0000', bg: 'from-red-600/25 to-red-500/10' },
  { id: 'telegram', name: 'Telegram', icon: 'fab fa-telegram-plane', color: '#229ED9', bg: 'from-sky-500/25 to-blue-500/10' },
  { id: 'twitter', name: 'Twitter / X', icon: 'fab fa-twitter', color: '#1DA1F2', bg: 'from-slate-700/30 to-blue-500/10' },
  { id: 'website', name: 'Website / SEO', icon: 'fas fa-globe', color: '#10B981', bg: 'from-emerald-500/25 to-teal-500/10' },
  { id: 'whatsapp', name: 'WhatsApp', icon: 'fab fa-whatsapp', color: '#25D366', bg: 'from-emerald-600/25 to-green-500/10' },
  { id: 'snapchat', name: 'Snapchat', icon: 'fab fa-snapchat-ghost', color: '#FFFC00', bg: 'from-yellow-400/25 to-amber-500/10' },
  { id: 'spotify', name: 'Spotify', icon: 'fab fa-spotify', color: '#1DB954', bg: 'from-green-500/25 to-emerald-500/10' },
  { id: 'discord', name: 'Discord', icon: 'fab fa-discord', color: '#5865F2', bg: 'from-indigo-500/25 to-blue-500/10' },
  { id: 'linkedin', name: 'LinkedIn', icon: 'fab fa-linkedin-in', color: '#0A66C2', bg: 'from-blue-700/25 to-sky-500/10' },
];

function getPlatformMeta(name: string) {
  const str = (name || '').toLowerCase();
  if (str.includes('fb') || str.includes('facebook')) return SOCIAL_PLATFORMS[0];
  if (str.includes('ig') || str.includes('instagram')) return SOCIAL_PLATFORMS[1];
  if (str.includes('tiktok') || str.includes('tt')) return SOCIAL_PLATFORMS[2];
  if (str.includes('yt') || str.includes('youtube')) return SOCIAL_PLATFORMS[3];
  if (str.includes('telegram') || str.includes('tg')) return SOCIAL_PLATFORMS[4];
  if (str.includes('twitter') || str.includes('x') || str.includes('tweet')) return SOCIAL_PLATFORMS[5];
  if (str.includes('web') || str.includes('seo') || str.includes('website') || str.includes('traffic')) return SOCIAL_PLATFORMS[6];
  if (str.includes('whatsapp') || str.includes('wa')) return SOCIAL_PLATFORMS[7];
  if (str.includes('snapchat') || str.includes('sc')) return SOCIAL_PLATFORMS[8];
  if (str.includes('spotify')) return SOCIAL_PLATFORMS[9];
  if (str.includes('discord')) return SOCIAL_PLATFORMS[10];
  if (str.includes('linkedin')) return SOCIAL_PLATFORMS[11];
  return { id: 'smm', name: 'SMM Service', icon: 'fas fa-rocket', color: '#3B82F6', bg: 'from-blue-500/20 to-indigo-500/10' };
}

// Render dynamic Payment Method Logo
function renderMethodLogo(method: { label?: string; iconType?: string; logoUrl?: string; color?: string; id?: string }, size = 'w-7 h-7') {
  if (method.logoUrl && method.logoUrl.trim()) {
    return (
      <img
        src={method.logoUrl}
        alt={method.label || 'Logo'}
        className={`${size} object-contain rounded-md`}
        referrerPolicy="no-referrer"
        onError={(e) => {
          (e.currentTarget as HTMLElement).style.display = 'none';
        }}
      />
    );
  }

  const iconType = (method.iconType || method.id || method.label || '').toLowerCase();
  if (iconType.includes('bkash')) {
    return (
      <div className={`${size} rounded-lg bg-[#e2136e] flex items-center justify-center p-1 shadow-sm flex-shrink-0`}>
        <svg viewBox="0 0 100 100" className="w-full h-full text-white fill-current">
          <polygon points="50,8 90,38 75,90 25,90 10,38" fill="#e2136e" />
          <polygon points="50,18 82,42 70,82 30,82 18,42" fill="white" />
          <polygon points="50,28 72,55 50,78 28,55" fill="#e2136e" />
        </svg>
      </div>
    );
  }
  if (iconType.includes('rocket')) {
    return (
      <div className={`${size} rounded-lg bg-[#8c3494] flex items-center justify-center p-1 shadow-sm flex-shrink-0`}>
        <svg viewBox="0 0 100 100" className="w-full h-full text-white fill-current">
          <circle cx="50" cy="50" r="45" fill="#8c3494" />
          <path d="M50 15 L68 45 L60 85 L50 75 L40 85 L32 45 Z" fill="white" />
          <polygon points="50,30 60,55 40,55" fill="#facc15" />
        </svg>
      </div>
    );
  }
  if (iconType.includes('nagad')) {
    return (
      <div className={`${size} rounded-lg bg-gradient-to-tr from-[#ea580c] to-[#f97316] flex items-center justify-center p-1 shadow-sm flex-shrink-0`}>
        <svg viewBox="0 0 100 100" className="w-full h-full text-white fill-current">
          <circle cx="50" cy="50" r="45" fill="#ea580c" />
          <path d="M50 15 Q75 35 65 65 Q55 85 45 80 Q35 75 40 60 Q45 45 35 35 Q50 25 50 15 Z" fill="white" />
          <circle cx="58" cy="42" r="8" fill="#facc15" />
        </svg>
      </div>
    );
  }
  if (iconType.includes('upay')) {
    return (
      <div className={`${size} rounded-lg bg-[#005696] flex items-center justify-center text-amber-300 font-black text-[9px] shadow-sm flex-shrink-0 tracking-tighter`}>
        upay
      </div>
    );
  }
  if (iconType.includes('binance')) {
    return (
      <div className={`${size} rounded-lg bg-[#f0b90b] flex items-center justify-center p-1 shadow-sm text-slate-950 flex-shrink-0`}>
        <svg viewBox="0 0 100 100" className="w-full h-full fill-current">
          <polygon points="50,15 65,30 50,45 35,30" />
          <polygon points="50,55 65,70 50,85 35,70" />
          <polygon points="20,50 35,35 35,65" />
          <polygon points="80,50 65,35 65,65" />
        </svg>
      </div>
    );
  }
  if (iconType.includes('usdt') || iconType.includes('crypto')) {
    return (
      <div className={`${size} rounded-lg bg-[#26a17b] flex items-center justify-center text-white font-black text-xs shadow-sm flex-shrink-0`}>
        ‚ÇÆ
      </div>
    );
  }

  return (
    <div
      className={`${size} rounded-lg flex items-center justify-center text-white font-black text-[10px] shadow-sm flex-shrink-0`}
      style={{ backgroundColor: method.color || '#3b82f6' }}
    >
      {method.label ? method.label.slice(0, 2).toUpperCase() : 'PAY'}
    </div>
  );
}

export default function App() {
  // Splash & Auth State
  const [showSplash, setShowSplash] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);

  // Form states for auth
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginUserErr, setLoginUserErr] = useState('');
  const [loginPassErr, setLoginPassErr] = useState('');

  // 3D Live Theme & Welcome Modal States
  const [threeDTheme, setThreeDTheme] = useState<ThreeDTheme>(() => {
    return (localStorage.getItem('smm_3d_theme') as ThreeDTheme) || 'cyber_neon';
  });
  const [is3DEnabled, setIs3DEnabled] = useState<boolean>(() => {
    return localStorage.getItem('smm_3d_enabled') !== 'false';
  });
  const [show3DThemeModal, setShow3DThemeModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showAISupportModal, setShowAISupportModal] = useState(false);

  // Telegram Live Order Notification Configuration (Firestore settings/telegram_config)
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>({
    enabled: true,
    botToken: '8417495766:AAEupqJEr6_IyvOcGXhhdWStj95khUdr8MU',
    channels: '@RF2_SMM, @FARJU_SMM_PANAL',
    customPhotoUrl: '',
    captionStyle: 'vip',
    customHeader: '',
    customFooter: '',
    miniAppUrl: 'https://t.me/RF_SMM_PRO_BOT?startapp=8479465879',
  });
  const [adminTelegramEnabled, setAdminTelegramEnabled] = useState(true);
  const [adminTelegramBotToken, setAdminTelegramBotToken] = useState('8417495766:AAEupqJEr6_IyvOcGXhhdWStj95khUdr8MU');
  const [adminTelegramChannels, setAdminTelegramChannels] = useState('@RF2_SMM, @FARJU_SMM_PANAL');
  const [adminTelegramPhotoUrl, setAdminTelegramPhotoUrl] = useState('');
  const [adminTelegramMiniAppUrl, setAdminTelegramMiniAppUrl] = useState('https://t.me/RF_SMM_PRO_BOT?startapp=8479465879');
  const [adminTelegramStyle, setAdminTelegramStyle] = useState<'vip' | 'minimal' | 'cyber'>('vip');
  const [adminTelegramHeader, setAdminTelegramHeader] = useState('');
  const [adminTelegramFooter, setAdminTelegramFooter] = useState('');
  const [adminSavingTelegram, setAdminSavingTelegram] = useState(false);
  const [adminShowBotToken, setAdminShowBotToken] = useState(false);
  const [adminTestingTelegram, setAdminTestingTelegram] = useState(false);

  // Welcome Speech & 3D Announcement Configuration (stored in Firestore settings/welcome_config)
  const [welcomeConfig, setWelcomeConfig] = useState<{
    title: string;
    text: string;
    enabled: boolean;
    soundEnabled: boolean;
    show3DButton: boolean;
    is3DCanvasGlobal: boolean;
    showNoticeTicker: boolean;
    noticeText?: string;
    audioMode: 'tts' | 'custom';
    customAudioUrl?: string;
    audioFileName?: string;
    siteLogo?: string;
    aiSupportEnabled?: boolean;
  }>({
    title: '‡¶ì‡¶Ø‡¶º‡ßá‡¶≤‡¶ï‡¶æ‡¶Æ RF SMM PANEL!',
    text: '‡¶ì‡¶Ø‡¶º‡ßá‡¶≤‡¶ï‡¶æ‡¶Æ ‡¶ü‡ßÅ ‡¶Ü‡¶∞ ‡¶è‡¶´ ‡¶è‡¶∏‡¶è‡¶Æ‡¶è‡¶Æ ‡¶™‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤‡•§ ‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ‡¶¶‡ßá‡¶∂‡ßá‡¶∞ ‡¶è‡¶ï ‡¶®‡¶Æ‡ßç‡¶¨‡¶∞ ‡¶∏‡ßã‡¶∂‡ßç‡¶Ø‡¶æ‡¶≤ ‡¶Æ‡¶ø‡¶°‡¶ø‡¶Ø‡¶º‡¶æ ‡¶Æ‡¶æ‡¶∞‡ßç‡¶ï‡ßá‡¶ü‡¶ø‡¶Ç ‡¶™‡ßç‡¶≤‡ßç‡¶Ø‡¶æ‡¶ü‡¶´‡¶∞‡ßç‡¶Æ‡ßá ‡¶Ü‡¶™‡¶®‡¶æ‡¶ï‡ßá ‡¶∏‡ßç‡¶¨‡¶æ‡¶ó‡¶§‡¶Æ‡•§',
    enabled: true,
    soundEnabled: true,
    show3DButton: true,
    is3DCanvasGlobal: true,
    showNoticeTicker: true,
    noticeText: '‚ö° ‡ß®‡ß™/‡ß≠ ‡¶á‡¶®‡¶∏‡ßç‡¶ü‡ßç‡¶Ø‡¶æ‡¶®‡ßç‡¶ü ‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏ ‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡ßü | ‡¶¨‡¶ø‡¶ï‡¶æ‡¶∂, ‡¶®‡¶ó‡¶¶, ‡¶∞‡¶ï‡ßá‡¶ü‡ßá ‡¶á‡¶®‡¶∏‡ßç‡¶ü‡ßç‡¶Ø‡¶æ‡¶®‡ßç‡¶ü ‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶¨‡ßã‡¶®‡¶æ‡¶∏ ‡¶ö‡¶≤‡¶õ‡ßá | ‡¶Ø‡ßá‡¶ï‡ßã‡¶®‡ßã ‡¶™‡ßç‡¶∞‡ßü‡ßã‡¶ú‡¶®‡ßá ‡¶Ü‡¶Æ‡¶æ‡¶¶‡ßá‡¶∞ ‡¶≤‡¶æ‡¶á‡¶≠ ‡¶∏‡¶æ‡¶™‡ßã‡¶∞‡ßç‡¶ü‡ßá ‡¶Ø‡ßã‡¶ó‡¶æ‡¶Ø‡ßã‡¶ó ‡¶ï‡¶∞‡ßÅ‡¶® üöÄ',
    audioMode: 'tts',
    customAudioUrl: '',
    audioFileName: '',
    aiSupportEnabled: true,
  });
  const [adminWelcomeTitle, setAdminWelcomeTitle] = useState('‡¶ì‡¶Ø‡¶º‡ßá‡¶≤‡¶ï‡¶æ‡¶Æ RF SMM PANEL!');
  const [adminWelcomeText, setAdminWelcomeText] = useState('‡¶ì‡¶Ø‡¶º‡ßá‡¶≤‡¶ï‡¶æ‡¶Æ ‡¶ü‡ßÅ ‡¶Ü‡¶∞ ‡¶è‡¶´ ‡¶è‡¶∏‡¶è‡¶Æ‡¶è‡¶Æ ‡¶™‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤‡•§ ‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ‡¶¶‡ßá‡¶∂‡ßá‡¶∞ ‡¶è‡¶ï ‡¶®‡¶Æ‡ßç‡¶¨‡¶∞ ‡¶∏‡ßã‡¶∂‡ßç‡¶Ø‡¶æ‡¶≤ ‡¶Æ‡¶ø‡¶°‡¶ø‡¶Ø‡¶º‡¶æ ‡¶Æ‡¶æ‡¶∞‡ßç‡¶ï‡ßá‡¶ü‡¶ø‡¶Ç ‡¶™‡ßç‡¶≤‡ßç‡¶Ø‡¶æ‡¶ü‡¶´‡¶∞‡ßç‡¶Æ‡ßá ‡¶Ü‡¶™‡¶®‡¶æ‡¶ï‡ßá ‡¶∏‡ßç‡¶¨‡¶æ‡¶ó‡¶§‡¶Æ‡•§');
  const [adminWelcomeEnabled, setAdminWelcomeEnabled] = useState(true);
  const [adminSoundEnabled, setAdminSoundEnabled] = useState(true);
  const [adminShow3DButton, setAdminShow3DButton] = useState(true);
  const [admin3DCanvasGlobal, setAdmin3DCanvasGlobal] = useState(true);
  const [adminShowNoticeTicker, setAdminShowNoticeTicker] = useState(true);
  const [adminNoticeText, setAdminNoticeText] = useState('‚ö° ‡ß®‡ß™/‡ß≠ ‡¶á‡¶®‡¶∏‡ßç‡¶ü‡ßç‡¶Ø‡¶æ‡¶®‡ßç‡¶ü ‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏ ‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡ßü | ‡¶¨‡¶ø‡¶ï‡¶æ‡¶∂, ‡¶®‡¶ó‡¶¶, ‡¶∞‡¶ï‡ßá‡¶ü‡ßá ‡¶á‡¶®‡¶∏‡ßç‡¶ü‡ßç‡¶Ø‡¶æ‡¶®‡ßç‡¶ü ‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶¨‡ßã‡¶®‡¶æ‡¶∏ ‡¶ö‡¶≤‡¶õ‡ßá | ‡¶Ø‡ßá‡¶ï‡ßã‡¶®‡ßã ‡¶™‡ßç‡¶∞‡ßü‡ßã‡¶ú‡¶®‡ßá ‡¶Ü‡¶Æ‡¶æ‡¶¶‡ßá‡¶∞ ‡¶≤‡¶æ‡¶á‡¶≠ ‡¶∏‡¶æ‡¶™‡ßã‡¶∞‡ßç‡¶ü‡ßá ‡¶Ø‡ßã‡¶ó‡¶æ‡¶Ø‡ßã‡¶ó ‡¶ï‡¶∞‡ßÅ‡¶® üöÄ');
  const [adminSavingNotice, setAdminSavingNotice] = useState(false);
  const [adminAudioMode, setAdminAudioMode] = useState<'tts' | 'custom'>('tts');
  const [adminCustomAudioUrl, setAdminCustomAudioUrl] = useState('');
  const [adminAudioFileName, setAdminAudioFileName] = useState('');
  const [adminAudioUploading, setAdminAudioUploading] = useState(false);
  const [adminIsRecording, setAdminIsRecording] = useState(false);
  const [adminRecordingDuration, setAdminRecordingDuration] = useState(0);
  const [adminAudioPlaying, setAdminAudioPlaying] = useState(false);
  const [adminSavingWelcome, setAdminSavingWelcome] = useState(false);

  const adminAudioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPass, setRegConfirmPass] = useState('');
  const [regNameErr, setRegNameErr] = useState('');
  const [regUserErr, setRegUserErr] = useState('');
  const [regEmailErr, setRegEmailErr] = useState('');
  const [regPassErr, setRegPassErr] = useState('');
  const [regConfirmErr, setRegConfirmErr] = useState('');

  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Main App State
  const [activeTab, setActiveTab] = useState<'home' | 'orders' | 'funds' | 'profile' | 'admin'>('home');
  const [userBalance, setUserBalance] = useState(0);
  const [userTotalOrders, setUserTotalOrders] = useState(0);
  const [userPhotoURL, setUserPhotoURL] = useState<string | null>(null);
  
  // Profile Name & Username Editing
  const [editUserName, setEditUserName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editUserUsername, setEditUserUsername] = useState('');
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editUserUsernameErr, setEditUserUsernameErr] = useState('');

  // Profile Change Password State
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState('');
  const [changePassErr, setChangePassErr] = useState('');
  const [changePassSuccess, setChangePassSuccess] = useState('');
  const [changePassSubmitting, setChangePassSubmitting] = useState(false);

  const [profileSubmitting, setProfileSubmitting] = useState(false);

  // Check if current logged in user is admin (rashal117)
  const isAdminUser = Boolean(
    currentUser && (
      currentUser.username?.toLowerCase() === 'rashal117' ||
      currentUser.name?.toLowerCase() === 'rashal117'
    )
  );

  // Home Page Order Form State
  const [allServices, setAllServices] = useState<ServiceData[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [currentService, setCurrentService] = useState<ServiceData | null>(null);
  const [targetLink, setTargetLink] = useState('');
  const [quantity, setQuantity] = useState<number>(100);
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  // Form Field Errors
  const [catErr, setCatErr] = useState('');
  const [svcErr, setSvcErr] = useState('');
  const [linkErr, setLinkErr] = useState('');
  const [qtyErr, setQtyErr] = useState('');

  // Orders State
  const [ordersList, setOrdersList] = useState<OrderData[]>([]);

  // Funds State
  const [selectedMethod, setSelectedMethod] = useState<string>('bkash');
  const [depositAmount, setDepositAmount] = useState<string>('100');
  const [depositStep, setDepositStep] = useState<'amount' | 'method' | 'gateway'>('amount');
  const [depositTrxId, setDepositTrxId] = useState<string>('');
  const [depositReceiptImage, setDepositReceiptImage] = useState<string>('');
  const [depositReceiptFileName, setDepositReceiptFileName] = useState<string>('');
  const [selectedScreenshotPreview, setSelectedScreenshotPreview] = useState<string | null>(null);
  const [depAmtErr, setDepAmtErr] = useState('');
  const [depTrxErr, setDepTrxErr] = useState('');
  const [depositSubmitting, setDepositSubmitting] = useState(false);
  const [depositHistory, setDepositHistory] = useState<DepositRequest[]>([]);
  const [allDepositRequests, setAllDepositRequests] = useState<DepositRequest[]>([]);
  const [gatewayTimeLeft, setGatewayTimeLeft] = useState<number>(900); // 15:00 minutes timer

  // Admin Site Logo & Branding Settings
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [isDraggingTelegramPhoto, setIsDraggingTelegramPhoto] = useState(false);
  const [uploadedLogoInfo, setUploadedLogoInfo] = useState<{ name: string; size: string; resolution?: string } | null>(null);
  const [uploadedTelegramPhotoInfo, setUploadedTelegramPhotoInfo] = useState<{ name: string; size: string } | null>(null);
  const [adminSiteLogo, setAdminSiteLogo] = useState<string>(() => localStorage.getItem('rf_smm_site_logo') || '');
  const [adminSiteLogoInput, setAdminSiteLogoInput] = useState<string>('');
  const [adminSavingLogo, setAdminSavingLogo] = useState<boolean>(false);

  // Admin New Payment Method Modal & Form State
  const [showAddMethodModal, setShowAddMethodModal] = useState(false);
  const [newMethodKey, setNewMethodKey] = useState('');
  const [newMethodLabel, setNewMethodLabel] = useState('');
  const [newMethodNumber, setNewMethodNumber] = useState('01840442809');
  const [newMethodType, setNewMethodType] = useState<'Send Money' | 'Cash Out' | 'Payment'>('Send Money');
  const [newMethodUssd, setNewMethodUssd] = useState('*247#');
  const [newMethodColor, setNewMethodColor] = useState('#e2136e');
  const [newMethodLogoUrl, setNewMethodLogoUrl] = useState('');
  const [newMethodIconType, setNewMethodIconType] = useState<PaymentMethodConfig['iconType']>('bkash');
  const [newMethodNote, setNewMethodNote] = useState('');

  // Admin Manual Service Form & Control State
  const [adminSubTab, setAdminSubTab] = useState<'users' | 'payment' | 'deposits' | 'orders' | 'services' | 'telegram' | 'notifications' | 'links' | 'welcome' | 'settings' | 'tasks' | 'referrals' | 'support'>('users');
  const [paymentMethodsConfig, setPaymentMethodsConfig] = useState<Record<string, PaymentMethodConfig>>({
    bkash: {
      id: 'bkash',
      label: 'bKash',
      number: '01840442809',
      type: 'Send Money',
      ussd: '*247#',
      color: '#e2136e',
      iconType: 'bkash',
      active: true,
      note: ''
    },
    rocket: {
      id: 'rocket',
      label: 'Rocket',
      number: '01840442809',
      type: 'Send Money',
      ussd: '*322#',
      color: '#8c3494',
      iconType: 'rocket',
      active: true,
      note: ''
    },
    nagad: {
      id: 'nagad',
      label: 'Nagad',
      number: '01840442809',
      type: 'Send Money',
      ussd: '*167#',
      color: '#ea580c',
      iconType: 'nagad',
      active: true,
      note: ''
    },
    upay: {
      id: 'upay',
      label: 'Upay',
      number: '01840442809',
      type: 'Send Money',
      ussd: '*268#',
      color: '#005696',
      iconType: 'upay',
      active: true,
      note: ''
    },
    binance: {
      id: 'binance',
      label: 'Binance',
      number: '584304364',
      type: 'Payment',
      ussd: 'Binance App',
      color: '#f0b90b',
      iconType: 'binance',
      isCrypto: true,
      active: false,
      note: '0.10$ = 12 TK ($1 = 120 TK)'
    }
  });
  const [editingPaymentMethods, setEditingPaymentMethods] = useState<Record<string, PaymentMethodConfig>>({});
  const [allUsersList, setAllUsersList] = useState<Array<{ uid: string; name?: string; balance?: number; total_orders?: number }>>([]);
  const [allAdminOrdersList, setAllAdminOrdersList] = useState<OrderData[]>([]);
  const [depFilter, setDepFilter] = useState<'all' | 'Pending' | 'Approved' | 'Rejected'>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [customDepAmounts, setCustomDepAmounts] = useState<{ [id: string]: string }>({});
  const [userBalanceAdjustInput, setUserBalanceAdjustInput] = useState<{ [uid: string]: string }>({});

  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastType, setBroadcastType] = useState<'system' | 'deposit' | 'promo'>('system');
  const [broadcastImage, setBroadcastImage] = useState<string | null>(null);

  const [newLinkName, setNewLinkName] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkIcon, setNewLinkIcon] = useState('fab fa-telegram');
  const [supportLinks, setSupportLinks] = useState<Array<{ id: string; name: string; url: string; icon: string }>>([
    { id: 'l1', name: 'Telegram Channel', url: 'https://t.me/RF2_SMM', icon: 'fab fa-telegram' },
    { id: 'l2', name: 'WhatsApp Support', url: 'https://wa.me/8801342163841', icon: 'fab fa-whatsapp' },
    { id: 'l3', name: 'Facebook Page', url: 'https://www.facebook.com/share/1EKKUHMxCw/', icon: 'fab fa-facebook' }
  ]);

  const [replyingMailId, setReplyingMailId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const [adminCategory, setAdminCategory] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPrice, setAdminPrice] = useState('');
  const [adminMin, setAdminMin] = useState('100');
  const [adminMax, setAdminMax] = useState('100000');
  const [adminDesc, setAdminDesc] = useState('');
  const [adminApiServiceId, setAdminApiServiceId] = useState('');
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminServiceSearch, setAdminServiceSearch] = useState('');
  const [adminServiceCategoryFilter, setAdminServiceCategoryFilter] = useState('ALL');
  const [adminQuickPriceInputs, setAdminQuickPriceInputs] = useState<Record<string, string>>({});
  const [adminUpdatingPriceId, setAdminUpdatingPriceId] = useState<string | null>(null);
  const [adminSubmitting, setAdminSubmitting] = useState(false);

  // Search Modal & Global Search State
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  // Notification System State
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    title: string;
    message: string;
    time: string;
    unread: boolean;
    type: 'order' | 'deposit' | 'system' | 'promo';
  }>>([
    {
      id: '1',
      title: 'Welcome to SMM Panel üöÄ',
      message: 'Instant automated delivery is enabled on all Facebook, TikTok & Telegram services!',
      time: 'Just now',
      unread: true,
      type: 'system'
    },
    {
      id: '2',
      title: 'Crypto Payments Active üí≥',
      message: 'You can now add funds using Binance Pay (UID: 584304364) or USDT BEP20.',
      time: '1 hour ago',
      unread: true,
      type: 'deposit'
    },
    {
      id: '3',
      title: 'Special Offer üéâ',
      message: 'Get 10% extra bonus balance on deposits of ‡ß≥1,000 or more!',
      time: 'Today',
      unread: false,
      type: 'promo'
    }
  ]);

  // Referral System State
  const [regReferralCode, setRegReferralCode] = useState('');
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [userTotalReferrals, setUserTotalReferrals] = useState(0);
  const [userReferralEarnings, setUserReferralEarnings] = useState(0);
  const [userReferralCommissions, setUserReferralCommissions] = useState<ReferralCommission[]>([]);
  const [allReferralCommissions, setAllReferralCommissions] = useState<ReferralCommission[]>([]);
  const [referralConfig, setReferralConfig] = useState<ReferralConfig>({
    enabled: true,
    bonusPercent: 5,
    websiteUrl: '',
  });
  const [adminSavingReferralConfig, setAdminSavingReferralConfig] = useState(false);

  // Live Orders & Tasks State
  const [showLiveOrdersModal, setShowLiveOrdersModal] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [liveOrdersFilter, setLiveOrdersFilter] = useState<'all' | 'my'>('all');
  const [claimedTasks, setClaimedTasks] = useState<string[]>([]);

  // Tasks & Screenshot Proof Submissions State
  const [allTaskSubmissions, setAllTaskSubmissions] = useState<TaskSubmission[]>([]);
  const [customTasks, setCustomTasks] = useState<TaskItem[]>([
    {
      id: 'task_tg',
      title: '1. Telegram ‡¶ö‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤‡ßá ‡¶ú‡ßü‡ßá‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®',
      description: '‡¶Ö‡¶´‡¶ø‡¶∏‡¶ø‡ßü‡¶æ‡¶≤ ‡¶ü‡ßá‡¶≤‡¶ø‡¶ó‡ßç‡¶∞‡¶æ‡¶Æ ‡¶ö‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤‡ßá ‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶π‡ßü‡ßá ‡¶ú‡ßü‡ßá‡¶® ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡¶∂‡¶ü ‡¶ì ‡¶Ü‡¶á‡¶°‡¶ø ‡¶ú‡¶Æ‡¶æ ‡¶¶‡¶ø‡¶®',
      reward: 5,
      link: 'https://t.me/RF2_SMM',
      icon: 'fab fa-telegram-plane'
    },
    {
      id: 'task_fb',
      title: '2. Facebook ‡¶™‡ßá‡¶ú ‡¶≤‡¶æ‡¶á‡¶ï ‡¶ì ‡¶´‡¶≤‡ßã ‡¶ï‡¶∞‡ßÅ‡¶®',
      description: '‡¶´‡ßá‡¶∏‡¶¨‡ßÅ‡¶ï ‡¶™‡ßá‡¶ú‡ßá ‡¶≤‡¶æ‡¶á‡¶ï ‡¶¶‡¶ø‡ßü‡ßá ‡¶´‡¶≤‡ßã ‡¶ï‡¶∞‡¶æ‡¶∞ ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡¶∂‡¶ü ‡¶¶‡¶ø‡¶®',
      reward: 5,
      link: 'https://www.facebook.com/share/1EKKUHMxCw/',
      icon: 'fab fa-facebook'
    },
    {
      id: 'task_yt',
      title: '3. YouTube ‡¶ö‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤ ‡¶∏‡¶æ‡¶¨‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶æ‡¶á‡¶¨ ‡¶ï‡¶∞‡ßÅ‡¶®',
      description: '‡¶á‡¶â‡¶ü‡¶ø‡¶â‡¶¨ ‡¶ö‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤ ‡¶∏‡¶æ‡¶¨‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶æ‡¶á‡¶¨ ‡¶ï‡¶∞‡ßá ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡¶∂‡¶ü ‡¶¶‡¶ø‡¶®',
      reward: 5,
      link: 'https://youtube.com',
      icon: 'fab fa-youtube'
    }
  ]);
  const [selectedTaskForProof, setSelectedTaskForProof] = useState<TaskItem | null>(null);
  const [taskProofNotes, setTaskProofNotes] = useState('');
  const [taskProofScreenshots, setTaskProofScreenshots] = useState<string[]>([]);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [adminTaskFilter, setAdminTaskFilter] = useState<'all' | 'Pending' | 'Approved' | 'Rejected'>('all');

  // Admin New Task Creation State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskReward, setNewTaskReward] = useState('5');
  const [newTaskLink, setNewTaskLink] = useState('');
  const [newTaskIcon, setNewTaskIcon] = useState('fas fa-tasks');
  const [newTaskImage, setNewTaskImage] = useState<string | null>(null);

  // Mailbox System State
  const [showMailboxModal, setShowMailboxModal] = useState(false);
  const [mailboxTab, setMailboxTab] = useState<'inbox' | 'compose'>('inbox');
  const [mailSubject, setMailSubject] = useState('');
  const [mailMessage, setMailMessage] = useState('');
  const [mailSubmitting, setMailSubmitting] = useState(false);
  const [mailList, setMailList] = useState<Array<{
    id: string;
    sender: string;
    subject: string;
    message: string;
    time: string;
    unread: boolean;
    isAdminReply?: boolean;
  }>>([
    {
      id: 'm1',
      sender: 'Admin Support',
      subject: 'Welcome to SMM Panel Support',
      message: 'Hello! Thank you for joining us. If you need custom packages or support, reply here or contact us via Telegram.',
      time: 'Today 10:00 AM',
      unread: true,
      isAdminReply: true
    },
    {
      id: 'm2',
      sender: 'System Notice',
      subject: 'Order Completion Speed Notice',
      message: 'Facebook Followers & TikTok Views start within 1-5 minutes of placing your order.',
      time: 'Yesterday',
      unread: false,
      isAdminReply: true
    }
  ]);

  // Modal Confirm State
  const [modalConfig, setModalConfig] = useState<{
    show: boolean;
    title: string;
    bodyHtml: React.ReactNode;
    onConfirm: () => void;
  }>({
    show: false,
    title: '',
    bodyHtml: null,
    onConfirm: () => {}
  });

  // Toasts
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: string }>>([]);

  const tg = (window as any).Telegram?.WebApp || null;

  // Haptic Feedback Helper
  const haptic = (type: 'light' | 'heavy' | 'success' | 'error' = 'light') => {
    if (!tg?.HapticFeedback) return;
    try {
      if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
      else if (type === 'error') tg.HapticFeedback.notificationOccurred('error');
      else if (type === 'heavy') tg.HapticFeedback.impactOccurred('heavy');
      else tg.HapticFeedback.impactOccurred('light');
    } catch (_) {}
  };

  const showToast = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  };

  // Claim Task Reward Handler
  const handleClaimTask = async (taskId: string, rewardAmt: number, taskTitle: string) => {
    if (claimedTasks.includes(taskId)) {
      showToast('You have already claimed this task reward!', 'info');
      return;
    }
    if (!currentUser) {
      showToast('Please login to claim tasks', 'error');
      return;
    }

    try {
      const newBal = userBalance + rewardAmt;
      await updateDoc(doc(db, 'users', currentUser.uid), {
        balance: newBal
      });
      setUserBalance(newBal);
      setClaimedTasks((prev) => [...prev, taskId]);
      showToast(`üéâ ‡ß≥${rewardAmt} added for completing "${taskTitle}"!`, 'success');
      haptic('success');
    } catch (e: any) {
      console.error('Task claim error:', e);
      setUserBalance((prev) => prev + rewardAmt);
      setClaimedTasks((prev) => [...prev, taskId]);
      showToast(`üéâ ‡ß≥${rewardAmt} added to your balance!`, 'success');
      haptic('success');
    }
  };

  // Simple Password Hash
  const simpleHash = async (str: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(str + 'firstsmm_salt_2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  // 1. Initial Load & Seamless Telegram Auto-Login
  useEffect(() => {
    if (tg) {
      try {
        tg.ready();
        tg.expand();
        if (typeof tg.setHeaderColor === 'function') tg.setHeaderColor('#030712');
        if (typeof tg.setBackgroundColor === 'function') tg.setBackgroundColor('#030712');
        if (typeof tg.enableClosingConfirmation === 'function') tg.enableClosingConfirmation();
      } catch (err) {
        console.log('Telegram WebApp ready note:', err);
      }
    }

    // Auto-detect referral code from URL query parameters (?ref=username or ?r=username) or Telegram start_param
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const refCode = urlParams.get('ref') || urlParams.get('r') || (tg?.initDataUnsafe?.start_param ? String(tg.initDataUnsafe.start_param) : null);
      if (refCode && refCode.trim()) {
        const cleanRef = refCode.trim().toLowerCase();
        localStorage.setItem('smm_referral_ref', cleanRef);
        setRegReferralCode(cleanRef);
      } else {
        const savedRef = localStorage.getItem('smm_referral_ref');
        if (savedRef) {
          setRegReferralCode(savedRef.trim().toLowerCase());
        }
      }
    } catch (err) {
      console.log('Referral param parsing note:', err);
    }

    // Telegram Auto Authentication Helper
    const performTelegramAutoAuth = async (tgUser: any, startParam?: string): Promise<UserSession | null> => {
      if (!tgUser || !tgUser.id) return null;
      const tgId = Number(tgUser.id);
      const rawUsername = tgUser.username ? String(tgUser.username).trim().toLowerCase().replace(/[^a-z0-9_]/g, '') : '';
      const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').trim() || rawUsername || `User ${tgId}`;
      const photoUrl = tgUser.photo_url || '';

      try {
        // Step A: Check if existing auth_user exists with this telegramId
        const qTg = query(collection(db, 'auth_users'), where('telegramId', '==', tgId));
        const tgSnap = await getDocs(qTg);
        if (!tgSnap.empty) {
          const docData = tgSnap.docs[0].data();
          const docId = tgSnap.docs[0].id;
          return {
            uid: docId,
            username: docData.username || rawUsername || `tg_${tgId}`,
            name: docData.name || fullName,
            email: docData.email || `${rawUsername || tgId}@telegram.user`,
            photoURL: docData.photoURL || photoUrl || '',
            referredBy: docData.referredBy || null,
            referredByUsername: docData.referredByUsername || null,
          };
        }

        // Step B: If username matches an existing account (e.g., rashal117)
        if (rawUsername) {
          const qUser = query(collection(db, 'auth_users'), where('username', '==', rawUsername));
          const userSnap = await getDocs(qUser);
          if (!userSnap.empty) {
            const docData = userSnap.docs[0].data();
            const docId = userSnap.docs[0].id;
            try {
              await updateDoc(doc(db, 'auth_users', docId), { telegramId: tgId });
            } catch (_) {}
            return {
              uid: docId,
              username: docData.username || rawUsername,
              name: docData.name || fullName,
              email: docData.email || `${rawUsername}@telegram.user`,
              photoURL: docData.photoURL || photoUrl || '',
              referredBy: docData.referredBy || null,
              referredByUsername: docData.referredByUsername || null,
            };
          }
        }

        // Step C: Check direct UID 'tg_<id>'
        const directUid = `tg_${tgId}`;
        const directDoc = await getDoc(doc(db, 'auth_users', directUid));
        if (directDoc.exists()) {
          const docData = directDoc.data();
          return {
            uid: directUid,
            username: docData.username || rawUsername || `tg_${tgId}`,
            name: docData.name || fullName,
            email: docData.email || `${rawUsername || tgId}@telegram.user`,
            photoURL: docData.photoURL || photoUrl || '',
            referredBy: docData.referredBy || null,
            referredByUsername: docData.referredByUsername || null,
          };
        }

        // Step D: Auto Register new Telegram User
        let targetUsername = rawUsername || `tg_${tgId}`;
        if (targetUsername.length < 3) targetUsername = `tg_${tgId}`;
        
        // Ensure username uniqueness
        try {
          const qCheck = query(collection(db, 'auth_users'), where('username', '==', targetUsername));
          const snapCheck = await getDocs(qCheck);
          if (!snapCheck.empty) {
            targetUsername = `${targetUsername}_${String(tgId).slice(-4)}`;
          }
        } catch (_) {}

        // Handle referral
        let referrerUid: string | null = null;
        let referrerUsername: string | null = null;
        const refCandidate = (startParam || localStorage.getItem('smm_referral_ref') || '').trim().toLowerCase();
        if (refCandidate && refCandidate !== targetUsername) {
          try {
            const qRef = query(collection(db, 'auth_users'), where('username', '==', refCandidate));
            const refSnap = await getDocs(qRef);
            if (!refSnap.empty) {
              referrerUid = refSnap.docs[0].id;
              referrerUsername = refSnap.docs[0].data().username || refCandidate;
            } else {
              const uDoc = await getDoc(doc(db, 'users', refCandidate));
              if (uDoc.exists()) {
                referrerUid = refCandidate;
                referrerUsername = uDoc.data().name || 'Referrer';
              }
            }
          } catch (_) {}
        }

        const userEmail = `${targetUsername}@telegram.user`;
        await setDoc(doc(db, 'auth_users', directUid), {
          username: targetUsername,
          name: fullName,
          email: userEmail,
          password: 'telegram_auto_auth',
          telegramId: tgId,
          photoURL: photoUrl,
          referredBy: referrerUid,
          referredByUsername: referrerUsername,
          createdAt: serverTimestamp(),
        });

        await setDoc(doc(db, 'users', directUid), {
          name: fullName,
          username: targetUsername,
          email: userEmail,
          balance: 0,
          total_orders: 0,
          totalReferrals: 0,
          totalReferralEarnings: 0,
          photoURL: photoUrl,
          referredBy: referrerUid,
          referredByUsername: referrerUsername,
          createdAt: serverTimestamp(),
        });

        if (referrerUid) {
          try {
            const refUserDoc = doc(db, 'users', referrerUid);
            const refUserSnap = await getDoc(refUserDoc);
            if (refUserSnap.exists()) {
              const curRefs = refUserSnap.data().totalReferrals || 0;
              await updateDoc(refUserDoc, { totalReferrals: curRefs + 1 });
            }
          } catch (_) {}
        }

        return {
          uid: directUid,
          username: targetUsername,
          name: fullName,
          email: userEmail,
          photoURL: photoUrl,
          referredBy: referrerUid,
          referredByUsername: referrerUsername,
        };
      } catch (authErr) {
        console.error('Telegram auto auth error:', authErr);
        return null;
      }
    };

    const initApp = async () => {
      let sessionEstablished = false;

      // 1. Try restoring existing localStorage session
      try {
        const saved = localStorage.getItem('smm_session');
        if (saved) {
          const session = JSON.parse(saved);
          if (session.uid && session.username) {
            const uSnap = await getDoc(doc(db, 'auth_users', session.uid));
            if (uSnap.exists()) {
              setCurrentUser(session);
              if (session.photoURL) setUserPhotoURL(session.photoURL);
              setIsLoggedIn(true);
              sessionEstablished = true;
            } else {
              localStorage.removeItem('smm_session');
            }
          }
        }
      } catch (_) {
        localStorage.removeItem('smm_session');
      }

      // 2. If not logged in, Check if Telegram WebApp User is present (Seamless Auto Login)
      if (!sessionEstablished && tg?.initDataUnsafe?.user) {
        try {
          const tgSession = await performTelegramAutoAuth(
            tg.initDataUnsafe.user,
            tg.initDataUnsafe.start_param ? String(tg.initDataUnsafe.start_param) : undefined
          );
          if (tgSession) {
            localStorage.setItem('smm_session', JSON.stringify(tgSession));
            setCurrentUser(tgSession);
            if (tgSession.photoURL) setUserPhotoURL(tgSession.photoURL);
            setIsLoggedIn(true);
            sessionEstablished = true;
            haptic('success');
            showToast(`‚ö° ‡¶∏‡ßç‡¶¨‡¶æ‡¶ó‡¶§‡¶Æ @${tgSession.username}! ‡¶ü‡ßá‡¶≤‡¶ø‡¶ó‡ßç‡¶∞‡¶æ‡¶Æ ‡¶Ö‡¶ü‡ßã ‡¶≤‡¶ó‡¶á‡¶® ‡¶∏‡¶´‡¶≤ ‡¶π‡ßü‡ßá‡¶õ‡ßá`, 'success');
          }
        } catch (tgErr) {
          console.error('Telegram auto login init error:', tgErr);
        }
      }

      if (sessionEstablished) {
        setShowWelcomeModal(true);
      }

      setTimeout(() => {
        setShowSplash(false);
      }, 1500);
    };

    initApp();
  }, []);

  // 2. Realtime User Info Sync
  useEffect(() => {
    if (!isLoggedIn || !currentUser?.uid) return;
    const currentUid = currentUser.uid;
    const currentName = currentUser.name;
    const currentPhoto = currentUser.photoURL;

    const userRef = doc(db, 'users', currentUid);

    // Initialize user doc if missing
    getDoc(userRef).then(async (snap) => {
      if (!snap.exists()) {
        await setDoc(userRef, {
          name: currentName || 'User',
          balance: 0,
          total_orders: 0,
          totalReferrals: 0,
          totalReferralEarnings: 0,
          photoURL: currentPhoto || '',
          createdAt: serverTimestamp()
        });
      }
    });

    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        const bal = typeof d.balance === 'number' ? d.balance : 0;
        const ord = typeof d.total_orders === 'number' ? d.total_orders : 0;
        const refs = typeof d.totalReferrals === 'number' ? d.totalReferrals : 0;
        const earn = typeof d.totalReferralEarnings === 'number' ? d.totalReferralEarnings : 0;

        setUserBalance((prev) => (prev !== bal ? bal : prev));
        setUserTotalOrders((prev) => (prev !== ord ? ord : prev));
        setUserTotalReferrals((prev) => (prev !== refs ? refs : prev));
        setUserReferralEarnings((prev) => (prev !== earn ? earn : prev));
        if (d.photoURL) {
          setUserPhotoURL((prev) => (prev !== d.photoURL ? d.photoURL : prev));
        }
        if (d.name) {
          setCurrentUser((prev) => {
            if (!prev) return prev;
            if (prev.name === d.name && (!d.photoURL || prev.photoURL === d.photoURL)) {
              return prev;
            }
            return { ...prev, name: d.name, photoURL: d.photoURL || prev?.photoURL };
          });
        }
      }
    });

    return () => unsubscribe();
  }, [isLoggedIn, currentUser?.uid]);

  // 3. Realtime Services Loading (Pure Read - No Auto Save or Auto Seed)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'services'), (snapshot) => {
      const list: ServiceData[] = [];
      const catsSet = new Set<string>();

      snapshot.forEach((d) => {
        const data = { id: d.id, ...d.data() } as ServiceData;
        list.push(data);
        if (data.category) catsSet.add(data.category);
      });

      setAllServices(list);
      setCategories(Array.from(catsSet).sort());
    }, (err) => {
      console.warn('Services sync notice:', err.message);
    });

    return () => unsub();
  }, []);

  // 4. Realtime Orders Sync
  useEffect(() => {
    if (!isLoggedIn || !currentUser?.uid) return;

    const q = query(collection(db, 'orders'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: OrderData[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.uid === currentUser.uid) {
          list.push({ id: docSnap.id, ...data } as OrderData);
        }
      });
      setOrdersList(list);
    }, (err) => {
      console.warn('Orders sync notice:', err.message);
    });

    return () => unsub();
  }, [isLoggedIn, currentUser?.uid]);

  // 5. Realtime User Deposit Requests Sync
  useEffect(() => {
    if (!isLoggedIn || !currentUser?.uid) return;

    const q = query(
      collection(db, 'deposit_requests'),
      where('uid', '==', currentUser.uid)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: DepositRequest[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as DepositRequest);
        });
        // Client-side sort descending by timestamp avoids Firestore composite index requirement
        list.sort((a, b) => {
          const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
          const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
          return timeB - timeA;
        });
        setDepositHistory(list);
      },
      (err) => {
        console.warn('Deposit history sync notice:', err.message);
      }
    );

    return () => unsub();
  }, [isLoggedIn, currentUser?.uid]);

  // 6. Realtime All Deposit Requests Sync (Admin View)
  useEffect(() => {
    const q = query(collection(db, 'deposit_requests'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: DepositRequest[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as DepositRequest);
      });
      setAllDepositRequests(list);
    }, (err) => {
      console.warn('All deposit requests sync notice:', err.message);
    });
    return () => unsub();
  }, []);

  // 7. Realtime All Users Sync (Admin View)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list: Array<{ uid: string; name?: string; balance?: number; total_orders?: number }> = [];
      snapshot.forEach((docSnap) => {
        list.push({ uid: docSnap.id, ...docSnap.data() });
      });
      setAllUsersList(list);
    });
    return () => unsub();
  }, []);

  // 8. Realtime All Orders Sync (Admin View)
  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: OrderData[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as OrderData);
      });
      setAllAdminOrdersList(list);
    }, (err) => {
      console.warn('All admin orders sync notice:', err.message);
    });
    return () => unsub();
  }, []);

  // 9. Realtime Task Submissions & Custom Tasks Sync
  useEffect(() => {
    const unsubSubmissions = onSnapshot(collection(db, 'task_submissions'), (snapshot) => {
      const list: TaskSubmission[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as TaskSubmission);
      });
      // Sort newest first
      list.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
      setAllTaskSubmissions(list);
    });

    const unsubTasks = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      if (!snapshot.empty) {
        const tList: TaskItem[] = [];
        snapshot.forEach((docSnap) => {
          tList.push({ id: docSnap.id, ...docSnap.data() } as TaskItem);
        });
        setCustomTasks(tList);
      }
    });

    return () => {
      unsubSubmissions();
      unsubTasks();
    };
  }, []);

  // 10. Realtime Referral Config & Commissions Sync
  useEffect(() => {
    // Sync Telegram Order Notification Config
    const unsubTg = onSnapshot(doc(db, 'settings', 'telegram_config'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const conf: TelegramConfig = {
          enabled: d.enabled !== false,
          botToken: d.botToken || '8417495766:AAEupqJEr6_IyvOcGXhhdWStj95khUdr8MU',
          channels: d.channels || '@RF2_SMM, @FARJU_SMM_PANAL',
          customPhotoUrl: d.customPhotoUrl || '',
          captionStyle: d.captionStyle || 'vip',
          customHeader: d.customHeader || '',
          customFooter: d.customFooter || '',
          miniAppUrl: d.miniAppUrl || 'https://t.me/RF_SMM_PRO_BOT?startapp=8479465879',
        };
        setTelegramConfig(conf);
        setAdminTelegramEnabled(conf.enabled);
        setAdminTelegramBotToken(conf.botToken);
        setAdminTelegramChannels(conf.channels);
        setAdminTelegramPhotoUrl(conf.customPhotoUrl || '');
        setAdminTelegramMiniAppUrl(conf.miniAppUrl || 'https://t.me/RF_SMM_PRO_BOT?startapp=8479465879');
        setAdminTelegramStyle(conf.captionStyle || 'vip');
        setAdminTelegramHeader(conf.customHeader || '');
        setAdminTelegramFooter(conf.customFooter || '');
      }
    }, (err) => console.log('Telegram config sync error:', err.message));

    // Sync Referral Config
    const unsubCfg = onSnapshot(doc(db, 'settings', 'referral_config'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setReferralConfig({
          enabled: d.enabled !== false,
          bonusPercent: typeof d.bonusPercent === 'number' ? d.bonusPercent : 5,
          websiteUrl: d.websiteUrl || '',
        });
      }
    });

    // Sync All Referral Commissions (for Admin)
    const qAll = query(collection(db, 'referral_commissions'), orderBy('timestamp', 'desc'));
    const unsubAll = onSnapshot(qAll, (snap) => {
      const list: ReferralCommission[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as ReferralCommission));
      setAllReferralCommissions(list);
    }, (err) => {
      console.log('Admin referral commissions sync:', err.message);
    });

    return () => {
      unsubCfg();
      unsubAll();
    };
  }, []);

  // 11. Realtime Current User Referral Commissions & Stats Sync
  useEffect(() => {
    if (!isLoggedIn || !currentUser?.uid) return;
    const qUser = query(
      collection(db, 'referral_commissions'),
      where('referrerUid', '==', currentUser.uid)
    );
    const unsub = onSnapshot(qUser, (snap) => {
      const list: ReferralCommission[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as ReferralCommission));
      list.sort((a, b) => {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return timeB - timeA;
      });
      setUserReferralCommissions(list);
      const earned = list.reduce((sum, item) => sum + (item.commissionAmount || 0), 0);
      setUserReferralEarnings(earned);
    }, (err) => {
      console.log('User referral commissions sync:', err.message);
    });
    return () => unsub();
  }, [isLoggedIn, currentUser?.uid]);

  // Sync user total referrals count from allUsersList
  useEffect(() => {
    if (!currentUser?.uid) return;
    const myUid = currentUser.uid;
    const myUsername = (currentUser.username || '').toLowerCase();
    const count = allUsersList.filter(
      (u: any) =>
        (u.referredBy && (u.referredBy === myUid || u.referredBy.toLowerCase() === myUsername)) ||
        (u.referredByUsername && u.referredByUsername.toLowerCase() === myUsername)
    ).length;
    setUserTotalReferrals((prev) => (prev !== count ? count : prev));
  }, [allUsersList, currentUser?.uid, currentUser?.username]);

  // 10. Realtime Gateway Countdown Timer
  useEffect(() => {
    if (depositStep !== 'gateway') {
      setGatewayTimeLeft(900);
      return;
    }
    const interval = setInterval(() => {
      setGatewayTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [depositStep]);

  const formatGatewayTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Screenshot File Selection Handler (Up to 5 Screenshots)
  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentCount = taskProofScreenshots.length;
    if (currentCount >= 5) {
      showToast('Maximum 5 screenshots allowed per task proof!', 'warning');
      return;
    }

    const remainingSlots = 5 - currentCount;
    const selectedFiles: File[] = Array.from(files).slice(0, remainingSlots) as File[];

    try {
      const base64Results: string[] = [];
      for (const file of selectedFiles) {
        const compressed = await compressImageToBase64(file);
        base64Results.push(compressed);
      }
      setTaskProofScreenshots((prev) => [...prev, ...base64Results]);
      showToast(`Added ${base64Results.length} screenshot(s)!`, 'success');
      haptic('light');
    } catch (err) {
      console.error('Error uploading screenshots:', err);
      showToast('Failed to process screenshot image', 'error');
    }
  };

  const handleRemoveScreenshot = (index: number) => {
    setTaskProofScreenshots((prev) => prev.filter((_, i) => i !== index));
    haptic('heavy');
  };

  // Submit Task Proof Handler with up to 5 Screenshots
  const handleSubmitTaskProof = async () => {
    if (!selectedTaskForProof) return;
    if (!currentUser) {
      showToast('Please login to submit task proof', 'error');
      return;
    }
    if (!taskProofNotes.trim() && taskProofScreenshots.length === 0) {
      showToast('Please write proof details or upload at least 1 screenshot!', 'error');
      return;
    }

    setTaskSubmitting(true);
    try {
      const newSubmissionDoc = {
        taskId: selectedTaskForProof.id,
        taskTitle: selectedTaskForProof.title,
        reward: selectedTaskForProof.reward,
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email || 'User',
        proofText: taskProofNotes.trim(),
        screenshots: taskProofScreenshots,
        status: 'Pending',
        submittedAt: new Date().toLocaleString()
      };

      const docRef = await addDoc(collection(db, 'task_submissions'), newSubmissionDoc);

      setAllTaskSubmissions((prev) => [{ id: docRef.id, ...newSubmissionDoc } as TaskSubmission, ...prev]);

      showToast('üéâ Task proof submitted with screenshots! Waiting for admin review.', 'success');
      haptic('success');
      setSelectedTaskForProof(null);
      setTaskProofNotes('');
      setTaskProofScreenshots([]);
    } catch (e: any) {
      console.error('Error submitting task proof:', e);
      showToast('Failed to submit proof: ' + e.message, 'error');
    } finally {
      setTaskSubmitting(false);
    }
  };

  // Admin Actions: Approve Task Submission & Credit Balance
  const handleApproveTaskSubmission = async (sub: TaskSubmission) => {
    try {
      await updateDoc(doc(db, 'task_submissions', sub.id), {
        status: 'Approved',
        approvedAt: serverTimestamp()
      });

      const uSnap = await getDoc(doc(db, 'users', sub.userId));
      const currBal = uSnap.exists() ? (uSnap.data().balance || 0) : 0;
      const newBal = currBal + sub.reward;

      await updateDoc(doc(db, 'users', sub.userId), {
        balance: newBal
      });

      setAllTaskSubmissions((prev) =>
        prev.map((item) => (item.id === sub.id ? { ...item, status: 'Approved' } : item))
      );

      showToast(`‚úÖ Approved proof & credited ‡ß≥${sub.reward} to user ${sub.userName}!`, 'success');
      haptic('success');
    } catch (e: any) {
      console.error('Error approving task proof:', e);
      showToast('Failed to approve task proof: ' + e.message, 'error');
    }
  };

  // Admin Actions: Reject Task Submission
  const handleRejectTaskSubmission = async (subId: string) => {
    try {
      await updateDoc(doc(db, 'task_submissions', subId), {
        status: 'Rejected',
        rejectedAt: serverTimestamp()
      });

      setAllTaskSubmissions((prev) =>
        prev.map((item) => (item.id === subId ? { ...item, status: 'Rejected' } : item))
      );

      showToast('Task submission rejected', 'warning');
      haptic('heavy');
    } catch (e: any) {
      console.error('Error rejecting task proof:', e);
      showToast('Failed to reject task submission.', 'error');
    }
  };

  // Admin Image Upload Handlers
  const handleAdminTaskImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToBase64(file);
      setNewTaskImage(compressed);
      showToast('‚úÖ Task image attached successfully!', 'success');
      haptic('light');
    } catch (err) {
      console.error('Error uploading task image:', err);
      showToast('Failed to process image file', 'error');
    }
  };

  const handleAdminBroadcastImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToBase64(file);
      setBroadcastImage(compressed);
      showToast('‚úÖ Broadcast banner image attached!', 'success');
      haptic('light');
    } catch (err) {
      console.error('Error uploading broadcast image:', err);
      showToast('Failed to process image file', 'error');
    }
  };

  // Profile Picture Upload Handler
  const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.uid) return;

    try {
      setProfileSubmitting(true);
      const compressed = await compressImageToBase64(file);
      setUserPhotoURL(compressed);

      // Update Firestore user document
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, { photoURL: compressed }, { merge: true });

      // Update local session
      const updatedUser = { ...currentUser, photoURL: compressed };
      setCurrentUser(updatedUser);
      localStorage.setItem('smm_session', JSON.stringify(updatedUser));

      showToast('‚úÖ ‡¶™‡ßç‡¶∞‡ßã‡¶´‡¶æ‡¶á‡¶≤ ‡¶™‡¶ø‡¶ï‡¶ö‡¶æ‡¶∞ ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶Ü‡¶™‡¶°‡ßá‡¶ü ‡¶π‡ßü‡ßá‡¶õ‡ßá!', 'success');
      haptic('success');
    } catch (err: any) {
      console.error('Error updating profile photo:', err);
      showToast('Failed to update profile photo', 'error');
    } finally {
      setProfileSubmitting(false);
    }
  };

  // Remove Profile Photo
  const handleRemoveProfilePic = async () => {
    if (!currentUser?.uid) return;

    try {
      setProfileSubmitting(true);
      setUserPhotoURL(null);

      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, { photoURL: '' }, { merge: true });

      const updatedUser = { ...currentUser, photoURL: '' };
      setCurrentUser(updatedUser);
      localStorage.setItem('smm_session', JSON.stringify(updatedUser));

      showToast('‡¶™‡ßç‡¶∞‡ßã‡¶´‡¶æ‡¶á‡¶≤ ‡¶™‡¶ø‡¶ï‡¶ö‡¶æ‡¶∞ ‡¶∏‡¶∞‡¶æ‡¶®‡ßã ‡¶π‡ßü‡ßá‡¶õ‡ßá', 'info');
      haptic('light');
    } catch (err) {
      console.error('Error removing profile photo:', err);
    } finally {
      setProfileSubmitting(false);
    }
  };

  // Update Display Name
  const handleUpdateUserName = async () => {
    if (!editUserName.trim() || !currentUser?.uid) return;

    try {
      setProfileSubmitting(true);
      const newName = editUserName.trim();

      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, { name: newName }, { merge: true });

      const updatedUser = { ...currentUser, name: newName };
      setCurrentUser(updatedUser);
      localStorage.setItem('smm_session', JSON.stringify(updatedUser));

      setIsEditingName(false);
      showToast('‚úÖ ‡¶®‡¶æ‡¶Æ ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶ø‡¶§ ‡¶π‡ßü‡ßá‡¶õ‡ßá!', 'success');
      haptic('success');
    } catch (err) {
      console.error('Error updating name:', err);
      showToast('Failed to update name', 'error');
    } finally {
      setProfileSubmitting(false);
    }
  };

  // Update Username (‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶®‡¶æ‡¶Æ ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶®)
  const handleUpdateUserUsername = async () => {
    if (!currentUser?.uid) return;
    setEditUserUsernameErr('');
    const newUsername = editUserUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (!newUsername || newUsername.length < 3) {
      setEditUserUsernameErr('‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶®‡¶æ‡¶Æ ‡¶ï‡¶Æ‡¶™‡¶ï‡ßç‡¶∑‡ßá ‡ß© ‡¶Ö‡¶ï‡ßç‡¶∑‡¶∞‡ßá‡¶∞ ‡¶π‡¶§‡ßá ‡¶π‡¶¨‡ßá (letters, numbers, _)');
      haptic('error');
      return;
    }
    if (newUsername === currentUser.username?.toLowerCase()) {
      setIsEditingUsername(false);
      return;
    }

    try {
      setProfileSubmitting(true);
      haptic('light');

      // Check if username is already taken by someone else
      const qCheck = query(collection(db, 'auth_users'), where('username', '==', newUsername));
      const snapCheck = await getDocs(qCheck);
      const isTaken = snapCheck.docs.some((d) => d.id !== currentUser.uid);

      if (isTaken) {
        setEditUserUsernameErr('‡¶è‡¶á ‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶®‡¶æ‡¶Æ‡¶ü‡¶ø ‡¶Ö‡¶®‡ßç‡¶Ø ‡¶ï‡ßá‡¶â ‡¶¨‡ßç‡¶Ø‡¶¨‡¶π‡¶æ‡¶∞ ‡¶ï‡¶∞‡¶õ‡ßá! ‡¶Ö‡¶®‡ßç‡¶Ø ‡¶®‡¶æ‡¶Æ ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®‡•§');
        haptic('error');
        return;
      }

      // Update in users collection
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, { username: newUsername }, { merge: true });

      // Update in auth_users collection
      const authUserRef = doc(db, 'auth_users', currentUser.uid);
      await setDoc(authUserRef, { username: newUsername }, { merge: true });

      const updatedUser = { ...currentUser, username: newUsername };
      setCurrentUser(updatedUser);
      localStorage.setItem('smm_session', JSON.stringify(updatedUser));

      setIsEditingUsername(false);
      showToast('‚úÖ ‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶®‡¶æ‡¶Æ ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶ø‡¶§ ‡¶π‡ßü‡ßá‡¶õ‡ßá!', 'success');
      haptic('success');
    } catch (err: any) {
      console.error('Error updating username:', err);
      setEditUserUsernameErr('‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶®‡¶æ‡¶Æ ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶®‡ßá ‡¶∏‡¶Æ‡¶∏‡ßç‡¶Ø‡¶æ: ' + (err.message || 'Error'));
      haptic('error');
    } finally {
      setProfileSubmitting(false);
    }
  };

  // Change Password (‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶° ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶®)
  const handleChangePassword = async () => {
    if (!currentUser?.uid) return;
    setChangePassErr('');
    setChangePassSuccess('');

    if (!currentPasswordInput) {
      setChangePassErr('‡¶¨‡¶∞‡ßç‡¶§‡¶Æ‡¶æ‡¶® ‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶° ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶® (Current password required)');
      haptic('error');
      return;
    }
    if (!newPasswordInput || newPasswordInput.length < 6) {
      setChangePassErr('‡¶®‡¶§‡ßÅ‡¶® ‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶° ‡¶ï‡¶Æ‡¶™‡¶ï‡ßç‡¶∑‡ßá ‡ß¨ ‡¶Ö‡¶ï‡ßç‡¶∑‡¶∞‡ßá‡¶∞ ‡¶π‡¶§‡ßá ‡¶π‡¶¨‡ßá (Min 6 chars)');
      haptic('error');
      return;
    }
    if (newPasswordInput !== confirmNewPasswordInput) {
      setChangePassErr('‡¶®‡¶§‡ßÅ‡¶® ‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶° ‡¶¶‡ßÅ‡¶ü‡¶ø ‡¶Æ‡¶ø‡¶≤‡¶õ‡ßá ‡¶®‡¶æ (Passwords do not match)');
      haptic('error');
      return;
    }

    try {
      setChangePassSubmitting(true);
      haptic('light');

      const authUserRef = doc(db, 'auth_users', currentUser.uid);
      const authSnap = await getDoc(authUserRef);

      if (!authSnap.exists()) {
        setChangePassErr('‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶è‡¶ï‡¶æ‡¶â‡¶®‡ßç‡¶ü ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶Ø‡¶æ‡ßü‡¶®‡¶ø');
        haptic('error');
        return;
      }

      const authData = authSnap.data();
      const hashedCurrent = await simpleHash(currentPasswordInput);

      if (authData.password && authData.password !== hashedCurrent) {
        setChangePassErr('‡¶¨‡¶∞‡ßç‡¶§‡¶Æ‡¶æ‡¶® ‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶°‡¶ü‡¶ø ‡¶∏‡¶†‡¶ø‡¶ï ‡¶®‡ßü (Incorrect current password)');
        haptic('error');
        return;
      }

      const hashedNew = await simpleHash(newPasswordInput);
      await updateDoc(authUserRef, {
        password: hashedNew,
        passwordUpdatedAt: serverTimestamp()
      });

      setChangePassSuccess('‚úÖ ‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶° ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶ø‡¶§ ‡¶π‡ßü‡ßá‡¶õ‡ßá!');
      showToast('‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶° ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶ø‡¶§ ‡¶π‡ßü‡ßá‡¶õ‡ßá! üîí', 'success');
      haptic('success');
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmNewPasswordInput('');
      setTimeout(() => {
        setShowChangePassModal(false);
        setChangePassSuccess('');
      }, 1500);
    } catch (err: any) {
      console.error('Error changing password:', err);
      setChangePassErr('‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶° ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶®‡ßá ‡¶∏‡¶Æ‡¶∏‡ßç‡¶Ø‡¶æ: ' + (err.message || 'Error'));
      haptic('error');
    } finally {
      setChangePassSubmitting(false);
    }
  };

  // Admin Actions: Create Custom Task
  const handleCreateAdminTask = async () => {
    if (!newTaskTitle.trim()) {
      showToast('Please enter task title', 'error');
      return;
    }
    const rewardVal = parseFloat(newTaskReward) || 5;

    const newTaskDoc = {
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim() || 'Complete task & submit screenshot proof',
      reward: rewardVal,
      link: newTaskLink.trim() || '#',
      icon: newTaskIcon || 'fas fa-tasks',
      image: newTaskImage || ''
    };

    try {
      const docRef = await addDoc(collection(db, 'tasks'), newTaskDoc);
      setCustomTasks((prev) => [{ id: docRef.id, ...newTaskDoc }, ...prev]);
      showToast('‚úÖ New task created successfully!', 'success');
      haptic('success');
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskReward('5');
      setNewTaskLink('');
      setNewTaskImage(null);
    } catch (e: any) {
      console.error('Error creating task:', e);
      showToast('Failed to create task: ' + e.message, 'error');
    }
  };

  // Admin Actions: Delete Custom Task
  const handleDeleteAdminTask = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      setCustomTasks((prev) => prev.filter((t) => t.id !== taskId));
      showToast('Task deleted successfully', 'info');
      haptic('heavy');
    } catch (e: any) {
      console.error('Error deleting task:', e);
      showToast('Failed to delete task', 'error');
    }
  };

  // Admin Actions: User Balance Increase / Decrease / Set
  const handleSetUserBalance = async (uid: string, targetBalance: number) => {
    if (isNaN(targetBalance) || targetBalance < 0) {
      showToast('Please enter a valid balance amount', 'error');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', uid), { balance: targetBalance });
      showToast(`User (${uid.slice(0, 8)}) balance set to ‡ß≥${targetBalance.toFixed(2)}`, 'success');
      haptic('success');
    } catch (e) {
      console.error('Error updating user balance:', e);
      showToast('Failed to update balance.', 'error');
    }
  };

  const handleAddUserBalance = async (uid: string, addAmount: number) => {
    if (isNaN(addAmount) || addAmount <= 0) {
      showToast('Enter a positive amount to add', 'error');
      return;
    }
    try {
      const uSnap = await getDoc(doc(db, 'users', uid));
      const curr = uSnap.exists() ? (uSnap.data().balance || 0) : 0;
      const newBal = curr + addAmount;
      await updateDoc(doc(db, 'users', uid), { balance: newBal });
      showToast(`Added +‡ß≥${addAmount} ‚Üí New balance: ‡ß≥${newBal.toFixed(2)}`, 'success');
      haptic('success');
    } catch (e) {
      console.error('Error adding balance:', e);
      showToast('Failed to add balance.', 'error');
    }
  };

  const handleSubtractUserBalance = async (uid: string, subAmount: number) => {
    if (isNaN(subAmount) || subAmount <= 0) {
      showToast('Enter a positive amount to subtract', 'error');
      return;
    }
    try {
      const uSnap = await getDoc(doc(db, 'users', uid));
      const curr = uSnap.exists() ? (uSnap.data().balance || 0) : 0;
      const newBal = Math.max(0, curr - subAmount);
      await updateDoc(doc(db, 'users', uid), { balance: newBal });
      showToast(`Subtracted -‡ß≥${subAmount} ‚Üí New balance: ‡ß≥${newBal.toFixed(2)}`, 'info');
      haptic('heavy');
    } catch (e) {
      console.error('Error subtracting balance:', e);
      showToast('Failed to subtract balance.', 'error');
    }
  };

  // Helper: Award Referral Deposit Bonus (5% Cash Commission) to Referrer upon Deposit Approval
  const processReferralDepositBonus = async (
    depositingUid: string,
    depositAmount: number,
    depTrxOrId: string
  ) => {
    try {
      if (depositAmount <= 0 || !depositingUid) return;

      // 1. Get Depositing User Data from users, auth_users, and deposit_requests
      const uSnap = await getDoc(doc(db, 'users', depositingUid));
      const userData: any = uSnap.exists() ? uSnap.data() : {};
      
      const authSnap = await getDoc(doc(db, 'auth_users', depositingUid));
      const authData: any = authSnap.exists() ? authSnap.data() : {};

      let referrerKey = (userData.referredBy || authData.referredBy || '').trim();
      let referrerUsername = (userData.referredByUsername || authData.referredByUsername || '').trim();

      // Check deposit request document if needed
      if (!referrerKey && depTrxOrId) {
        try {
          const depDoc = await getDoc(doc(db, 'deposit_requests', depTrxOrId));
          if (depDoc.exists()) {
            const dd = depDoc.data();
            referrerKey = (dd.referredBy || dd.referredByUsername || '').trim();
            if (!referrerUsername && dd.referredByUsername) referrerUsername = dd.referredByUsername;
          }
        } catch (_) {}
      }

      if (!referrerKey && referrerUsername) {
        referrerKey = referrerUsername;
      }

      if (!referrerKey) {
        console.log('No referrer configured for user:', depositingUid);
        return;
      }

      const cleanKey = referrerKey.replace(/^@+/, '').trim().toLowerCase();
      if (!cleanKey || cleanKey === depositingUid.toLowerCase()) return;

      // 2. Resolve Referrer UID and Info across users and auth_users
      let resolvedReferrerUid: string | null = null;
      let resolvedReferrerUsername = referrerUsername || cleanKey;
      let resolvedReferrerName = 'Friend';

      // Check direct UID lookup
      const directUserSnap = await getDoc(doc(db, 'users', cleanKey));
      if (directUserSnap.exists()) {
        resolvedReferrerUid = cleanKey;
        const d = directUserSnap.data();
        resolvedReferrerUsername = d.username || resolvedReferrerUsername;
        resolvedReferrerName = d.name || resolvedReferrerUsername;
      } else {
        const directAuthSnap = await getDoc(doc(db, 'auth_users', cleanKey));
        if (directAuthSnap.exists()) {
          resolvedReferrerUid = cleanKey;
          const d = directAuthSnap.data();
          resolvedReferrerUsername = d.username || resolvedReferrerUsername;
          resolvedReferrerName = d.name || resolvedReferrerUsername;
        }
      }

      // If not resolved by UID, query by username in auth_users
      if (!resolvedReferrerUid) {
        const qAuth = query(collection(db, 'auth_users'), where('username', '==', cleanKey));
        const snapAuth = await getDocs(qAuth);
        if (!snapAuth.empty) {
          resolvedReferrerUid = snapAuth.docs[0].id;
          const d = snapAuth.docs[0].data();
          resolvedReferrerUsername = d.username || cleanKey;
          resolvedReferrerName = d.name || resolvedReferrerUsername;
        }
      }

      // If still not resolved, query by username in users
      if (!resolvedReferrerUid) {
        const qUser = query(collection(db, 'users'), where('username', '==', cleanKey));
        const snapUser = await getDocs(qUser);
        if (!snapUser.empty) {
          resolvedReferrerUid = snapUser.docs[0].id;
          const d = snapUser.docs[0].data();
          resolvedReferrerUsername = d.username || cleanKey;
          resolvedReferrerName = d.name || resolvedReferrerUsername;
        }
      }

      // Fallback: search in local allUsersList state
      if (!resolvedReferrerUid && allUsersList && allUsersList.length > 0) {
        const matched = allUsersList.find(
          (u: any) =>
            u.uid === cleanKey ||
            (u.username && u.username.toLowerCase() === cleanKey)
        );
        if (matched) {
          resolvedReferrerUid = matched.uid;
          resolvedReferrerUsername = matched.username || cleanKey;
          resolvedReferrerName = matched.name || resolvedReferrerUsername;
        }
      }

      // Final fallback to cleanKey
      if (!resolvedReferrerUid) {
        resolvedReferrerUid = cleanKey;
      }

      if (!resolvedReferrerUid || resolvedReferrerUid === depositingUid) return;

      // 3. Determine 5% Bonus Commission
      let bonusPercent = 5;
      if (referralConfig && typeof referralConfig.bonusPercent === 'number' && referralConfig.bonusPercent > 0) {
        bonusPercent = referralConfig.bonusPercent;
      }

      try {
        const cfgSnap = await getDoc(doc(db, 'settings', 'referral_config'));
        if (cfgSnap.exists()) {
          const d = cfgSnap.data();
          if (d.enabled === false) return;
          if (typeof d.bonusPercent === 'number' && d.bonusPercent > 0) {
            bonusPercent = d.bonusPercent;
          }
        }
      } catch (e) {}

      if (bonusPercent <= 0) return;

      const commission = Math.round((depositAmount * (bonusPercent / 100)) * 100) / 100;
      if (commission <= 0) return;

      // 4. Safely credit Referrer Balance & Update Stats
      const targetUserDocRef = doc(db, 'users', resolvedReferrerUid);
      const targetSnap = await getDoc(targetUserDocRef);
      const prevBal = targetSnap.exists() ? (Number(targetSnap.data().balance) || 0) : 0;
      const prevEarnings = targetSnap.exists() ? (Number(targetSnap.data().totalReferralEarnings) || 0) : 0;
      const prevRefs = targetSnap.exists() ? (Number(targetSnap.data().totalReferrals) || 1) : 1;

      const newBal = Math.round((prevBal + commission) * 100) / 100;
      const newEarn = Math.round((prevEarnings + commission) * 100) / 100;

      await setDoc(
        targetUserDocRef,
        {
          balance: newBal,
          totalReferralEarnings: newEarn,
          totalReferrals: prevRefs,
          name: targetSnap.exists() ? (targetSnap.data().name || resolvedReferrerName) : resolvedReferrerName,
          username: resolvedReferrerUsername,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      // Instant state sync if active user is the referrer
      if (
        currentUser?.uid === resolvedReferrerUid ||
        (currentUser?.username || '').toLowerCase() === cleanKey
      ) {
        setUserBalance((prev) => (prev !== newBal ? newBal : prev));
        setUserReferralEarnings((prev) => (prev !== newEarn ? newEarn : prev));
        showToast(`üéâ ‡ß≥${commission.toFixed(2)} (${bonusPercent}%) ‡¶∞‡ßá‡¶´‡¶æ‡¶∞‡ßá‡¶≤ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶∂ ‡¶ï‡¶Æ‡¶ø‡¶∂‡¶® ‡¶Ü‡¶™‡¶®‡¶æ‡¶∞ ‡¶¨‡ßç‡¶Ø‡¶æ‡¶≤‡ßá‡¶®‡ßç‡¶∏‡ßá ‡¶Ø‡ßã‡¶ó ‡¶π‡ßü‡ßá‡¶õ‡ßá!`, 'success');
      }

      // 5. Record in referral_commissions collection
      await addDoc(collection(db, 'referral_commissions'), {
        referrerUid: resolvedReferrerUid,
        referrerUsername: resolvedReferrerUsername,
        referredUid: depositingUid,
        referredUsername: userData.username || authData.username || userData.name || 'Friend',
        depositAmount: Number(depositAmount),
        bonusPercent: Number(bonusPercent),
        commissionAmount: commission,
        depositTrxId: depTrxOrId || '',
        status: 'Completed',
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString()
      });

      // 6. Push notification for Referrer
      await addDoc(collection(db, 'user_notifications'), {
        uid: resolvedReferrerUid,
        title: `üéÅ ‡ß≥${commission.toFixed(2)} (${bonusPercent}%) ‡¶∞‡ßá‡¶´‡¶æ‡¶∞‡ßá‡¶≤ ‡¶ï‡¶Æ‡¶ø‡¶∂‡¶® ‡¶ú‡¶Æ‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!`,
        message: `‡¶Ü‡¶™‡¶®‡¶æ‡¶∞ ‡¶∞‡ßá‡¶´‡¶æ‡¶∞‡ßá‡¶≤ ‡¶á‡¶â‡¶ú‡¶æ‡¶∞ (@${userData.username || authData.username || userData.name || 'User'}) ‡ß≥${depositAmount} ‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶® ‡¶ï‡¶∞‡¶æ‡ßü ‡¶Ü‡¶™‡¶®‡¶ø ${bonusPercent}% ‡¶ï‡ßç‡¶Ø‡¶æ‡¶∂ ‡¶ï‡¶Æ‡¶ø‡¶∂‡¶® ‡¶π‡¶ø‡¶∏‡ßá‡¶¨‡ßá ‡ß≥${commission.toFixed(2)} ‡¶Æ‡ßÇ‡¶≤ ‡¶¨‡ßç‡¶Ø‡¶æ‡¶≤‡ßá‡¶®‡ßç‡¶∏‡ßá ‡¶™‡ßá‡ßü‡ßá ‡¶ó‡ßá‡¶õ‡ßá‡¶®!`,
        type: 'promo',
        timestamp: serverTimestamp(),
        unread: true
      });

      console.log(`Successfully credited referral bonus: ‡ß≥${commission} to ${resolvedReferrerUsername} (${resolvedReferrerUid})`);
    } catch (err) {
      console.error('Error awarding referral bonus:', err);
    }
  };

  const handleApproveDepositCustom = async (depId: string, uid: string, originalAmount: number) => {
    const customStr = customDepAmounts[depId];
    const finalAmount = customStr !== undefined && !isNaN(parseFloat(customStr)) && parseFloat(customStr) >= 0
      ? parseFloat(customStr)
      : originalAmount;

    try {
      const uSnap = await getDoc(doc(db, 'users', uid));
      const currBal = uSnap.exists() ? (uSnap.data().balance || 0) : 0;
      const newBal = currBal + finalAmount;

      await updateDoc(doc(db, 'users', uid), { balance: newBal });
      await updateDoc(doc(db, 'deposit_requests', depId), {
        status: 'Approved',
        amount: finalAmount,
        approvedAt: serverTimestamp()
      });

      // Award 5% referral bonus to the inviter
      await processReferralDepositBonus(uid, finalAmount, depId);

      showToast(`Approved ‡ß≥${finalAmount} for user ${uid.slice(0, 8)}!`, 'success');
      haptic('success');
    } catch (e) {
      console.error('Error approving deposit:', e);
      showToast('Failed to approve deposit.', 'error');
    }
  };

  const handleRejectDeposit = async (depId: string) => {
    try {
      await updateDoc(doc(db, 'deposit_requests', depId), {
        status: 'Rejected',
        rejectedAt: serverTimestamp()
      });
      showToast('Deposit request rejected', 'warning');
      haptic('heavy');
    } catch (e) {
      console.error('Error rejecting deposit:', e);
      showToast('Failed to reject deposit.', 'error');
    }
  };

  // Sync Payment Methods Configuration from Firestore settings
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'payment_methods'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && typeof data === 'object') {
          const normalized: Record<string, PaymentMethodConfig> = {};
          Object.entries(data).forEach(([key, val]: [string, any]) => {
            if (val && typeof val === 'object') {
              normalized[key] = {
                ...val,
                id: val.id || key,
                label: val.label || key,
                number: val.number || '',
                active: val.active !== false
              };
            }
          });
          setPaymentMethodsConfig((prev) => ({
            ...prev,
            ...normalized
          }));
        }
      }
    });
    return () => unsub();
  }, []);

  // Sync Welcome 3D Voice & Announcement Configuration and Site Logo from Firestore settings
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'welcome_config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data) {
          const cfg = {
            title: data.title || '‡¶ì‡¶Ø‡¶º‡ßá‡¶≤‡¶ï‡¶æ‡¶Æ RF SMM PANEL!',
            text: data.text || '‡¶ì‡¶Ø‡¶º‡ßá‡¶≤‡¶ï‡¶æ‡¶Æ ‡¶ü‡ßÅ ‡¶Ü‡¶∞ ‡¶è‡¶´ ‡¶è‡¶∏‡¶è‡¶Æ‡¶è‡¶Æ ‡¶™‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤‡•§ ‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ‡¶¶‡ßá‡¶∂‡ßá‡¶∞ ‡¶è‡¶ï ‡¶®‡¶Æ‡ßç‡¶¨‡¶∞ ‡¶∏‡ßã‡¶∂‡ßç‡¶Ø‡¶æ‡¶≤ ‡¶Æ‡¶ø‡¶°‡¶ø‡¶Ø‡¶º‡¶æ ‡¶Æ‡¶æ‡¶∞‡ßç‡¶ï‡ßá‡¶ü‡¶ø‡¶Ç ‡¶™‡ßç‡¶≤‡ßç‡¶Ø‡¶æ‡¶ü‡¶´‡¶∞‡ßç‡¶Æ‡ßá ‡¶Ü‡¶™‡¶®‡¶æ‡¶ï‡ßá ‡¶∏‡ßç‡¶¨‡¶æ‡¶ó‡¶§‡¶Æ‡•§',
            enabled: data.enabled !== false,
            soundEnabled: data.soundEnabled !== false,
            show3DButton: data.show3DButton !== false,
            is3DCanvasGlobal: data.is3DCanvasGlobal !== false,
            showNoticeTicker: data.showNoticeTicker !== false,
            noticeText: data.noticeText || '‚ö° ‡ß®‡ß™/‡ß≠ ‡¶á‡¶®‡¶∏‡ßç‡¶ü‡ßç‡¶Ø‡¶æ‡¶®‡ßç‡¶ü ‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏ ‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡ßü | ‡¶¨‡¶ø‡¶ï‡¶æ‡¶∂, ‡¶®‡¶ó‡¶¶, ‡¶∞‡¶ï‡ßá‡¶ü‡ßá ‡¶á‡¶®‡¶∏‡ßç‡¶ü‡ßç‡¶Ø‡¶æ‡¶®‡ßç‡¶ü ‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶¨‡ßã‡¶®‡¶æ‡¶∏ ‡¶ö‡¶≤‡¶õ‡ßá | ‡¶Ø‡ßá‡¶ï‡ßã‡¶®‡ßã ‡¶™‡ßç‡¶∞‡ßü‡ßã‡¶ú‡¶®‡ßá ‡¶Ü‡¶Æ‡¶æ‡¶¶‡ßá‡¶∞ ‡¶≤‡¶æ‡¶á‡¶≠ ‡¶∏‡¶æ‡¶™‡ßã‡¶∞‡ßç‡¶ü‡ßá ‡¶Ø‡ßã‡¶ó‡¶æ‡¶Ø‡ßã‡¶ó ‡¶ï‡¶∞‡ßÅ‡¶® üöÄ',
            audioMode: (data.audioMode === 'custom' ? 'custom' : 'tts') as 'tts' | 'custom',
            customAudioUrl: data.customAudioUrl || '',
            audioFileName: data.audioFileName || '',
            siteLogo: data.siteLogo || '',
            aiSupportEnabled: data.aiSupportEnabled !== undefined ? data.aiSupportEnabled : true,
          };
          setWelcomeConfig(cfg);
          setAdminWelcomeTitle(cfg.title);
          setAdminWelcomeText(cfg.text);
          setAdminWelcomeEnabled(cfg.enabled);
          setAdminSoundEnabled(cfg.soundEnabled);
          setAdminShow3DButton(cfg.show3DButton);
          setAdmin3DCanvasGlobal(cfg.is3DCanvasGlobal);
          setAdminShowNoticeTicker(cfg.showNoticeTicker);
          if (data.noticeText) {
            setAdminNoticeText(data.noticeText);
          }
          setAdminAudioMode(cfg.audioMode);
          setAdminCustomAudioUrl(cfg.customAudioUrl || '');
          setAdminAudioFileName(cfg.audioFileName || '');
          if (data.siteLogo) {
            setAdminSiteLogo(data.siteLogo);
            setAdminSiteLogoInput(data.siteLogo);
            localStorage.setItem('rf_smm_site_logo', data.siteLogo);
          }
        }
      }
    });
    return () => unsub();
  }, []);

  // Handle Custom Audio File Upload (MP3, WAV, M4A, OGG)
  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>) => {
    let file: File | null = null;
    if ('dataTransfer' in e) {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        file = e.dataTransfer.files[0];
      }
    } else if (e.target.files && e.target.files.length > 0) {
      file = e.target.files[0];
    }

    if (!file) return;

    // Validate audio file
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|ogg|aac|webm)$/i)) {
      showToast('‡¶Ö‡¶®‡ßÅ‡¶ó‡ßç‡¶∞‡¶π ‡¶ï‡¶∞‡ßá ‡¶∂‡ßÅ‡¶ß‡ßÅ‡¶Æ‡¶æ‡¶§‡ßç‡¶∞ ‡¶Ö‡¶°‡¶ø‡¶ì ‡¶´‡¶æ‡¶á‡¶≤ (MP3, WAV, M4A, OGG) ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶ï‡¶∞‡ßÅ‡¶®', 'error');
      return;
    }

    // Limit size (max 3MB for database storage)
    if (file.size > 3 * 1024 * 1024) {
      showToast('‡¶Ö‡¶°‡¶ø‡¶ì ‡¶´‡¶æ‡¶á‡¶≤ ‡¶∏‡¶æ‡¶á‡¶ú ‡ß©MB ‡¶è‡¶∞ ‡¶ï‡¶Æ ‡¶π‡¶§‡ßá ‡¶π‡¶¨‡ßá', 'warning');
      return;
    }

    setAdminAudioUploading(true);
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target?.result as string;
      if (dataUrl) {
        setAdminCustomAudioUrl(dataUrl);
        setAdminAudioFileName(file?.name || 'custom_voice.mp3');
        setAdminAudioMode('custom');
        showToast('üéµ ‡¶Ö‡¶°‡¶ø‡¶ì ‡¶´‡¶æ‡¶á‡¶≤ ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶≤‡ßã‡¶° ‡¶π‡¶Ø‡¶º‡ßá‡¶õ‡ßá! ‡¶™‡ßç‡¶≤‡ßá ‡¶ï‡¶∞‡ßá ‡¶∂‡ßÅ‡¶®‡ßÅ‡¶® ‡¶¨‡¶æ ‡¶∏‡ßá‡¶≠ ‡¶ï‡¶∞‡ßÅ‡¶®‡•§', 'success');
      }
      setAdminAudioUploading(false);
    };
    reader.onerror = () => {
      showToast('‡¶Ö‡¶°‡¶ø‡¶ì ‡¶´‡¶æ‡¶á‡¶≤ ‡¶™‡ßú‡¶§‡ßá ‡¶∏‡¶Æ‡¶∏‡ßç‡¶Ø‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá', 'error');
      setAdminAudioUploading(false);
    };
    reader.readAsDataURL(file);
  };

  // Start Mic Voice Recording
  const handleStartRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('‡¶Ü‡¶™‡¶®‡¶æ‡¶∞ ‡¶¨‡ßç‡¶∞‡¶æ‡¶â‡¶ú‡¶æ‡¶∞‡ßá ‡¶Æ‡¶æ‡¶á‡¶ï‡ßç‡¶∞‡ßã‡¶´‡ßã‡¶® ‡¶∞‡ßá‡¶ï‡¶∞‡ßç‡¶°‡¶ø‡¶Ç ‡¶∏‡¶æ‡¶™‡ßã‡¶∞‡ßç‡¶ü ‡¶®‡ßá‡¶á', 'warning');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          setAdminCustomAudioUrl(base64Audio);
          setAdminAudioFileName(`recorded_voice_${new Date().toLocaleTimeString('en-US', { hour12: false })}.webm`);
          setAdminAudioMode('custom');
          showToast('üéôÔ∏è ‡¶≠‡¶Ø‡¶º‡ßá‡¶∏ ‡¶∞‡ßá‡¶ï‡¶∞‡ßç‡¶°‡¶ø‡¶Ç ‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶® ‡¶π‡¶Ø‡¶º‡ßá‡¶õ‡ßá! ‡¶™‡ßç‡¶∞‡¶ø‡¶≠‡¶ø‡¶â ‡¶∂‡ßÅ‡¶®‡ßÅ‡¶® ‡¶è‡¶¨‡¶Ç ‡¶∏‡ßá‡¶≠ ‡¶ï‡¶∞‡ßÅ‡¶®‡•§', 'success');
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setAdminIsRecording(true);
      setAdminRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setAdminRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Mic record error:', err);
      showToast('‡¶Æ‡¶æ‡¶á‡¶ï‡ßç‡¶∞‡ßã‡¶´‡ßã‡¶® ‡¶™‡¶æ‡¶∞‡¶Æ‡¶ø‡¶∂‡¶® ‡¶™‡¶æ‡¶ì‡¶Ø‡¶º‡¶æ ‡¶Ø‡¶æ‡¶Ø‡¶º‡¶®‡¶ø: ' + (err.message || ''), 'error');
    }
  };

  // Stop Mic Voice Recording
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setAdminIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  // Toggle Custom Audio Play / Pause
  const handleTogglePlayCustomAudio = () => {
    if (!adminCustomAudioUrl) return;

    if (adminAudioPlaying && adminAudioPlayerRef.current) {
      adminAudioPlayerRef.current.pause();
      adminAudioPlayerRef.current.currentTime = 0;
      setAdminAudioPlaying(false);
    } else {
      if (adminAudioPlayerRef.current) {
        adminAudioPlayerRef.current.pause();
      }
      const audio = new Audio(adminCustomAudioUrl);
      adminAudioPlayerRef.current = audio;
      audio.onended = () => setAdminAudioPlaying(false);
      audio.onerror = () => {
        showToast('‡¶Ö‡¶°‡¶ø‡¶ì ‡¶™‡ßç‡¶≤‡ßá ‡¶ï‡¶∞‡¶§‡ßá ‡¶∏‡¶Æ‡¶∏‡ßç‡¶Ø‡¶æ ‡¶π‡¶Ø‡¶º‡ßá‡¶õ‡ßá', 'error');
        setAdminAudioPlaying(false);
      };
      audio.play().then(() => {
        setAdminAudioPlaying(true);
      }).catch((e) => {
        console.error('Audio play error:', e);
        setAdminAudioPlaying(false);
      });
    }
  };

  // Remove Uploaded Custom Audio
  const handleRemoveCustomAudio = () => {
    if (adminAudioPlayerRef.current) {
      adminAudioPlayerRef.current.pause();
      adminAudioPlayerRef.current = null;
    }
    setAdminAudioPlaying(false);
    setAdminCustomAudioUrl('');
    setAdminAudioFileName('');
    setAdminAudioMode('tts');
    showToast('‡¶ï‡¶æ‡¶∏‡ßç‡¶ü‡¶Æ ‡¶Ö‡¶°‡¶ø‡¶ì ‡¶Æ‡ßÅ‡¶õ‡ßá ‡¶´‡ßá‡¶≤‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá‡•§ ‡¶è‡¶ñ‡¶® ‡¶ü‡ßá‡¶ï‡ßç‡¶∏‡¶ü-‡¶ü‡ßÅ-‡¶∏‡ßç‡¶™‡¶ø‡¶ö ‡¶ö‡¶æ‡¶≤‡ßÅ ‡¶•‡¶æ‡¶ï‡¶¨‡ßá‡•§', 'info');
  };

  // Instant Toggle Any Feature from Admin Panel with immediate Firestore sync
  const handleQuickToggleFeature = async (
    feature: 'soundEnabled' | 'enabled' | 'show3DButton' | 'is3DCanvasGlobal' | 'showNoticeTicker',
    value: boolean
  ) => {
    if (feature === 'soundEnabled') setAdminSoundEnabled(value);
    if (feature === 'enabled') setAdminWelcomeEnabled(value);
    if (feature === 'show3DButton') setAdminShow3DButton(value);
    if (feature === 'is3DCanvasGlobal') setAdmin3DCanvasGlobal(value);
    if (feature === 'showNoticeTicker') setAdminShowNoticeTicker(value);

    setWelcomeConfig((prev) => ({ ...prev, [feature]: value }));

    try {
      await setDoc(
        doc(db, 'settings', 'welcome_config'),
        { [feature]: value, updatedAt: serverTimestamp() },
        { merge: true }
      );
      showToast(
        value
          ? `‚úÖ ‡¶ö‡¶æ‡¶≤‡ßÅ ‡¶ï‡¶∞‡¶æ ‡¶π‡¶Ø‡¶º‡ßá‡¶õ‡ßá (ON) - ‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶™‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤‡ßá ‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡¶Ø‡¶º`
          : `‚ùå ‡¶¨‡¶®‡ßç‡¶ß ‡¶ï‡¶∞‡¶æ ‡¶π‡¶Ø‡¶º‡ßá‡¶õ‡ßá (OFF) - ‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶™‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤‡ßá ‡¶Ü‡¶∞ ‡¶¶‡ßá‡¶ñ‡¶æ‡¶¨‡ßá ‡¶®‡¶æ`,
        value ? 'success' : 'info'
      );
      haptic('light');
    } catch (err: any) {
      console.error('Feature toggle error:', err);
      showToast('‡¶∏‡ßá‡¶ü‡¶ø‡¶Ç‡¶∏ ‡¶Ü‡¶™‡¶°‡ßá‡¶ü ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶•: ' + err.message, 'error');
    }
  };

  // Save Live Scrolling Notice Ticker (Admin Setting)
  const handleSaveNoticeText = async (textToSave?: string) => {
    const text = typeof textToSave === 'string' ? textToSave : adminNoticeText;
    if (!text.trim()) {
      showToast('‡¶®‡ßã‡¶ü‡¶ø‡¶∂ ‡¶ü‡ßá‡¶ï‡ßç‡¶∏‡¶ü ‡¶ñ‡¶æ‡¶≤‡¶ø ‡¶∞‡¶æ‡¶ñ‡¶æ ‡¶Ø‡¶æ‡¶¨‡ßá ‡¶®‡¶æ', 'error');
      return;
    }
    setAdminSavingNotice(true);
    try {
      await setDoc(
        doc(db, 'settings', 'welcome_config'),
        {
          noticeText: text.trim(),
          showNoticeTicker: adminShowNoticeTicker,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setAdminNoticeText(text.trim());
      setWelcomeConfig((prev) => ({ ...prev, noticeText: text.trim() }));
      showToast('‚úÖ ‡¶π‡ßã‡¶Æ ‡¶™‡ßá‡¶á‡¶ú‡ßá‡¶∞ ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶≤‡¶ø‡¶Ç ‡¶®‡ßã‡¶ü‡¶ø‡¶∂ ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶Ü‡¶™‡¶°‡ßá‡¶ü ‡¶ì ‡¶∏‡ßá‡¶≠ ‡¶π‡ßü‡ßá‡¶õ‡ßá!', 'success');
      haptic('success');
    } catch (err: any) {
      console.error('Error saving notice text:', err);
      showToast('‡¶®‡ßã‡¶ü‡¶ø‡¶∂ ‡¶∏‡ßá‡¶≠ ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶•: ' + err.message, 'error');
    } finally {
      setAdminSavingNotice(false);
    }
  };

  // Save Welcome Voice, Sound & Display Configuration in Firestore (Admin Setting)
  const handleSaveWelcomeConfig = async () => {
    if (!adminWelcomeText.trim()) {
      showToast('‡¶ì‡¶Ø‡¶º‡ßá‡¶≤‡¶ï‡¶æ‡¶Æ ‡¶≠‡¶Ø‡¶º‡ßá‡¶∏ ‡¶ü‡ßá‡¶ï‡ßç‡¶∏‡¶ü ‡¶ñ‡¶æ‡¶≤‡¶ø ‡¶∞‡¶æ‡¶ñ‡¶æ ‡¶Ø‡¶æ‡¶¨‡ßá ‡¶®‡¶æ', 'error');
      return;
    }
    setAdminSavingWelcome(true);
    try {
      const configData = {
        title: adminWelcomeTitle.trim() || '‡¶ì‡¶Ø‡¶º‡ßá‡¶≤‡¶ï‡¶æ‡¶Æ RF SMM PANEL!',
        text: adminWelcomeText.trim(),
        enabled: adminWelcomeEnabled,
        soundEnabled: adminSoundEnabled,
        show3DButton: adminShow3DButton,
        is3DCanvasGlobal: admin3DCanvasGlobal,
        showNoticeTicker: adminShowNoticeTicker,
        noticeText: adminNoticeText.trim(),
        audioMode: adminAudioMode,
        customAudioUrl: adminCustomAudioUrl || '',
        audioFileName: adminAudioFileName || '',
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'settings', 'welcome_config'), configData, { merge: true });

      setWelcomeConfig({
        title: adminWelcomeTitle.trim() || '‡¶ì‡¶Ø‡¶º‡ßá‡¶≤‡¶ï‡¶æ‡¶Æ RF SMM PANEL!',
        text: adminWelcomeText.trim(),
        enabled: adminWelcomeEnabled,
        soundEnabled: adminSoundEnabled,
        show3DButton: adminShow3DButton,
        is3DCanvasGlobal: admin3DCanvasGlobal,
        showNoticeTicker: adminShowNoticeTicker,
        noticeText: adminNoticeText.trim(),
        audioMode: adminAudioMode,
        customAudioUrl: adminCustomAudioUrl || '',
        audioFileName: adminAudioFileName || '',
      });
      showToast('‚úÖ ‡¶∏‡¶ï‡¶≤ ‡¶∏‡¶æ‡¶â‡¶®‡ßç‡¶° ‡¶ì ‡¶°‡¶ø‡¶∏‡¶™‡ßç‡¶≤‡ßá ‡¶ï‡¶®‡¶´‡¶ø‡¶ó‡¶æ‡¶∞‡ßá‡¶∂‡¶® ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶∏‡ßá‡¶≠ ‡¶π‡¶Ø‡¶º‡ßá‡¶õ‡ßá!', 'success');
      haptic('success');
    } catch (err: any) {
      console.error('Error saving welcome config:', err);
      showToast('‡¶ì‡¶Ø‡¶º‡ßá‡¶≤‡¶ï‡¶æ‡¶Æ ‡¶Æ‡ßá‡¶∏‡ßá‡¶ú ‡¶∏‡ßá‡¶≠ ‡¶ï‡¶∞‡¶§‡ßá ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶•: ' + err.message, 'error');
    } finally {
      setAdminSavingWelcome(false);
    }
  };

  // Helper to optimize / compress images for fast loading and Firestore compatibility
  const optimizeImageFile = (file: File, maxDim = 800, quality = 0.88): Promise<{ dataUrl: string; sizeKb: number; width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      if (file.type === 'image/svg+xml') {
        const reader = new FileReader();
        reader.onload = () => resolve({
          dataUrl: reader.result as string,
          sizeKb: Math.round(file.size / 1024),
          width: 0,
          height: 0
        });
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ dataUrl: '', sizeKb: 0, width, height });
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
        const outMime = isPng ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(outMime, isPng ? undefined : quality);
        const sizeKb = Math.round((dataUrl.length * 3) / 4 / 1024);

        resolve({ dataUrl, sizeKb, width, height });
      };
      img.onerror = reject;
      img.src = objectUrl;
    });
  };

  // Handle Logo Upload from Local Device (Pick / Camera / Drag & Drop)
  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement> | File) => {
    let file: File | null = null;
    if (e instanceof File) {
      file = e;
    } else if ('dataTransfer' in e) {
      e.preventDefault();
      setIsDraggingLogo(false);
      file = e.dataTransfer.files?.[0] || null;
    } else if ('target' in e && e.target.files) {
      file = e.target.files[0] || null;
    }

    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('‡¶∂‡ßÅ‡¶ß‡ßÅ‡¶Æ‡¶æ‡¶§‡ßç‡¶∞ ‡¶õ‡¶¨‡¶ø ‡¶´‡¶æ‡¶á‡¶≤ ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶ï‡¶∞‡ßÅ‡¶® (PNG, JPG, SVG, WebP, GIF)', 'error');
      return;
    }

    showToast('‡¶≤‡ßã‡¶ó‡ßã ‡¶Ö‡¶™‡ßç‡¶ü‡¶ø‡¶Æ‡¶æ‡¶á‡¶ú ‡¶ì ‡¶™‡ßç‡¶∞‡¶∏‡ßá‡¶∏ ‡¶ï‡¶∞‡¶æ ‡¶π‡¶ö‡ßç‡¶õ‡ßá...', 'info');
    try {
      const result = await optimizeImageFile(file, 800, 0.9);
      if (!result.dataUrl) {
        throw new Error('Image conversion failed');
      }

      setAdminSiteLogo(result.dataUrl);
      setAdminSiteLogoInput(result.dataUrl);
      localStorage.setItem('rf_smm_site_logo', result.dataUrl);

      setUploadedLogoInfo({
        name: file.name,
        size: `${result.sizeKb} KB`,
        resolution: result.width ? `${result.width}√ó${result.height}px` : undefined,
      });

      haptic('light');
      showToast(`‚úÖ ‡¶≤‡ßã‡¶ó‡ßã ‡¶≤‡ßã‡¶° ‡¶π‡ßü‡ßá‡¶õ‡ßá (${result.sizeKb} KB)! ‡¶®‡¶ø‡¶ö‡ßá‡¶∞ ‡¶¨‡¶æ‡¶ü‡¶®‡ßá ‡¶∏‡ßá‡¶≠ ‡¶ï‡¶∞‡ßÅ‡¶®`, 'success');
    } catch (err: any) {
      console.error('Logo upload error:', err);
      showToast('‡¶õ‡¶¨‡¶ø ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶ï‡¶∞‡¶§‡ßá ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶• ‡¶π‡ßü‡ßá‡¶õ‡ßá: ' + (err.message || 'Error'), 'error');
    }
  };

  // Handle Telegram Custom Photo Upload from Local Device
  const handleTelegramPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement> | File) => {
    let file: File | null = null;
    if (e instanceof File) {
      file = e;
    } else if ('dataTransfer' in e) {
      e.preventDefault();
      setIsDraggingTelegramPhoto(false);
      file = e.dataTransfer.files?.[0] || null;
    } else if ('target' in e && e.target.files) {
      file = e.target.files[0] || null;
    }

    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('‡¶∂‡ßÅ‡¶ß‡ßÅ‡¶Æ‡¶æ‡¶§‡ßç‡¶∞ ‡¶õ‡¶¨‡¶ø ‡¶´‡¶æ‡¶á‡¶≤ ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶ï‡¶∞‡ßÅ‡¶® (PNG, JPG, WebP)', 'error');
      return;
    }

    showToast('‡¶ü‡ßá‡¶≤‡¶ø‡¶ó‡ßç‡¶∞‡¶æ‡¶Æ ‡¶¨‡ßç‡¶Ø‡¶æ‡¶®‡¶æ‡¶∞ ‡¶™‡ßç‡¶∞‡¶∏‡ßá‡¶∏ ‡¶ï‡¶∞‡¶æ ‡¶π‡¶ö‡ßç‡¶õ‡ßá...', 'info');
    try {
      const result = await optimizeImageFile(file, 1000, 0.85);
      if (!result.dataUrl) {
        throw new Error('Image conversion failed');
      }

      setAdminTelegramPhotoUrl(result.dataUrl);
      setUploadedTelegramPhotoInfo({
        name: file.name,
        size: `${result.sizeKb} KB`,
      });

      haptic('light');
      showToast(`‚úÖ ‡¶ü‡ßá‡¶≤‡¶ø‡¶ó‡ßç‡¶∞‡¶æ‡¶Æ ‡¶¨‡ßç‡¶Ø‡¶æ‡¶®‡¶æ‡¶∞ ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶π‡ßü‡ßá‡¶õ‡ßá (${result.sizeKb} KB)!`, 'success');
    } catch (err: any) {
      console.error('Telegram photo upload error:', err);
      showToast('‡¶õ‡¶¨‡¶ø ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶•: ' + (err.message || 'Error'), 'error');
    }
  };

  // Save Site Logo in Firestore and Local Storage
  const handleSaveSiteLogo = async (overrideLogo?: string) => {
    const logoToSave = (overrideLogo !== undefined ? overrideLogo : (adminSiteLogoInput.trim() || adminSiteLogo)).trim();
    setAdminSavingLogo(true);
    try {
      await setDoc(
        doc(db, 'settings', 'welcome_config'),
        {
          siteLogo: logoToSave,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setAdminSiteLogo(logoToSave);
      setAdminSiteLogoInput(logoToSave);
      localStorage.setItem('rf_smm_site_logo', logoToSave);
      showToast(logoToSave ? '‚úÖ ‡¶∏‡¶æ‡¶á‡¶ü ‡¶ì ‡¶π‡ßã‡¶Æ ‡¶™‡ßá‡¶ú ‡¶≤‡ßã‡¶ó‡ßã ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶∏‡ßá‡¶≠ ‡¶π‡¶Ø‡¶º‡ßá‡¶õ‡ßá!' : '‚úÖ ‡¶≤‡ßã‡¶ó‡ßã ‡¶∞‡¶ø‡¶∏‡ßá‡¶ü ‡¶ï‡¶∞‡¶æ ‡¶π‡¶Ø‡¶º‡ßá‡¶õ‡ßá!', 'success');
      haptic('success');
    } catch (err: any) {
      console.error('Error saving site logo:', err);
      showToast('‡¶≤‡ßã‡¶ó‡ßã ‡¶∏‡ßá‡¶≠ ‡¶ï‡¶∞‡¶§‡ßá ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶•: ' + err.message, 'error');
    } finally {
      setAdminSavingLogo(false);
    }
  };

  // Handle Payment Deposit Receipt/Screenshot Upload
  const handleDepositReceiptUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>) => {
    let file: File | null = null;
    if ('dataTransfer' in e) {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        file = e.dataTransfer.files[0];
      }
    } else if (e.target.files && e.target.files.length > 0) {
      file = e.target.files[0];
    }
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('‡¶Ö‡¶®‡ßÅ‡¶ó‡ßç‡¶∞‡¶π ‡¶ï‡¶∞‡ßá ‡¶∂‡ßÅ‡¶ß‡ßÅ‡¶Æ‡¶æ‡¶§‡ßç‡¶∞ ‡¶õ‡¶¨‡¶ø ‡¶´‡¶æ‡¶á‡¶≤ ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶ï‡¶∞‡ßÅ‡¶® (JPG, PNG, WEBP)', 'error');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('‡¶õ‡¶¨‡¶ø‡¶∞ ‡¶∏‡¶æ‡¶á‡¶ú ‡¶∏‡¶∞‡ßç‡¶¨‡ßã‡¶ö‡ßç‡¶ö ‡ßÆMB ‡¶π‡¶§‡ßá ‡¶™‡¶æ‡¶∞‡¶¨‡ßá', 'error');
      return;
    }
    setDepositReceiptFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDepositReceiptImage(reader.result);
        showToast('üì∏ ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡¶∂‡¶ü ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶π‡¶Ø‡¶º‡ßá‡¶õ‡ßá!', 'success');
        haptic('light');
      }
    };
    reader.readAsDataURL(file);
  };

  // Test Speech Synthesis locally for Admin
  const handleTestSpeech = (text: string) => {
    if (!('speechSynthesis' in window)) {
      showToast('‡¶Ü‡¶™‡¶®‡¶æ‡¶∞ ‡¶¨‡ßç‡¶∞‡¶æ‡¶â‡¶ú‡¶æ‡¶∞‡ßá ‡¶≠‡¶Ø‡¶º‡ßá‡¶∏ ‡¶∏‡¶æ‡¶™‡ßã‡¶∞‡ßç‡¶ü ‡¶®‡ßá‡¶á', 'warning');
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const banglaVoice = voices.find(
        (v) =>
          v.lang.includes('bn') ||
          v.lang.includes('BD') ||
          v.name.toLowerCase().includes('bangla') ||
          v.name.toLowerCase().includes('bengali')
      );
      if (banglaVoice) {
        utterance.voice = banglaVoice;
        utterance.lang = banglaVoice.lang;
      } else {
        utterance.lang = 'bn-BD';
      }
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
      showToast('üîä ‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ ‡¶≠‡¶Ø‡¶º‡ßá‡¶∏ ‡¶¨‡¶æ‡¶ú‡¶æ‡¶®‡ßã ‡¶π‡¶ö‡ßç‡¶õ‡ßá...', 'info');
    } catch (e) {
      console.error('Speech test error:', e);
    }
  };

  // Save/Update Payment Method in Firestore (Admin)
  const handleSavePaymentMethod = async (methodKey: string, methodData: Partial<PaymentMethodConfig>) => {
    try {
      const current = paymentMethodsConfig[methodKey] || { id: methodKey, label: methodKey, number: '' };
      const updatedMethod: PaymentMethodConfig = {
        ...current,
        ...methodData,
        id: methodKey
      };
      const updated = {
        ...paymentMethodsConfig,
        [methodKey]: updatedMethod
      };
      await setDoc(doc(db, 'settings', 'payment_methods'), updated);
      setPaymentMethodsConfig(updated);
      showToast(`‚úÖ ${updatedMethod.label || methodKey} ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶Æ‡ßá‡¶•‡¶° ‡¶∏‡ßá‡¶≠ ‡¶π‡ßü‡ßá‡¶õ‡ßá!`, 'success');
      haptic('success');
    } catch (e: any) {
      console.error('Error saving payment method:', e);
      showToast('Failed to save payment method: ' + e.message, 'error');
    }
  };

  // Add Brand New Payment Method (Admin)
  const handleAddNewPaymentMethod = async () => {
    if (!newMethodLabel.trim()) {
      showToast('‡¶Æ‡ßá‡¶•‡¶°‡ßá‡¶∞ ‡¶®‡¶æ‡¶Æ ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶® (Method Name Required)', 'error');
      return;
    }
    if (!newMethodNumber.trim()) {
      showToast('‡¶®‡¶Æ‡ßç‡¶¨‡¶∞ ‡¶¨‡¶æ ‡¶ì‡ßü‡¶æ‡¶≤‡ßá‡¶ü ‡¶è‡¶°‡ßç‡¶∞‡ßá‡¶∏ ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶®', 'error');
      return;
    }

    const key = (newMethodKey.trim() || newMethodLabel.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')) || ('method_' + Date.now());

    const newMethodObj: PaymentMethodConfig = {
      id: key,
      label: newMethodLabel.trim(),
      number: newMethodNumber.trim(),
      type: newMethodType,
      ussd: newMethodUssd.trim() || '*247#',
      color: newMethodColor.trim() || '#e2136e',
      logoUrl: newMethodLogoUrl.trim() || undefined,
      iconType: newMethodIconType,
      note: newMethodNote.trim() || undefined,
      active: true
    };

    try {
      const updated = {
        ...paymentMethodsConfig,
        [key]: newMethodObj
      };
      await setDoc(doc(db, 'settings', 'payment_methods'), updated);
      setPaymentMethodsConfig(updated);
      showToast(`üéâ ‡¶®‡¶§‡ßÅ‡¶® ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶Æ‡ßá‡¶•‡¶° "${newMethodLabel}" ‡¶Ø‡ßã‡¶ó ‡¶π‡ßü‡ßá‡¶õ‡ßá!`, 'success');
      haptic('success');
      setShowAddMethodModal(false);
      setNewMethodKey('');
      setNewMethodLabel('');
      setNewMethodNumber('');
      setNewMethodLogoUrl('');
      setNewMethodNote('');
    } catch (e: any) {
      console.error('Error adding payment method:', e);
      showToast('Failed to add payment method: ' + e.message, 'error');
    }
  };

  // Delete a Payment Method (Admin)
  const handleDeletePaymentMethod = async (methodKey: string) => {
    try {
      const updated = { ...paymentMethodsConfig };
      delete updated[methodKey];
      await setDoc(doc(db, 'settings', 'payment_methods'), updated);
      setPaymentMethodsConfig(updated);
      showToast(`üóëÔ∏è ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶Æ‡ßá‡¶•‡¶° ‡¶Æ‡ßÅ‡¶õ‡ßá ‡¶´‡ßá‡¶≤‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!`, 'success');
      haptic('heavy');
    } catch (e: any) {
      console.error('Error deleting payment method:', e);
      showToast('Failed to delete: ' + e.message, 'error');
    }
  };

  // Admin Order Status Update
  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
      showToast(`Order #${orderId.slice(-6)} status ‚Üí ${newStatus}`, 'success');
      haptic('success');
    } catch (e) {
      console.error('Error updating order status:', e);
      showToast('Failed to update status.', 'error');
    }
  };

  // Admin Broadcast Notification
  const handleSendBroadcast = () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      showToast('Please enter notification title and message', 'error');
      return;
    }
    const newNotif = {
      id: 'n_' + Date.now(),
      title: broadcastTitle,
      message: broadcastMessage,
      time: 'Just now',
      unread: true,
      type: broadcastType,
      image: broadcastImage || undefined
    };
    setNotifications((prev) => [newNotif, ...prev]);
    setBroadcastTitle('');
    setBroadcastMessage('');
    setBroadcastImage(null);
    showToast('Broadcast notification posted to all users!', 'success');
    haptic('success');
  };

  // Admin Support Link Add/Delete
  const handleAddSupportLink = () => {
    if (!newLinkName.trim() || !newLinkUrl.trim()) {
      showToast('Link name and URL are required', 'error');
      return;
    }
    const newLink = {
      id: 'l_' + Date.now(),
      name: newLinkName.trim(),
      url: newLinkUrl.trim(),
      icon: newLinkIcon.trim() || 'fab fa-telegram'
    };
    setSupportLinks((prev) => [...prev, newLink]);
    setNewLinkName('');
    setNewLinkUrl('');
    showToast('Support link added!', 'success');
    haptic('success');
  };

  const handleDeleteSupportLink = (id: string) => {
    setSupportLinks((prev) => prev.filter((l) => l.id !== id));
    showToast('Support link removed', 'info');
  };

  // Export Backup JSON
  const handleExportBackup = () => {
    try {
      const backupData = {
        exportedAt: new Date().toISOString(),
        usersCount: allUsersList.length,
        ordersCount: allAdminOrdersList.length,
        users: allUsersList,
        orders: allAdminOrdersList,
        services: allServices,
        deposits: allDepositRequests
      };
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smm_panel_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Backup JSON downloaded successfully!', 'success');
      haptic('success');
    } catch (e) {
      showToast('Failed to export backup JSON', 'error');
    }
  };

  // Handler: Login (Username or Gmail/Email)
  const handleLogin = async () => {
    if (authSubmitting) return;
    setLoginUserErr('');
    setLoginPassErr('');

    const identifier = loginUsername.trim().toLowerCase();
    let err = false;
    if (!identifier) {
      setLoginUserErr('Username or Email is required (‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶®‡¶æ‡¶Æ ‡¶¨‡¶æ ‡¶ú‡¶ø‡¶Æ‡ßá‡¶á‡¶≤ ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶®)');
      err = true;
    }
    if (!loginPassword) {
      setLoginPassErr('Password is required (‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶° ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶®)');
      err = true;
    }
    if (err) {
      haptic('error');
      return;
    }

    setAuthSubmitting(true);
    haptic('heavy');

    try {
      let userDoc: any = null;
      let userData: any = null;

      // 1. Try finding by username
      const qUser = query(
        collection(db, 'auth_users'),
        where('username', '==', identifier)
      );
      const snapUser = await getDocs(qUser);

      if (!snapUser.empty) {
        userDoc = snapUser.docs[0];
        userData = userDoc.data();
      } else {
        // 2. Try finding by email
        const qEmail = query(
          collection(db, 'auth_users'),
          where('email', '==', identifier)
        );
        const snapEmail = await getDocs(qEmail);
        if (!snapEmail.empty) {
          userDoc = snapEmail.docs[0];
          userData = userDoc.data();
        }
      }

      if (!userDoc || !userData) {
        setLoginUserErr('Account not found with this username or email. (‡¶è‡¶ï‡¶æ‡¶â‡¶®‡ßç‡¶ü ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶Ø‡¶æ‡ßü‡¶®‡¶ø)');
        haptic('error');
        setAuthSubmitting(false);
        return;
      }

      const hashedPass = await simpleHash(loginPassword);

      if (userData.password !== hashedPass) {
        setLoginPassErr('Incorrect password (‡¶≠‡ßÅ‡¶≤ ‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶°)');
        haptic('error');
        setAuthSubmitting(false);
        return;
      }

      const session: UserSession = {
        uid: userDoc.id,
        username: userData.username,
        name: userData.name,
        email: userData.email || '',
        photoURL: userData.photoURL || ''
      };
      currentUserSessionLogin(session);
      showToast(`Welcome back, ${userData.name}! üéâ`, 'success');
    } catch (e: any) {
      console.error('Login error:', e);
      haptic('error');
      showToast('Login failed. Please try again.', 'error');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Handler: Register (with required Gmail / Email)
  const handleRegister = async () => {
    if (authSubmitting) return;
    setRegNameErr('');
    setRegUserErr('');
    setRegEmailErr('');
    setRegPassErr('');
    setRegConfirmErr('');

    const name = regName.trim();
    const username = regUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const email = regEmail.trim().toLowerCase();
    const password = regPassword;
    const confirm = regConfirmPass;

    let err = false;
    if (!name || name.length < 2) {
      setRegNameErr('Name is required (min 2 chars)');
      err = true;
    }
    if (!username || username.length < 3) {
      setRegUserErr('Username required (min 3 chars, letters/numbers/_)');
      err = true;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setRegEmailErr('Gmail / Email is required (‡¶ú‡¶ø‡¶Æ‡ßá‡¶á‡¶≤ ‡¶¶‡ßá‡¶ì‡¶Ø‡¶º‡¶æ ‡¶Ü‡¶¨‡¶∂‡ßç‡¶Ø‡¶ï)');
      err = true;
    } else if (!emailRegex.test(email)) {
      setRegEmailErr('Please enter a valid email address (‡¶∏‡¶†‡¶ø‡¶ï ‡¶á‡¶Æ‡ßá‡¶á‡¶≤ ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶®)');
      err = true;
    }
    if (!password || password.length < 6) {
      setRegPassErr('Password required (min 6 chars)');
      err = true;
    }
    if (password !== confirm) {
      setRegConfirmErr('Passwords do not match (‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶° ‡¶Æ‡¶ø‡¶≤‡¶õ‡ßá ‡¶®‡¶æ)');
      err = true;
    }
    if (err) {
      haptic('error');
      return;
    }

    setAuthSubmitting(true);
    haptic('heavy');

    try {
      // 1. Check if username is already taken
      const qUser = query(collection(db, 'auth_users'), where('username', '==', username));
      const existingUser = await getDocs(qUser);
      if (!existingUser.empty) {
        setRegUserErr('This username is already taken (‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶®‡¶æ‡¶Æ‡¶ü‡¶ø ‡¶™‡ßÇ‡¶∞‡ßç‡¶¨‡ßá ‡¶¨‡ßç‡¶Ø‡¶¨‡¶π‡ßÉ‡¶§)');
        haptic('error');
        setAuthSubmitting(false);
        return;
      }

      // 2. Check if email is already taken
      const qEmail = query(collection(db, 'auth_users'), where('email', '==', email));
      const existingEmail = await getDocs(qEmail);
      if (!existingEmail.empty) {
        setRegEmailErr('An account with this email already exists (‡¶è‡¶á ‡¶ú‡¶ø‡¶Æ‡ßá‡¶á‡¶≤ ‡¶¶‡¶ø‡ßü‡ßá ‡¶™‡ßÇ‡¶∞‡ßç‡¶¨‡ßá ‡¶è‡¶ï‡¶æ‡¶â‡¶®‡ßç‡¶ü ‡¶ñ‡ßã‡¶≤‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá)');
        haptic('error');
        setAuthSubmitting(false);
        return;
      }

      const hashedPass = await simpleHash(password);
      const newDoc = doc(collection(db, 'auth_users'));
      const uid = newDoc.id;

      // Check referral code
      let referrerUid: string | null = null;
      let referrerUsername: string | null = null;
      const refInput = (regReferralCode || localStorage.getItem('smm_referral_ref') || '').trim().toLowerCase();
      if (refInput) {
        try {
          const qRef = query(collection(db, 'auth_users'), where('username', '==', refInput));
          const refSnap = await getDocs(qRef);
          if (!refSnap.empty) {
            referrerUid = refSnap.docs[0].id;
            referrerUsername = refSnap.docs[0].data().username || refInput;
          } else {
            // Check by UID
            const uDoc = await getDoc(doc(db, 'users', refInput));
            if (uDoc.exists()) {
              referrerUid = refInput;
              referrerUsername = uDoc.data().name || 'Referrer';
            }
          }
        } catch (rErr) {
          console.error('Referral lookup error:', rErr);
        }
      }

      await setDoc(newDoc, {
        username,
        name,
        email,
        password: hashedPass,
        createdAt: serverTimestamp(),
        telegramId: tg?.initDataUnsafe?.user?.id || null,
        referredBy: referrerUid,
        referredByUsername: referrerUsername
      });

      await setDoc(doc(db, 'users', uid), {
        name,
        username,
        email,
        balance: 0,
        total_orders: 0,
        totalReferrals: 0,
        totalReferralEarnings: 0,
        referredBy: referrerUid,
        referredByUsername: referrerUsername,
        createdAt: serverTimestamp()
      });

      // Increment referrer's count and send notification if referred
      if (referrerUid) {
        try {
          const refUserRef = doc(db, 'users', referrerUid);
          const refSnap = await getDoc(refUserRef);
          if (refSnap.exists()) {
            const currentTotalRefs = refSnap.data().totalReferrals || 0;
            await updateDoc(refUserRef, {
              totalReferrals: currentTotalRefs + 1
            });

            await addDoc(collection(db, 'user_notifications'), {
              uid: referrerUid,
              title: `üë• ‡¶®‡¶§‡ßÅ‡¶® ‡¶∞‡ßá‡¶´‡¶æ‡¶∞‡ßá‡¶≤ ‡¶Æ‡ßá‡¶Æ‡ßç‡¶¨‡¶æ‡¶∞ ‡¶ú‡ßü‡ßá‡¶® ‡¶ï‡¶∞‡ßá‡¶õ‡ßá!`,
              message: `@${username} (${name}) ‡¶Ü‡¶™‡¶®‡¶æ‡¶∞ ‡¶∞‡ßá‡¶´‡¶æ‡¶∞‡ßá‡¶≤ ‡¶≤‡¶ø‡¶Ç‡¶ï‡ßá‡¶∞ ‡¶Æ‡¶æ‡¶ß‡ßç‡¶Ø‡¶Æ‡ßá ‡¶è‡¶ï‡¶æ‡¶â‡¶®‡ßç‡¶ü ‡¶ñ‡ßÅ‡¶≤‡ßá‡¶õ‡ßá! ‡¶è‡¶á ‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶ï‡¶∞‡¶≤‡ßá ‡¶Ü‡¶™‡¶®‡¶ø ‡ß´% ‡¶≤‡¶æ‡¶á‡¶´‡¶ü‡¶æ‡¶á‡¶Æ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶∂ ‡¶ï‡¶Æ‡¶ø‡¶∂‡¶® ‡¶™‡¶æ‡¶¨‡ßá‡¶®!`,
              type: 'promo',
              timestamp: serverTimestamp(),
              unread: true
            });
          }
        } catch (refIncErr) {
          console.error('Referral increment error:', refIncErr);
        }
      }

      const session: UserSession = { uid, username, name, email };
      currentUserSessionLogin(session);
      showToast('Account created successfully! üéâ', 'success');
    } catch (e: any) {
      console.error('Registration error:', e);
      haptic('error');
      showToast('Registration failed.', 'error');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const currentUserSessionLogin = (session: UserSession) => {
    localStorage.setItem('smm_session', JSON.stringify(session));
    setCurrentUser(session);
    setIsLoggedIn(true);
    setShowWelcomeModal(true);
    haptic('success');
  };

  const handleLogout = () => {
    setModalConfig({
      show: true,
      title: 'Logout',
      bodyHtml: <p className="text-slate-300 text-sm">Are you sure you want to logout?</p>,
      onConfirm: async () => {
        try {
          await signOut(auth);
        } catch (_) {}
        localStorage.removeItem('smm_session');
        setIsLoggedIn(false);
        setCurrentUser(null);
        showToast('Logged out', 'info');
      }
    });
  };

  // Category Change
  const handleCategoryChange = (cat: string) => {
    haptic('light');
    setSelectedCategory(cat);
    setCatErr('');
    
    // Auto select first service in this category for instant order flow
    const filtered = allServices.filter((s) => s.category === cat);
    if (filtered.length > 0) {
      setSelectedServiceId(filtered[0].id);
      setCurrentService(filtered[0]);
      setQuantity(filtered[0].min || 1000);
      setSvcErr('');
    } else {
      setSelectedServiceId('');
      setCurrentService(null);
      setSvcErr('');
    }
  };

  // Direct Platform Logo Click Handler (Auto-select category & smooth scroll to order form)
  const handleSelectPlatformLogo = (platformId: string) => {
    haptic('heavy');
    const pLower = platformId.toLowerCase();
    
    // Search categories for closest matching platform
    const match = categories.find((c) => {
      const cLower = c.toLowerCase();
      if (pLower === 'facebook' && (cLower.includes('facebook') || cLower.includes('fb'))) return true;
      if (pLower === 'instagram' && (cLower.includes('instagram') || cLower.includes('ig'))) return true;
      if (pLower === 'tiktok' && (cLower.includes('tiktok') || cLower.includes('tt'))) return true;
      if (pLower === 'youtube' && (cLower.includes('youtube') || cLower.includes('yt'))) return true;
      if (pLower === 'telegram' && (cLower.includes('telegram') || cLower.includes('tg'))) return true;
      if (pLower === 'twitter' && (cLower.includes('twitter') || cLower.includes('x'))) return true;
      if (pLower === 'website' && (cLower.includes('web') || cLower.includes('seo') || cLower.includes('website') || cLower.includes('traffic'))) return true;
      if (pLower === 'whatsapp' && (cLower.includes('whatsapp') || cLower.includes('wa'))) return true;
      if (pLower === 'snapchat' && (cLower.includes('snapchat') || cLower.includes('sc'))) return true;
      if (pLower === 'spotify' && cLower.includes('spotify')) return true;
      if (pLower === 'discord' && cLower.includes('discord')) return true;
      if (pLower === 'linkedin' && cLower.includes('linkedin')) return true;
      return cLower.includes(pLower);
    });

    if (match) {
      handleCategoryChange(match);
      showToast(`Selected ${match}`, 'info');
    } else if (categories.length > 0) {
      // Fallback if category name in db differs
      handleCategoryChange(categories[0]);
    }

    // Scroll smoothly to order form
    setTimeout(() => {
      const el = document.getElementById('order-form');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
  };

  // Search Select Service Handler
  const handleSelectServiceFromSearch = (service: ServiceData) => {
    haptic('heavy');
    setSelectedCategory(service.category);
    setSelectedServiceId(service.id);
    setCurrentService(service);
    setQuantity(service.min || 1000);
    setSvcErr('');
    setShowSearchModal(false);
    showToast(`Selected: ${service.name}`, 'info');

    setTimeout(() => {
      const el = document.getElementById('order-form');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Notification Helpers
  const unreadNotifCount = notifications.filter((n) => n.unread).length;
  const markAllNotifsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    haptic('light');
    showToast('All notifications marked as read', 'success');
  };

  // Mailbox Helpers
  const unreadMailCount = mailList.filter((m) => m.unread).length;
  const markMailRead = (id: string) => {
    setMailList((prev) => prev.map((m) => (m.id === id ? { ...m, unread: false } : m)));
  };

  const handleSendMail = () => {
    if (!mailSubject.trim()) {
      showToast('Subject is required', 'error');
      return;
    }
    if (!mailMessage.trim()) {
      showToast('Message content is required', 'error');
      return;
    }
    setMailSubmitting(true);
    setTimeout(() => {
      const newMail = {
        id: 'm_' + Date.now(),
        sender: currentUser?.name || 'You',
        subject: mailSubject,
        message: mailMessage,
        time: 'Just now',
        unread: false,
        isAdminReply: false
      };
      setMailList((prev) => [newMail, ...prev]);
      setMailSubject('');
      setMailMessage('');
      setMailSubmitting(false);
      setMailboxTab('inbox');
      haptic('success');
      showToast('Mail sent to support! (‡¶Æ‡ßá‡¶á‡¶≤ ‡¶™‡¶æ‡¶†‡¶æ‡¶®‡ßã ‡¶π‡¶Ø‡¶º‡ßá‡¶õ‡ßá)', 'success');
    }, 400);
  };

  // Service Change
  const handleServiceChange = (svcId: string) => {
    haptic('light');
    setSelectedServiceId(svcId);
    setSvcErr('');
    const found = allServices.find((s) => s.id === svcId) || null;
    setCurrentService(found);
    if (found?.min) {
      setQuantity(found.min);
    }
  };

  // Cost calculation
  const calculatedCost = currentService ? (currentService.price * quantity) / 1000 : 0;

  // Order Stepper Progress Tracker ("‡¶∞‡ßã‡¶ó" / Dynamic Progress Track)
  const isStep1Done = Boolean(selectedCategory);
  const isStep2Done = Boolean(selectedServiceId && currentService);
  const isStep3Done = Boolean(targetLink.trim().length >= 4);
  const isStep4Done = Boolean(
    quantity > 0 &&
      currentService &&
      quantity >= currentService.min &&
      (!currentService.max || quantity <= currentService.max)
  );

  let orderStepProgress = 10;
  let activeStepIndex = 1;
  if (!isStep1Done) {
    orderStepProgress = 15;
    activeStepIndex = 1;
  } else if (!isStep2Done) {
    orderStepProgress = 35;
    activeStepIndex = 2;
  } else if (!isStep3Done) {
    orderStepProgress = 60;
    activeStepIndex = 3;
  } else if (!isStep4Done) {
    orderStepProgress = 85;
    activeStepIndex = 4;
  } else {
    orderStepProgress = 100;
    activeStepIndex = 5;
  }

  // SMMGen API Call Helper
  const placeSmmGenOrderApi = async (
    serviceId: string,
    link: string,
    qty: number
  ): Promise<{ error?: string; order?: number; status?: string }> => {
    const apiKey = '64994346bbbbeeaa10307df325162283';
    const mappedService = SERVICE_ID_MAP[serviceId] || serviceId;
    const finalService = mappedService && mappedService.length >= 4 ? mappedService : '15806';

    const queryParams = new URLSearchParams({
      key: apiKey,
      action: 'add',
      service: String(finalService),
      link: String(link),
      quantity: String(qty)
    }).toString();

    // 1. Try Netlify / Vite Proxy GET endpoint
    try {
      const res = await fetch(`/api/smm/order?${queryParams}`);
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().startsWith('{')) {
          const json = JSON.parse(text);
          if (json.order || json.error) return json;
        }
      }
    } catch (e) {
      console.warn('GET proxy attempt failed:', e);
    }

    // 2. Try Netlify / Vite Proxy POST endpoint
    try {
      const proxyRes = await fetch('/api/smm/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: finalService,
          link,
          quantity: qty,
          apiKey,
          apiBase: 'https://my.smmgen.com/api/v2'
        })
      });

      if (proxyRes.ok) {
        const text = await proxyRes.text();
        if (text && text.trim().startsWith('{')) {
          const json = JSON.parse(text);
          if (json.order || json.error) return json;
        }
      }
    } catch (e) {
      console.warn('POST proxy attempt failed:', e);
    }

    // 3. Fallback: Direct fetch
    try {
      const targetUrl = `https://my.smmgen.com/api/v2?${queryParams}`;
      const res = await fetch(targetUrl);
      if (res.ok) {
        const json = await res.json();
        return json;
      }
    } catch (e) {
      console.warn('Direct fetch failed:', e);
    }

    return { error: 'API connection error. Please check your netlify redirect setup.' };
  };

  // Place Order Action
  const handlePlaceOrderClick = () => {
    setCatErr('');
    setSvcErr('');
    setLinkErr('');
    setQtyErr('');

    if (!selectedCategory) {
      setCatErr('Please select a category');
      haptic('error');
      return;
    }
    if (!selectedServiceId || !currentService) {
      setSvcErr('Please select a service');
      haptic('error');
      return;
    }
    if (!targetLink.trim() || targetLink.trim().length < 5) {
      setLinkErr('Please enter a valid link/URL');
      haptic('error');
      return;
    }

    const minQty = currentService.min || 10;
    const maxQty = currentService.max || 999999999;

    if (!quantity || quantity < minQty) {
      setQtyErr(`Minimum quantity is ${minQty}`);
      haptic('error');
      return;
    }
    if (quantity > maxQty) {
      setQtyErr(`Maximum quantity is ${maxQty.toLocaleString()}`);
      haptic('error');
      return;
    }

    if (userBalance < calculatedCost) {
      haptic('error');
      setModalConfig({
        show: true,
        title: 'Insufficient Balance',
        bodyHtml: (
          <div className="space-y-2">
            <p className="text-slate-300 text-xs">You need more Coins to place this order.</p>
            <div className="bg-red-500/10 border border-red-500/15 rounded-xl p-3 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400 text-xs">Required Cost:</span>
                <span className="font-bold text-red-400">{calculatedCost.toFixed(2)} Coins</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-xs">Your Balance:</span>
                <span className="font-bold">{userBalance.toFixed(2)} Coins</span>
              </div>
              <div className="flex justify-between border-t border-red-500/10 pt-1 mt-1">
                <span className="text-slate-400 text-xs">Shortage:</span>
                <span className="font-extrabold text-red-400">
                  {(calculatedCost - userBalance).toFixed(2)} Coins
                </span>
              </div>
            </div>
          </div>
        ),
        onConfirm: () => setActiveTab('funds')
      });
      return;
    }

    // Confirm Modal
    setModalConfig({
      show: true,
      title: 'Confirm Your Order',
      bodyHtml: (
        <div className="space-y-2 text-xs">
          <div className="flex justify-between py-1.5 border-b border-dashed border-slate-700">
            <span className="text-slate-400">Service</span>
            <span className="font-bold text-right max-w-[60%]">{currentService.name}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-dashed border-slate-700">
            <span className="text-slate-400">Quantity</span>
            <span className="font-bold">{quantity.toLocaleString()}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-dashed border-slate-700">
            <span className="text-slate-400">Cost</span>
            <span className="font-bold text-blue-400">{calculatedCost.toFixed(2)} Coins</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-400">Remaining Balance</span>
            <span className="font-bold">{(userBalance - calculatedCost).toFixed(2)} Coins</span>
          </div>
        </div>
      ),
      onConfirm: () => executeOrderSubmission()
    });
  };

  const executeOrderSubmission = async () => {
    if (!currentUser || !currentService || orderSubmitting) return;

    setOrderSubmitting(true);
    haptic('heavy');

    try {
      const cost = calculatedCost;
      const sname = currentService.name;
      const link = targetLink.trim();
      const qty = quantity;
      const apiSvcId = currentService.apiServiceId || '15806';

      // 1. Create order document in Firestore
      const orderRef = await addDoc(collection(db, 'orders'), {
        uid: currentUser.uid,
        service: sname,
        qty,
        link,
        cost,
        status: 'Pending',
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString()
      });

      // 2. Deduct user balance in Firestore
      const newBalance = userBalance - cost;
      const newOrdersCount = userTotalOrders + 1;
      await updateDoc(doc(db, 'users', currentUser.uid), {
        balance: newBalance,
        total_orders: newOrdersCount
      });

      setUserBalance(newBalance);
      setUserTotalOrders(newOrdersCount);

      // 3. Trigger SMMGen API call
      showToast('Sending order to SMM Panel...', 'info');
      const apiResponse = await placeSmmGenOrderApi(apiSvcId, link, qty);

      if (apiResponse.order) {
        // API Success
        await updateDoc(doc(db, 'orders', orderRef.id), {
          apiOrderId: apiResponse.order,
          apiStatus: apiResponse.status || 'processing',
          status: 'Processing',
          processedAt: serverTimestamp()
        });
        haptic('success');
        showToast(`‚úÖ Order sent to SMM Panel! ID: ${apiResponse.order}`, 'success');
      } else {
        // API returned error
        const apiErr = apiResponse.error || 'Failed to submit to SMM provider';
        await updateDoc(doc(db, 'orders', orderRef.id), {
          apiError: apiErr
        });
        haptic('error');
        showToast(`‚ö†Ô∏è Order saved locally. API error: ${apiErr}`, 'warning');
      }

            // 4. Background Telegram Live Notification to 2 channels (@RF2_SMM & @FARJU_SMM_PANAL)
      try {
        if (telegramConfig.enabled) {
          fetch('/api/telegram/order-notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: orderRef.id,
              apiOrderId: apiResponse?.order || null,
              serviceName: sname,
              category: selectedCategory || currentService?.category || 'SMM Service',
              quantity: qty,
              cost: cost,
              link: link,
              userName: currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'RF SMM Client'),
              userEmail: currentUser.email || '',
              status: apiResponse?.order ? 'Processing ‚ö°' : 'Pending ‚è≥',
              createdAt: new Date().toISOString(),
              siteLogo: telegramConfig.customPhotoUrl || adminSiteLogo || welcomeConfig.siteLogo || '',
              botToken: telegramConfig.botToken,
              channels: telegramConfig.channels,
              enabled: telegramConfig.enabled,
            })
          }).catch((tgErr) => console.warn('Silent TG notification:', tgErr));
        }
      } catch (_) {}

      // Reset form fields
      setTargetLink('');
      setQuantity(100);
      setSelectedServiceId('');
      setCurrentService(null);
      setSelectedCategory('');

      setTimeout(() => {
        setActiveTab('orders');
      }, 1000);
    } catch (e: any) {
      console.error('Order error:', e);
      haptic('error');
      showToast('Failed to process order: ' + e.message, 'error');
    } finally {
      setOrderSubmitting(false);
    }
  };

  // Retry API order
  const handleRetryOrder = async (order: OrderData) => {
    haptic('heavy');
    showToast('Retrying SMM Panel dispatch...', 'info');

    try {
      const serviceObj = allServices.find((s) => s.name === order.service);
      const apiSvcId = serviceObj?.apiServiceId || '101';

      const res = await placeSmmGenOrderApi(apiSvcId, order.link, order.qty);

      if (res.order) {
        await updateDoc(doc(db, 'orders', order.id), {
          apiOrderId: res.order,
          apiStatus: res.status || 'processing',
          status: 'Processing',
          apiError: null,
          processedAt: serverTimestamp()
        });
        haptic('success');
        showToast(`‚úÖ Order dispatched! API ID: ${res.order}`, 'success');
      } else {
        showToast(`Retry failed: ${res.error || 'Unknown error'}`, 'error');
      }
    } catch (err: any) {
      showToast('Retry error: ' + err.message, 'error');
    }
  };

  // Submit Deposit Request
  const handleSubmitDeposit = async () => {
    setDepAmtErr('');
    setDepTrxErr('');

    const amt = parseFloat(depositAmount);
    const trx = depositTrxId.trim().toUpperCase();

    const activeConfig = paymentMethodsConfig[selectedMethod] ||
      (Object.values(paymentMethodsConfig) as PaymentMethodConfig[]).find((m) => m && (m.id === selectedMethod || m.label === selectedMethod)) || {
        id: selectedMethod,
        label: selectedMethod,
        number: '01840442809',
        isCrypto: false
      };

    const isCrypto = !!activeConfig.isCrypto;
    const minAmt = isCrypto ? 12 : 10;

    let err = false;
    if (isNaN(amt) || amt < minAmt) {
      setDepAmtErr(isCrypto ? '‡¶∏‡¶∞‡ßç‡¶¨‡¶®‡¶ø‡¶Æ‡ßç‡¶® ‡¶™‡¶∞‡¶ø‡¶Æ‡¶æ‡¶£ ‡ß≥ ‡ßß‡ß® (0.10$)' : '‡¶∏‡¶∞‡ßç‡¶¨‡¶®‡¶ø‡¶Æ‡ßç‡¶® ‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶™‡¶∞‡¶ø‡¶Æ‡¶æ‡¶£ ‡ß≥ ‡ßß‡ß¶');
      err = true;
    }
    if (amt > 100000) {
      setDepAmtErr('‡¶∏‡¶∞‡ßç‡¶¨‡ßã‡¶ö‡ßç‡¶ö ‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶™‡¶∞‡¶ø‡¶Æ‡¶æ‡¶£ ‡ß≥ ‡ßß‡ß¶‡ß¶,‡ß¶‡ß¶‡ß¶');
      err = true;
    }
    if (!trx || trx.length < 3) {
      setDepTrxErr('‡¶Ö‡¶®‡ßÅ‡¶ó‡ßç‡¶∞‡¶π ‡¶ï‡¶∞‡ßá ‡¶∏‡¶†‡¶ø‡¶ï Transaction ID ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶®');
      err = true;
    }
    if (err) {
      haptic('error');
      return;
    }

    if (!currentUser?.uid || depositSubmitting) return;

    setDepositSubmitting(true);
    haptic('heavy');

    try {
      await addDoc(collection(db, 'deposit_requests'), {
        uid: currentUser.uid,
        username: currentUser.username || '',
        name: currentUser.name || '',
        referredBy: currentUser.referredBy || null,
        referredByUsername: currentUser.referredByUsername || null,
        amount: amt,
        trxId: trx,
        method: activeConfig.label || selectedMethod,
        screenshotUrl: depositReceiptImage || '',
        status: 'Pending',
        timestamp: serverTimestamp()
      });

      haptic('success');
      showToast('üéâ ‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶∞‡¶ø‡¶ï‡ßã‡¶Ø‡¶º‡ßá‡¶∏‡ßç‡¶ü ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶ú‡¶Æ‡¶æ ‡¶π‡¶Ø‡¶º‡ßá‡¶õ‡ßá! ‡¶è‡¶°‡¶Æ‡¶ø‡¶® ‡¶ñ‡ßÅ‡¶¨ ‡¶¶‡ßç‡¶∞‡ßÅ‡¶§ ‡¶≠‡ßá‡¶∞‡¶ø‡¶´‡¶æ‡¶á ‡¶ï‡¶∞‡ßá ‡¶¨‡ßç‡¶Ø‡¶æ‡¶≤‡ßá‡¶®‡ßç‡¶∏ ‡¶Ø‡ßã‡¶ó ‡¶ï‡¶∞‡¶¨‡ßá‡¶®‡•§', 'success');
      setDepositTrxId('');
      setDepositReceiptImage('');
      setDepositReceiptFileName('');
      setDepositStep('amount');
    } catch (e: any) {
      console.error('Deposit error:', e);
      haptic('error');
      showToast('‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶∞‡¶ø‡¶ï‡ßã‡¶Ø‡¶º‡ßá‡¶∏‡ßç‡¶ü ‡¶ú‡¶Æ‡¶æ ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶• ‡¶π‡¶Ø‡¶º‡ßá‡¶õ‡ßá: ' + e.message, 'error');
    } finally {
      setDepositSubmitting(false);
    }
  };

  const copyNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    haptic('success');
    showToast('Number copied to clipboard!', 'success');
  };

  // Admin: Quick Price Update for Service
  const handleQuickPriceUpdate = async (svcId: string, svcName: string, deltaOrNewVal: number | string, isDelta: boolean = false, currentPrice: number = 0) => {
    let finalPrice = 0;
    if (isDelta) {
      finalPrice = Math.max(0.1, Math.round((currentPrice + Number(deltaOrNewVal)) * 100) / 100);
    } else {
      const parsed = parseFloat(String(deltaOrNewVal));
      if (isNaN(parsed) || parsed < 0) {
        showToast('Please enter a valid price', 'error');
        haptic('error');
        return;
      }
      finalPrice = Math.round(parsed * 100) / 100;
    }

    setAdminUpdatingPriceId(svcId);
    try {
      await updateDoc(doc(db, 'services', svcId), {
        price: finalPrice
      });
      setAdminQuickPriceInputs((prev) => {
        const next = { ...prev };
        delete next[svcId];
        return next;
      });
      haptic('success');
      showToast(`‚úÖ "${svcName}" ‡¶è‡¶∞ ‡¶¶‡¶æ‡¶Æ ‡ß≥${finalPrice} ‡¶Ü‡¶™‡¶°‡ßá‡¶ü ‡¶π‡ßü‡ßá‡¶õ‡ßá!`, 'success');
    } catch (err: any) {
      console.error('Price update error:', err);
      showToast('‡¶¶‡¶æ‡¶Æ ‡¶Ü‡¶™‡¶°‡ßá‡¶ü ‡¶ï‡¶∞‡¶§‡ßá ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶• ‡¶π‡ßü‡ßá‡¶õ‡ßá!', 'error');
      haptic('error');
    } finally {
      setAdminUpdatingPriceId(null);
    }
  };

  // Admin: Save or Update Service Manually
  const handleSaveServiceManual = async () => {
    if (!adminCategory.trim() || !adminName.trim() || !adminPrice) {
      showToast('Category, Name, and Price are required!', 'error');
      haptic('error');
      return;
    }

    const priceNum = parseFloat(adminPrice);
    const minNum = parseInt(adminMin) || 10;
    const maxNum = parseInt(adminMax) || 1000000;

    if (isNaN(priceNum) || priceNum <= 0) {
      showToast('Enter a valid price', 'error');
      haptic('error');
      return;
    }

    setAdminSubmitting(true);
    haptic('heavy');

    try {
      const svcData = {
        category: adminCategory.trim(),
        name: adminName.trim(),
        price: priceNum,
        min: minNum,
        max: maxNum,
        desc: adminDesc.trim(),
        apiServiceId: adminApiServiceId.trim()
      };

      if (editingServiceId) {
        await updateDoc(doc(db, 'services', editingServiceId), svcData);
        showToast('‚úÖ Service updated successfully!', 'success');
      } else {
        await addDoc(collection(db, 'services'), svcData);
        showToast('‚úÖ Service added to Firestore!', 'success');
      }

      // Reset form
      setAdminCategory('');
      setAdminName('');
      setAdminPrice('');
      setAdminMin('100');
      setAdminMax('100000');
      setAdminDesc('');
      setAdminApiServiceId('');
      setEditingServiceId(null);
      haptic('success');
    } catch (err: any) {
      console.error('Error saving service:', err);
      showToast('Failed to save service: ' + err.message, 'error');
      haptic('error');
    } finally {
      setAdminSubmitting(false);
    }
  };

  // Admin: Edit Click
  const handleEditServiceClick = (svc: ServiceData) => {
    setEditingServiceId(svc.id);
    setAdminCategory(svc.category || '');
    setAdminName(svc.name || '');
    setAdminPrice(String(svc.price || ''));
    setAdminMin(String(svc.min || '100'));
    setAdminMax(String(svc.max || '100000'));
    setAdminDesc(svc.desc || '');
    setAdminApiServiceId(svc.apiServiceId || '');
    haptic('light');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Admin: Delete Service
  const handleDeleteService = (svcId: string, svcName: string) => {
    setModalConfig({
      show: true,
      title: 'Delete Service',
      bodyHtml: <p className="text-slate-300 text-xs">Are you sure you want to delete <strong>{svcName}</strong>?</p>,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'services', svcId));
          showToast('Service deleted!', 'info');
          haptic('success');
        } catch (e: any) {
          showToast('Failed to delete service', 'error');
        }
      }
    });
  };

  // Admin: Manual Import Defaults (One-Click manual trigger)
  const handleManualImportDefaults = () => {
    setModalConfig({
      show: true,
      title: 'Import Default Services',
      bodyHtml: <p className="text-slate-300 text-xs">Are you sure you want to import default preset services into Firestore?</p>,
      onConfirm: async () => {
        haptic('heavy');
        showToast('Importing services to database...', 'info');
        let addedCount = 0;
        try {
          const existingNames = new Set(allServices.map((s) => s.name));
          for (const svc of DEFAULT_SERVICES) {
            if (!existingNames.has(svc.name)) {
              await addDoc(collection(db, 'services'), svc);
              addedCount++;
            }
          }
          showToast(`‚úÖ ${addedCount} services imported successfully!`, 'success');
          haptic('success');
        } catch (e: any) {
          showToast('Import failed: ' + e.message, 'error');
          haptic('error');
        }
      }
    });
  };

  // Admin: Approve Deposit
  const handleApproveDeposit = async (dep: DepositRequest) => {
    try {
      const uRef = doc(db, 'users', dep.uid);
      const uSnap = await getDoc(uRef);
      if (uSnap.exists()) {
        const curBal = uSnap.data().balance || 0;
        await updateDoc(uRef, { balance: curBal + dep.amount });
      } else {
        await setDoc(uRef, { balance: dep.amount, total_orders: 0, createdAt: serverTimestamp() });
      }

      await updateDoc(doc(db, 'deposit_requests', dep.id), { status: 'Approved' });
      await processReferralDepositBonus(dep.uid, dep.amount, dep.trxId);
      showToast(`‚úÖ Approved ‡ß≥${dep.amount} deposit for ${dep.trxId}`, 'success');
      haptic('success');
    } catch (e: any) {
      showToast('Approval error: ' + e.message, 'error');
    }
  };

  return (
    <div className="max-w-[480px] mx-auto min-h-screen relative pb-28">
      {/* Live 3D Canvas Background (controlled globally by admin) */}
      {welcomeConfig.is3DCanvasGlobal !== false && (
        <Live3DCanvas currentTheme={threeDTheme} isInteractive={is3DEnabled} />
      )}

      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-item toast-${t.type}`}>
            <i
              className={`fas ${
                t.type === 'success'
                  ? 'fa-check-circle'
                  : t.type === 'error'
                  ? 'fa-times-circle'
                  : t.type === 'warning'
                  ? 'fa-exclamation-triangle'
                  : 'fa-info-circle'
              }`}
            ></i>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      <div className={`modal-overlay ${modalConfig.show ? 'show' : ''}`}>
        <div className="modal-sheet">
          <div className="modal-handle"></div>
          <h3 className="text-lg font-black mb-2">{modalConfig.title}</h3>
          <div className="mb-6">{modalConfig.bodyHtml}</div>
          <div className="flex gap-3">
            <button
              onClick={() => setModalConfig((prev) => ({ ...prev, show: false }))}
              className="btn-secondary-solid flex-1"
              style={{ padding: '14px' }}
            >
              CANCEL
            </button>
            <button
              onClick={() => {
                setModalConfig((prev) => ({ ...prev, show: false }));
                modalConfig.onConfirm();
              }}
              className="btn-primary-solid flex-1"
              style={{ padding: '14px' }}
            >
              CONFIRM
            </button>
          </div>
        </div>
      </div>

      {/* Splash Screen */}
      {showSplash && (
        <div className="fixed inset-0 z-[9999] splash-bg flex flex-col items-center justify-center p-6 select-none overflow-hidden">
          {/* Ambient Cosmic Flares */}
          <div className="absolute w-96 h-96 rounded-full bg-amber-500/15 blur-3xl pointer-events-none animate-pulse -top-10" />
          <div className="absolute w-80 h-80 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none animate-pulse -bottom-10" />

          {/* 3D Royal Medallion & Crest / Custom Logo */}
          <div className="relative mb-8 w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center animate-vvip-float">
            {/* Outer Rotating Golden Orbit Rings */}
            <div
              className="absolute -inset-4 sm:-inset-5 rounded-full border-2 border-amber-400/40 border-dashed animate-spin shadow-[0_0_30px_rgba(251,191,36,0.3)]"
              style={{ animationDuration: '16s' }}
            />
            <div
              className="absolute -inset-1 sm:-inset-2 rounded-full border border-cyan-400/50 border-dotted animate-spin shadow-[0_0_20px_rgba(56,189,248,0.3)]"
              style={{ animationDuration: '24s', animationDirection: 'reverse' }}
            />



            {/* 3D Sculpted Golden-Beveled Glass Shield */}
            <div
              className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-[30px] p-[2px] bg-gradient-to-br from-amber-300 via-yellow-500 via-cyan-400 to-indigo-600 shadow-[0_0_40px_rgba(251,191,36,0.45),0_0_25px_rgba(56,189,248,0.35)] flex items-center justify-center overflow-hidden"
              style={{
                transform: 'perspective(700px) rotateY(6deg) rotateX(4deg)',
              }}
            >
              {/* Inner Dark Crystal Core */}
              <div className="w-full h-full rounded-[28px] bg-gradient-to-b from-slate-900/95 via-slate-950/90 to-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-2 border border-amber-400/30 relative overflow-hidden">
                {/* Gold Sheen Glint */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent pointer-events-none animate-gold-sheen" />

                {/* Custom Logo or Default Monogram */}
                {adminSiteLogo ? (
                  <div className="relative z-10 flex flex-col items-center justify-center p-1">
                    <img
                      src={adminSiteLogo}
                      alt="Site Logo"
                      className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]"
                    />
                  </div>
                ) : (
                  <div className="relative z-10 flex flex-col items-center justify-center">
                    <div className="relative mb-0.5">
                      <i className="fas fa-crown text-2xl sm:text-3xl text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-yellow-400 to-amber-600 drop-shadow-[0_0_15px_rgba(251,191,36,0.9)] animate-pulse"></i>
                      <i className="fas fa-sparkles text-[8px] text-white absolute -top-1 -right-2 animate-ping"></i>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-black text-xl sm:text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 drop-shadow-[0_0_12px_rgba(251,191,36,0.7)] font-sans">
                        RF
                      </span>
                      <span className="font-black text-[10px] sm:text-xs tracking-wider text-cyan-300 uppercase font-mono px-1 py-0.2 rounded bg-cyan-500/20 border border-cyan-400/40">
                        SMM
                      </span>
                    </div>
                    <span className="text-[8px] font-extrabold text-amber-200/80 tracking-[0.2em] uppercase font-mono mt-0.5">
                      PANEL BD
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Orbiting Mini Badges */}
            <div className="absolute -bottom-2 -left-2 z-20">
              <span className="bg-slate-900/90 text-amber-300 text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow border border-amber-400/40 flex items-center gap-1 font-mono">
                <i className="fas fa-star text-amber-400 text-[8px]"></i>
                #1 BD
              </span>
            </div>
            <div className="absolute -bottom-2 -right-2 z-20">
              <span className="bg-cyan-500/20 text-cyan-300 text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow border border-cyan-400/40 flex items-center gap-1 font-mono">
                <i className="fas fa-bolt text-amber-300 text-[8px]"></i>
                INSTANT ‚ö°
              </span>
            </div>
          </div>

          {/* Typography */}
          <div className="text-center relative z-10 flex flex-col items-center">
            <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-white tracking-tight drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]">
              RF SMM PANEL
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="h-[1px] w-6 bg-gradient-to-r from-transparent to-amber-400/60"></span>
              <p className="text-amber-300 text-[11px] font-extrabold tracking-widest uppercase font-mono">
                BANGLADESH'S #1 SMM PLATFORM
              </p>
              <span className="h-[1px] w-6 bg-gradient-to-l from-transparent to-amber-400/60"></span>
            </div>
          </div>

          {/* Futuristic Loader */}
          <div className="relative mt-8 flex flex-col items-center gap-2">
            <div className="splash-loader">
              <div className="splash-loader-fill"></div>
            </div>
            <span className="text-[10px] font-bold text-slate-400 tracking-wider font-mono flex items-center gap-1.5">
              <i className="fas fa-circle-notch fa-spin text-amber-400 text-[9px]"></i>
              <span>LOADING EXPERIENCE...</span>
            </span>
          </div>
        </div>
      )}

      {/* Auth Screen */}
      {!showSplash && !isLoggedIn && (
        <div className="fixed inset-0 z-[8000] bg-[#030712] flex flex-col items-center justify-center p-6 overflow-y-auto">
          {/* Ambient Glow */}
          <div className="absolute w-72 h-72 rounded-full bg-amber-500/10 blur-3xl pointer-events-none top-10" />

          {/* Auth Medallion */}
          <div className="relative mb-3 flex flex-col items-center">
            <div className="relative w-20 h-20 rounded-2xl p-[2px] bg-gradient-to-br from-amber-300 via-yellow-500 to-cyan-500 shadow-[0_0_30px_rgba(251,191,36,0.4)] flex items-center justify-center">
              <div className="w-full h-full rounded-[14px] bg-slate-950/90 flex flex-col items-center justify-center p-1 border border-amber-400/30">
                {adminSiteLogo ? (
                  <img src={adminSiteLogo} alt="Logo" className="w-12 h-12 object-contain" />
                ) : (
                  <>
                    <i className="fas fa-crown text-amber-300 text-2xl drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]"></i>
                    <span className="text-[9px] font-black text-cyan-300 tracking-wider font-mono uppercase mt-0.5">
                      RF SMM
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="absolute -top-2 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 text-[8px] font-black px-2 py-0.2 rounded-full shadow border border-white font-mono uppercase">
              üëë RF SMM
            </div>
          </div>

          <h1 className="text-2xl font-black tracking-tight mb-1 text-white flex items-center gap-1.5">
            <span>RF SMM</span>
            <span className="text-amber-400 font-normal">PANEL</span>
          </h1>
          <p className="text-xs font-bold tracking-widest uppercase mb-6 text-amber-300/80 font-mono">
            BANGLADESH'S #1 SMM PORTAL
          </p>

          <div className="auth-card auth-animate w-full">
            <div className="auth-tab">
              <button
                className={`auth-tab-btn ${authTab === 'login' ? 'active-tab' : ''}`}
                onClick={() => {
                  setAuthTab('login');
                  haptic('light');
                }}
              >
                Login
              </button>
              <button
                className={`auth-tab-btn ${authTab === 'register' ? 'active-tab' : ''}`}
                onClick={() => {
                  setAuthTab('register');
                  haptic('light');
                }}
              >
                Register
              </button>
            </div>

            {authTab === 'login' ? (
              <div>
                <div className="mb-3">
                  <label className="form-label flex items-center justify-between">
                    <span>Username or Gmail / Email</span>
                    <span className="text-[10px] text-amber-400 font-normal">‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶®‡¶æ‡¶Æ ‡¶¨‡¶æ ‡¶ú‡¶ø‡¶Æ‡ßá‡¶á‡¶≤</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      className="auth-input pl-9"
                      placeholder="e.g. username or user@gmail.com"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    />
                    <i className="fas fa-user-circle absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                  </div>
                  {loginUserErr && <p className="auth-error show">{loginUserErr}</p>}
                </div>

                <div className="mb-5">
                  <label className="form-label flex items-center justify-between">
                    <span>Password</span>
                    <span className="text-[10px] text-amber-400 font-normal">‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶°</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      className="auth-input pl-9"
                      placeholder="Enter your password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    />
                    <i className="fas fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                  </div>
                  {loginPassErr && <p className="auth-error show">{loginPassErr}</p>}
                </div>

                <button
                  className="btn-primary-solid flex items-center justify-center gap-2 w-full py-3"
                  onClick={handleLogin}
                  disabled={authSubmitting}
                >
                  {authSubmitting ? (
                    <span className="loading-spinner"></span>
                  ) : (
                    <>
                      <i className="fas fa-sign-in-alt text-xs"></i>
                      <span className="font-extrabold tracking-wider">LOGIN / ‡¶≤‡¶ó‡¶á‡¶®</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div>
                <div className="mb-3">
                  <label className="form-label flex items-center justify-between">
                    <span>Full Name</span>
                    <span className="text-[10px] text-amber-400 font-normal">‡¶∏‡¶Æ‡ßç‡¶™‡ßÇ‡¶∞‡ßç‡¶£ ‡¶®‡¶æ‡¶Æ</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      className="auth-input pl-9"
                      placeholder="Your full name (‡¶Ø‡ßá‡¶Æ‡¶®: ‡¶Æ‡ßã‡¶É ‡¶∞‡¶æ‡¶π‡ßÅ‡¶≤)"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                    />
                    <i className="fas fa-id-badge absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                  </div>
                  {regNameErr && <p className="auth-error show">{regNameErr}</p>}
                </div>

                <div className="mb-3">
                  <label className="form-label flex items-center justify-between">
                    <span>Username</span>
                    <span className="text-[10px] text-amber-400 font-normal">‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶®‡¶æ‡¶Æ (‡¶á‡¶â‡¶®‡¶ø‡¶ï)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      className="auth-input pl-9 font-mono lowercase"
                      placeholder="Choose username (e.g. rahul123)"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                    />
                    <i className="fas fa-at absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                  </div>
                  {regUserErr && <p className="auth-error show">{regUserErr}</p>}
                </div>

                <div className="mb-3">
                  <label className="form-label flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <span>Gmail / Email</span>
                      <span className="text-red-400 text-xs font-bold">*</span>
                    </span>
                    <span className="text-[10px] text-amber-400 font-normal">‡¶ú‡¶ø‡¶Æ‡ßá‡¶á‡¶≤ / ‡¶á‡¶Æ‡ßá‡¶á‡¶≤ (‡¶Ü‡¶¨‡¶∂‡ßç‡¶Ø‡¶ï)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      className="auth-input pl-9 font-mono"
                      placeholder="e.g. yourname@gmail.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                    />
                    <i className="fas fa-envelope absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                  </div>
                  {regEmailErr && <p className="auth-error show">{regEmailErr}</p>}
                </div>

                <div className="mb-3">
                  <label className="form-label flex items-center justify-between">
                    <span>Password</span>
                    <span className="text-[10px] text-amber-400 font-normal">‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶° (‡¶Æ‡¶ø‡¶®‡¶ø‡¶Æ‡¶æ‡¶Æ ‡ß¨ ‡¶Ö‡¶ï‡ßç‡¶∑‡¶∞)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      className="auth-input pl-9"
                      placeholder="Create a strong password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                    />
                    <i className="fas fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                  </div>
                  {regPassErr && <p className="auth-error show">{regPassErr}</p>}
                </div>

                <div className="mb-3">
                  <label className="form-label flex items-center justify-between">
                    <span>Confirm Password</span>
                    <span className="text-[10px] text-amber-400 font-normal">‡¶ï‡¶®‡¶´‡¶æ‡¶∞‡ßç‡¶Æ ‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶°</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      className="auth-input pl-9"
                      placeholder="Re-enter password"
                      value={regConfirmPass}
                      onChange={(e) => setRegConfirmPass(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                    />
                    <i className="fas fa-shield-alt absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                  </div>
                  {regConfirmErr && <p className="auth-error show">{regConfirmErr}</p>}
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between">
                    <label className="form-label mb-1 flex items-center gap-1.5">
                      <i className="fas fa-gift text-amber-400 text-xs"></i>
                      <span>Referral Code (‡¶ê‡¶ö‡ßç‡¶õ‡¶ø‡¶ï)</span>
                    </label>
                    <span className="text-[9px] text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      ‡ß´% ‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶¨‡ßã‡¶®‡¶æ‡¶∏ üéÅ
                    </span>
                  </div>
                  <input
                    type="text"
                    className="auth-input font-mono text-amber-300"
                    placeholder="e.g. friend's username or code"
                    value={regReferralCode}
                    onChange={(e) => setRegReferralCode(e.target.value)}
                  />
                  {regReferralCode && (
                    <p className="text-[10px] text-emerald-400 mt-1 font-semibold flex items-center gap-1">
                      <i className="fas fa-check-circle text-[9px]"></i>
                      <span>Referrer applied: @{regReferralCode}</span>
                    </p>
                  )}
                </div>

                <button
                  className="btn-primary-solid flex items-center justify-center gap-2 w-full py-3"
                  onClick={handleRegister}
                  disabled={authSubmitting}
                >
                  {authSubmitting ? (
                    <span className="loading-spinner"></span>
                  ) : (
                    <>
                      <i className="fas fa-user-plus text-xs"></i>
                      <span className="font-extrabold tracking-wider">CREATE ACCOUNT / ‡¶∞‡ßá‡¶ú‡¶ø‡¶∏‡ßç‡¶ü‡ßç‡¶∞‡ßá‡¶∂‡¶®</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
          <p className="text-[10px] mt-6 text-center font-semibold text-slate-500">
            By continuing, you agree to our Terms of Service
          </p>


        </div>
      )}

      {/* Main Application */}
      {!showSplash && isLoggedIn && (
        <div>
          {/* HEADER */}
          <header className="premium-header px-5 pt-7 pb-7">
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div
                onClick={() => {
                  setActiveTab('profile');
                  haptic('light');
                }}
                className="flex items-center gap-3 cursor-pointer group"
                title="View Profile (‡¶™‡ßç‡¶∞‡ßã‡¶´‡¶æ‡¶á‡¶≤ ‡¶¶‡ßá‡¶ñ‡ßÅ‡¶®)"
              >
                {/* Admin Logo or User Avatar */}
                <div className="relative flex items-center gap-2.5">
                  {adminSiteLogo && (
                    <img
                      src={adminSiteLogo}
                      alt="Site Logo"
                      className="w-10 h-10 sm:w-11 sm:h-11 object-contain rounded-xl shadow-lg border border-amber-400/50 bg-black/40 p-1 group-hover:scale-105 transition duration-300 flex-shrink-0"
                    />
                  )}
                  <div className="relative">
                    {userPhotoURL || currentUser?.photoURL ? (
                      <img
                        src={userPhotoURL || currentUser?.photoURL}
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover shadow-lg border-2 border-amber-400/60 group-hover:scale-105 transition duration-300"
                        alt="User Avatar"
                      />
                    ) : (
                      <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                          currentUser?.name || 'User'
                        )}&background=3b82f6&color=fff&bold=true`}
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover shadow-lg border-2 border-white/10 group-hover:scale-105 transition duration-300"
                        alt="User Avatar"
                      />
                    )}
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-md flex items-center justify-center border-2 border-[#030712]">
                      <i className="fas fa-check text-white text-[6px]"></i>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="font-extrabold text-base tracking-tight text-white group-hover:text-amber-400 transition flex items-center gap-1.5">
                    <span>{currentUser?.name || 'User'}</span>
                    <i className="fas fa-chevron-right text-[10px] text-slate-500 group-hover:text-amber-400"></i>
                  </h3>
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-mono">
                    <i className="fas fa-fingerprint text-[8px] text-blue-400"></i>
                    <span>@{currentUser?.username || currentUser?.uid.slice(0, 8)}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                {/* Live Orders Button */}
                <button
                  onClick={() => {
                    setShowLiveOrdersModal(true);
                    haptic('heavy');
                  }}
                  className="relative w-10 h-10 bg-gradient-to-b from-red-500/20 to-red-950/50 border border-red-500/40 hover:border-red-400 rounded-2xl flex items-center justify-center text-red-400 cursor-pointer active:scale-90 transition-all duration-200 shadow-[0_4px_15px_rgba(239,68,68,0.25)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] backdrop-blur-md"
                  title="Live Orders (‡¶≤‡¶æ‡¶á‡¶≠ ‡¶Ö‡¶∞‡ßç‡¶°‡¶æ‡¶∞)"
                >
                  <i className="fas fa-broadcast-tower text-sm text-red-400 animate-pulse"></i>
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#030712]"></span>
                </button>

                {/* Referral & 5% Bonus Button */}
                <button
                  onClick={() => {
                    setShowReferralModal(true);
                    haptic('heavy');
                  }}
                  className="relative w-10 h-10 bg-gradient-to-b from-yellow-500/20 to-amber-950/50 border border-yellow-500/40 hover:border-yellow-400 rounded-2xl flex items-center justify-center text-yellow-300 cursor-pointer active:scale-90 transition-all duration-200 shadow-[0_4px_15px_rgba(234,179,8,0.25)] hover:shadow-[0_0_20px_rgba(234,179,8,0.4)] backdrop-blur-md"
                  title="Referral & 5% Deposit Bonus (‡¶∞‡ßá‡¶´‡¶æ‡¶∞‡ßá‡¶≤)"
                >
                  <i className="fas fa-gift text-sm text-yellow-400"></i>
                  <span className="absolute -top-1 -right-1 bg-emerald-500 text-[8px] font-black px-1 rounded-full text-black shadow">5%</span>
                </button>

                {/* Tasks Button */}
                <button
                  onClick={() => {
                    setShowTasksModal(true);
                    haptic('heavy');
                  }}
                  className="relative w-10 h-10 bg-gradient-to-b from-amber-500/20 to-amber-950/50 border border-amber-500/40 hover:border-amber-400 rounded-2xl flex items-center justify-center text-amber-300 cursor-pointer active:scale-90 transition-all duration-200 shadow-[0_4px_15px_rgba(245,158,11,0.25)] hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] backdrop-blur-md"
                  title="Daily Tasks & Rewards (‡¶ü‡¶æ‡¶∏‡ßç‡¶ï)"
                >
                  <i className="fas fa-tasks text-sm text-amber-400"></i>
                </button>

                {/* Search Button */}
                <button
                  onClick={() => {
                    setShowSearchModal(true);
                    haptic('light');
                  }}
                  className="relative w-10 h-10 bg-gradient-to-b from-blue-500/20 to-blue-950/50 border border-blue-500/40 hover:border-blue-400 rounded-2xl flex items-center justify-center text-blue-300 cursor-pointer active:scale-90 transition-all duration-200 shadow-[0_4px_15px_rgba(59,130,246,0.25)] hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] backdrop-blur-md"
                  title="Search Services (‡¶∏‡¶æ‡¶∞‡ßç‡¶ö)"
                >
                  <i className="fas fa-search text-sm text-blue-400"></i>
                </button>

                {/* Live 3D Theme & Welcome Button (controlled by admin) */}
                {welcomeConfig.show3DButton !== false && (
                  <button
                    onClick={() => {
                      setShow3DThemeModal(true);
                      haptic('heavy');
                    }}
                    className="relative w-10 h-10 bg-gradient-to-b from-cyan-500/20 to-cyan-950/50 border border-cyan-400/50 hover:border-cyan-300 rounded-2xl flex items-center justify-center text-cyan-300 cursor-pointer active:scale-90 transition-all duration-200 shadow-[0_4px_15px_rgba(56,189,248,0.3)] hover:shadow-[0_0_22px_rgba(56,189,248,0.5)] backdrop-blur-md"
                    title="3D Live Theme & Welcome (3D ‡¶•‡¶ø‡¶Æ ‡¶ì ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶®‡¶ø‡¶Æ‡ßá‡¶∂‡¶®)"
                  >
                    <i className="fas fa-cube text-sm text-cyan-300 animate-spin" style={{ animationDuration: '8s' }}></i>
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-400 rounded-full animate-ping"></span>
                  </button>
                )}

                {/* Notifications Button */}
                <button
                  onClick={() => {
                    setShowNotifModal(true);
                    haptic('light');
                  }}
                  className="relative w-10 h-10 bg-gradient-to-b from-white/10 to-slate-900/60 border border-white/15 hover:border-amber-400/50 rounded-2xl flex items-center justify-center text-white cursor-pointer active:scale-90 transition-all duration-200 shadow-[0_4px_15px_rgba(0,0,0,0.3)] hover:shadow-[0_0_18px_rgba(245,158,11,0.3)] backdrop-blur-md"
                  title="Notifications (‡¶®‡¶ü‡¶ø‡¶´‡¶ø‡¶ï‡ßá‡¶∂‡¶®)"
                >
                  <i className="fas fa-bell text-sm text-amber-400"></i>
                  {unreadNotifCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-[#030712] animate-bounce">
                      {unreadNotifCount}
                    </span>
                  )}
                </button>

                {/* Mailbox Button */}
                <button
                  onClick={() => {
                    setShowMailboxModal(true);
                    haptic('light');
                  }}
                  className="relative w-10 h-10 bg-gradient-to-b from-white/10 to-slate-900/60 border border-white/15 hover:border-emerald-400/50 rounded-2xl flex items-center justify-center text-white cursor-pointer active:scale-90 transition-all duration-200 shadow-[0_4px_15px_rgba(0,0,0,0.3)] hover:shadow-[0_0_18px_rgba(16,185,129,0.3)] backdrop-blur-md"
                  title="Mail Box (‡¶Æ‡ßá‡¶á‡¶≤ ‡¶¨‡¶ï‡ßç‡¶∏)"
                >
                  <i className="fas fa-envelope text-sm text-emerald-400"></i>
                  {unreadMailCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-[#030712]">
                      {unreadMailCount}
                    </span>
                  )}
                </button>

                {/* Admin Mode Toggle Button - Only shown for rashal117 */}
                {isAdminUser && (
                  <button
                    onClick={() => {
                      setActiveTab(activeTab === 'admin' ? 'home' : 'admin');
                      haptic('heavy');
                    }}
                    className={`relative px-3.5 py-2 rounded-2xl border flex items-center gap-1.5 font-extrabold text-[11px] cursor-pointer transition-all duration-200 active:scale-90 shadow-md ${
                      activeTab === 'admin'
                        ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-600 text-slate-950 border-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.6)] font-black'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 hover:border-amber-400'
                    }`}
                    title="Admin Panel (‡¶è‡¶°‡¶Æ‡¶ø‡¶® ‡¶™‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤)"
                  >
                    <i className="fas fa-crown text-amber-400 text-xs"></i>
                    <span>ADMIN</span>
                  </button>
                )}
              </div>
            </div>

            {/* STAT CARDS */}
            <div className="grid grid-cols-2 gap-3 relative z-10">
              {/* Balance Card */}
              <div className="stat-card bg-gradient-to-br from-slate-900/95 via-slate-900/70 to-blue-950/50 border border-blue-500/30 shadow-[0_8px_25px_rgba(0,0,0,0.35)] group rounded-[22px] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-7 h-7 bg-blue-500/25 border border-blue-500/40 rounded-xl flex items-center justify-center text-blue-400 shadow-inner">
                      <i className="fas fa-wallet text-xs"></i>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-300">
                      ‡¶¨‡ßç‡¶Ø‡¶æ‡¶≤‡ßá‡¶®‡ßç‡¶∏ (Balance)
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-cyan-400/90 font-bold bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                    ‚âà ${(userBalance / 120).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between mb-1">
                  <h2 className="text-2xl font-black text-white tracking-tight drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]">
                    ‡ß≥ {userBalance.toFixed(2)}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setActiveTab('funds');
                    haptic('heavy');
                  }}
                  className="mt-2.5 w-full py-2 px-3 rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-[11px] font-black uppercase tracking-wider shadow-[0_6px_20px_rgba(37,99,235,0.4)] hover:shadow-[0_8px_25px_rgba(37,99,235,0.6)] border border-white/20 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="fas fa-plus-circle text-amber-300 text-xs"></i>
                  <span>‡¶ü‡¶æ‡¶ï‡¶æ ‡¶ú‡¶Æ‡¶æ (Add Funds)</span>
                </button>
              </div>

              {/* Total Orders Card */}
              <div className="stat-card bg-gradient-to-br from-slate-900/95 via-slate-900/70 to-indigo-950/50 border border-indigo-500/30 shadow-[0_8px_25px_rgba(0,0,0,0.35)] group rounded-[22px] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-7 h-7 bg-indigo-500/25 border border-indigo-500/40 rounded-xl flex items-center justify-center text-indigo-400 shadow-inner">
                      <i className="fas fa-boxes-stacked text-xs"></i>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-300">
                      ‡¶Ö‡¶∞‡ßç‡¶°‡¶æ‡¶∞ (Orders)
                    </span>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" title="System Active"></span>
                </div>
                <div className="flex items-baseline justify-between mb-1">
                  <h2 className="text-2xl font-black text-white tracking-tight drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]">
                    {userTotalOrders}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setActiveTab('orders');
                    haptic('light');
                  }}
                  className="mt-2.5 w-full py-2 px-3 rounded-xl bg-gradient-to-r from-slate-800/90 to-slate-900/95 hover:from-slate-750 hover:to-slate-850 border border-indigo-500/35 hover:border-indigo-400 text-slate-100 text-[11px] font-black uppercase tracking-wider shadow-[0_4px_15px_rgba(0,0,0,0.3)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.25)] transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="fas fa-list-check text-indigo-400 text-xs"></i>
                  <span>‡¶Ö‡¶∞‡ßç‡¶°‡¶æ‡¶∞ ‡¶π‡¶ø‡¶∏‡ßç‡¶ü‡ßã‡¶∞‡¶ø</span>
                </button>
              </div>
            </div>

            {/* LIVE ANNOUNCEMENT TICKER (controlled by admin) */}
            {welcomeConfig.showNoticeTicker !== false && (
              <div className="mt-3 relative z-10 overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-900/90 border border-amber-500/30 p-2.5 flex items-center gap-2.5 shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500/25 to-yellow-500/25 text-amber-300 text-[10px] font-black px-2.5 py-1 rounded-xl border border-amber-500/40 whitespace-nowrap shadow-sm">
                  <i className="fas fa-bullhorn text-amber-400 text-xs animate-bounce"></i>
                  <span>‡¶®‡ßã‡¶ü‡¶ø‡¶∂</span>
                </div>
                <div className="overflow-hidden whitespace-nowrap w-full">
                  <p className="text-[11px] font-semibold text-slate-200 inline-block animate-marquee">
                    {welcomeConfig.noticeText || '‚ö° ‡ß®‡ß™/‡ß≠ ‡¶á‡¶®‡¶∏‡ßç‡¶ü‡ßç‡¶Ø‡¶æ‡¶®‡ßç‡¶ü ‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏ ‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡ßü | ‡¶¨‡¶ø‡¶ï‡¶æ‡¶∂, ‡¶®‡¶ó‡¶¶, ‡¶∞‡¶ï‡ßá‡¶ü‡ßá ‡¶á‡¶®‡¶∏‡ßç‡¶ü‡ßç‡¶Ø‡¶æ‡¶®‡ßç‡¶ü ‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶¨‡ßã‡¶®‡¶æ‡¶∏ ‡¶ö‡¶≤‡¶õ‡ßá | ‡¶Ø‡ßá‡¶ï‡ßã‡¶®‡ßã ‡¶™‡ßç‡¶∞‡ßü‡ßã‡¶ú‡¶®‡ßá ‡¶Ü‡¶Æ‡¶æ‡¶¶‡ßá‡¶∞ ‡¶≤‡¶æ‡¶á‡¶≠ ‡¶∏‡¶æ‡¶™‡ßã‡¶∞‡ßç‡¶ü‡ßá ‡¶Ø‡ßã‡¶ó‡¶æ‡¶Ø‡ßã‡¶ó ‡¶ï‡¶∞‡ßÅ‡¶® üöÄ'}
                  </p>
                </div>
              </div>
            )}

            {/* USER QUICK 4-GRID ACTION BAR */}
            <div className="grid grid-cols-4 gap-2.5 mt-3 relative z-10">
              {/* Live Orders */}
              <button
                onClick={() => {
                  setShowLiveOrdersModal(true);
                  haptic('heavy');
                }}
                className="p-3 rounded-2xl bg-gradient-to-b from-red-950/50 via-slate-900/80 to-slate-950/90 border border-red-500/35 hover:border-red-400/80 transition-all duration-200 active:scale-90 flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer shadow-[0_4px_18px_rgba(239,68,68,0.18)] hover:shadow-[0_6px_22px_rgba(239,68,68,0.35)]"
              >
                <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 relative group-hover:scale-110 transition duration-200 shadow-inner">
                  <i className="fas fa-satellite-dish text-xs animate-pulse"></i>
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                </div>
                <span className="text-[10px] font-extrabold text-slate-200 group-hover:text-white tracking-tight">‡¶≤‡¶æ‡¶á‡¶≠ ‡¶Ö‡¶∞‡ßç‡¶°‡¶æ‡¶∞</span>
              </button>

              {/* Daily Tasks */}
              <button
                onClick={() => {
                  setShowTasksModal(true);
                  haptic('heavy');
                }}
                className="p-3 rounded-2xl bg-gradient-to-b from-amber-950/50 via-slate-900/80 to-slate-950/90 border border-amber-500/35 hover:border-amber-400/80 transition-all duration-200 active:scale-90 flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer shadow-[0_4px_18px_rgba(245,158,11,0.18)] hover:shadow-[0_6px_22px_rgba(245,158,11,0.35)]"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 group-hover:scale-110 transition duration-200 shadow-inner">
                  <i className="fas fa-gift text-xs"></i>
                </div>
                <span className="text-[10px] font-extrabold text-slate-200 group-hover:text-white tracking-tight">‡¶ü‡¶æ‡¶∏‡ßç‡¶ï ‡¶¨‡ßã‡¶®‡¶æ‡¶∏</span>
              </button>

              {/* Price / Services */}
              <button
                onClick={() => {
                  setShowSearchModal(true);
                  haptic('light');
                }}
                className="p-3 rounded-2xl bg-gradient-to-b from-cyan-950/50 via-slate-900/80 to-slate-950/90 border border-cyan-500/35 hover:border-cyan-400/80 transition-all duration-200 active:scale-90 flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer shadow-[0_4px_18px_rgba(56,189,248,0.18)] hover:shadow-[0_6px_22px_rgba(56,189,248,0.35)]"
              >
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 group-hover:scale-110 transition duration-200 shadow-inner">
                  <i className="fas fa-tags text-xs"></i>
                </div>
                <span className="text-[10px] font-extrabold text-slate-200 group-hover:text-white tracking-tight">‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏ ‡¶∞‡ßá‡¶ü</span>
              </button>

              {/* 24/7 Support */}
              <a
                href="https://wa.me/8801828779117"
                target="_blank"
                rel="noreferrer"
                onClick={() => haptic('light')}
                className="p-3 rounded-2xl bg-gradient-to-b from-emerald-950/50 via-slate-900/80 to-slate-950/90 border border-emerald-500/35 hover:border-emerald-400/80 transition-all duration-200 active:scale-90 flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer shadow-[0_4px_18px_rgba(16,185,129,0.18)] hover:shadow-[0_6px_22px_rgba(16,185,129,0.35)]"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition duration-200 shadow-inner">
                  <i className="fab fa-whatsapp text-sm"></i>
                </div>
                <span className="text-[10px] font-extrabold text-slate-200 group-hover:text-white tracking-tight">‡¶π‡ßã‡¶Ø‡¶º‡¶æ‡¶ü‡¶∏‡¶Ö‡ßç‡¶Ø‡¶æ‡¶™</span>
              </a>
            </div>
          </header>

          {/* HOME TAB */}
          {activeTab === 'home' && (
            <section className="px-5 mt-5">
              {/* SEARCH BAR TRIGGER */}
              <div className="mb-3">
                <div
                  onClick={() => {
                    setShowSearchModal(true);
                    haptic('light');
                  }}
                  className="relative w-full bg-gradient-to-r from-slate-900/95 via-slate-900/85 to-blue-950/40 border border-blue-500/35 hover:border-blue-400/70 rounded-2xl py-3 pl-10 pr-4 text-xs font-semibold text-slate-300 shadow-[0_6px_25px_rgba(0,0,0,0.35)] cursor-pointer transition-all duration-200 flex items-center justify-between group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2.5 text-slate-400">
                    <i className="fas fa-search text-cyan-400 text-sm group-hover:scale-110 transition"></i>
                    <span className="text-slate-300 font-medium">‡¶∏‡¶æ‡¶∞‡ßç‡¶ö ‡¶ï‡¶∞‡ßÅ‡¶® (Facebook, TikTok, Followers)...</span>
                  </div>
                  <span className="bg-gradient-to-r from-blue-600/30 to-cyan-500/30 text-cyan-300 text-[10px] font-extrabold px-3 py-1 rounded-xl border border-cyan-400/40 shadow-sm flex items-center gap-1">
                    <span>SEARCH</span>
                    <i className="fas fa-sparkles text-[8px]"></i>
                  </span>
                </div>
              </div>

              {/* SOCIAL PLATFORMS SELECTOR GRID */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-200 flex items-center gap-1.5">
                    <i className="fas fa-layer-group text-blue-400"></i>Select Platform (‡¶™‡ßç‡¶≤‡ßç‡¶Ø‡¶æ‡¶ü‡¶´‡¶∞‡ßç‡¶Æ ‡¶¨‡¶æ‡¶õ‡ßÅ‡¶®)
                  </span>
                  <span className="text-[9px] text-cyan-300 font-bold bg-cyan-500/15 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                    Tap to Select ‚ö°
                  </span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                  {SOCIAL_PLATFORMS.map((platform) => {
                    const isSelected = selectedCategory && (
                      selectedCategory.toLowerCase().includes(platform.id) ||
                      (platform.id === 'facebook' && selectedCategory.toLowerCase().includes('fb')) ||
                      (platform.id === 'instagram' && selectedCategory.toLowerCase().includes('ig')) ||
                      (platform.id === 'tiktok' && selectedCategory.toLowerCase().includes('tt')) ||
                      (platform.id === 'youtube' && selectedCategory.toLowerCase().includes('yt')) ||
                      (platform.id === 'telegram' && selectedCategory.toLowerCase().includes('tg'))
                    );

                    return (
                      <button
                        key={platform.id}
                        onClick={() => handleSelectPlatformLogo(platform.id)}
                        className={`group relative flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-90 shadow-md ${
                          isSelected
                            ? 'bg-gradient-to-b ' + platform.bg + ' border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.5)] ring-2 ring-blue-400/50 scale-[1.03]'
                            : 'bg-gradient-to-b from-white/8 to-white/3 border-white/10 hover:border-white/25 hover:bg-white/10'
                        }`}
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl transition-transform group-hover:scale-115 drop-shadow"
                          style={{ color: platform.color }}
                        >
                          <i className={platform.icon}></i>
                        </div>
                        <span className="text-[10px] font-bold text-slate-200 mt-1.5 truncate max-w-full">
                          {platform.name.split(' ')[0]}
                        </span>
                        {isSelected && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-[8px] font-black border-2 border-[#030712] shadow">
                            ‚úì
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* NEW ORDER CARD WITH STEPPER TRACK ("‡¶∞‡ßã‡¶ó") */}
              <div id="order-form" className="glass-card p-5 mb-5 relative overflow-hidden border border-blue-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-blue-500/15 rounded-xl flex items-center justify-center text-blue-400 shadow-inner">
                      <i className="fas fa-cart-plus text-sm"></i>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-white">New Order (‡¶®‡¶§‡ßÅ‡¶® ‡¶Ö‡¶∞‡ßç‡¶°‡¶æ‡¶∞)</h3>
                      <p className="text-[9px] font-semibold text-slate-400">Step-by-step automatic dispatch</p>
                    </div>
                  </div>
                  <div className="text-[8px] font-black text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md tracking-wider border border-blue-500/20">
                    INSTANT ‚ö°
                  </div>
                </div>

                {/* DYNAMIC PROGRESS STEPPER TRACK ("‡¶∞‡ßã‡¶ó" / STEP BAR) */}
                <div className="mb-5 bg-slate-900/80 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                      <span className="text-[10px] font-black uppercase tracking-wider text-blue-300">
                        Order Process (‡¶Ö‡¶∞‡ßç‡¶°‡¶æ‡¶∞ ‡¶™‡ßç‡¶∞‡¶∏‡ßá‡¶∏)
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-300">
                      Step {activeStepIndex}/5 ({orderStepProgress}%)
                    </span>
                  </div>

                  {/* Dynamic Progress Line Track ("‡¶∞‡ßã‡¶ó") */}
                  <div className="relative w-full h-2.5 bg-slate-800 rounded-full overflow-hidden mb-3.5 border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 transition-all duration-500 ease-out rounded-full shadow-[0_0_12px_rgba(59,130,246,0.8)]"
                      style={{ width: `${orderStepProgress}%` }}
                    ></div>
                  </div>

                  {/* Step Nodes */}
                  <div className="grid grid-cols-5 gap-1 text-center">
                    {[
                      { step: 1, label: '‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø', icon: 'fas fa-folder-open', done: isStep1Done },
                      { step: 2, label: '‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏', icon: 'fas fa-magic', done: isStep2Done },
                      { step: 3, label: '‡¶≤‡¶ø‡¶ô‡ßç‡¶ï', icon: 'fas fa-link', done: isStep3Done },
                      { step: 4, label: '‡¶™‡¶∞‡¶ø‡¶Æ‡¶æ‡¶£', icon: 'fas fa-hashtag', done: isStep4Done },
                      { step: 5, label: '‡¶ï‡¶®‡¶´‡¶æ‡¶∞‡ßç‡¶Æ', icon: 'fas fa-check-circle', done: isStep4Done },
                    ].map((s) => {
                      const isActive = activeStepIndex === s.step;
                      return (
                        <div key={s.step} className="flex flex-col items-center">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-300 ${
                              s.done
                                ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)] scale-105'
                                : isActive
                                ? 'bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.8)] ring-2 ring-blue-400/50 scale-110'
                                : 'bg-slate-800 text-slate-500 border border-white/5'
                            }`}
                          >
                            {s.done ? <i className="fas fa-check text-[9px]"></i> : <i className={`${s.icon} text-[9px]`}></i>}
                          </div>
                          <span
                            className={`text-[8px] font-bold mt-1 tracking-tight ${
                              s.done
                                ? 'text-emerald-400'
                                : isActive
                                ? 'text-blue-300 font-extrabold'
                                : 'text-slate-500'
                            }`}
                          >
                            {s.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Category Dropdown */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="form-label mb-0">
                        <i className="fas fa-folder-open mr-1 text-[8px]"></i> 1. Category
                      </label>
                      {selectedCategory && (
                        <div className="flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded text-[9px] text-blue-300 font-bold">
                          <i className={getPlatformMeta(selectedCategory).icon}></i>
                          <span>{getPlatformMeta(selectedCategory).name}</span>
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <select
                        className="input-modern appearance-none pr-8"
                        value={selectedCategory}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                      >
                        <option value="" disabled>
                          Choose category...
                        </option>
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-[10px]"></i>
                    </div>
                    {catErr && <p className="field-error show">{catErr}</p>}
                  </div>

                  {/* Service Dropdown */}
                  <div>
                    <label className="form-label">
                      <i className="fas fa-magic mr-1 text-[8px]"></i> 2. Service
                    </label>
                    <div className="relative">
                      <select
                        className="input-modern appearance-none pr-8"
                        value={selectedServiceId}
                        onChange={(e) => handleServiceChange(e.target.value)}
                        disabled={!selectedCategory}
                      >
                        <option value="" disabled>
                          {selectedCategory ? '‚ú® Select service...' : 'Select category first'}
                        </option>
                        {allServices
                          .filter((s) => s.category === selectedCategory)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ‚Äî ‡ß≥ {s.price}/1k
                            </option>
                          ))}
                      </select>
                      <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-[10px]"></i>
                    </div>
                    {svcErr && <p className="field-error show">{svcErr}</p>}
                  </div>

                  {/* Service Details & Description */}
                  {currentService && (
                    <>
                      {currentService.desc && (
                        <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3">
                          <div className="flex items-start gap-2">
                            <i className="fas fa-info-circle text-blue-400 text-xs mt-0.5"></i>
                            <p className="text-[11px] font-medium text-slate-400 leading-relaxed">
                              {currentService.desc}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3 flex justify-between items-center">
                        <div className="text-center">
                          <p className="text-[8px] font-bold text-blue-400/70 uppercase">Min</p>
                          <p className="font-extrabold text-sm text-blue-300">
                            {currentService.min.toLocaleString()}
                          </p>
                        </div>
                        <div className="w-px h-6 bg-blue-500/15"></div>
                        <div className="text-center">
                          <p className="text-[8px] font-bold text-blue-400/70 uppercase">Max</p>
                          <p className="font-extrabold text-sm text-blue-300">
                            {currentService.max ? currentService.max.toLocaleString() : '‚àû'}
                          </p>
                        </div>
                        <div className="w-px h-6 bg-blue-500/10"></div>
                        <div className="text-center">
                          <p className="text-[8px] font-bold text-blue-400/70 uppercase">Rate</p>
                          <p className="font-extrabold text-sm text-blue-300">
                            ‡ß≥ {currentService.price}/1k
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Target Link Input */}
                  <div>
                    <label className="form-label">
                      <i className="fas fa-link mr-1 text-[8px]"></i> 3. Target Link
                    </label>
                    <input
                      type="text"
                      className="input-modern"
                      placeholder="https://facebook.com/username or link..."
                      value={targetLink}
                      onChange={(e) => {
                        setTargetLink(e.target.value);
                        setLinkErr('');
                      }}
                    />
                    {linkErr && <p className="field-error show">{linkErr}</p>}
                  </div>

                  {/* Quantity & Price Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">
                        <i className="fas fa-hashtag mr-1 text-[8px]"></i> 4. Quantity
                      </label>
                      <input
                        type="number"
                        className="input-modern"
                        value={quantity}
                        onChange={(e) => {
                          setQuantity(parseInt(e.target.value) || 0);
                          setQtyErr('');
                        }}
                      />
                      {currentService && (
                        <p className="min-max-hint">
                          Min: {currentService.min} ‚Äî Max:{' '}
                          {currentService.max?.toLocaleString() || '‚àû'}
                        </p>
                      )}
                      {qtyErr && <p className="field-error show">{qtyErr}</p>}
                    </div>

                    <div>
                      <label className="form-label">
                        <i className="fas fa-coins mr-1 text-[8px]"></i> 5. Cost (BDT / ‡ß≥)
                      </label>
                      <div className="bg-gradient-to-br from-blue-950/40 via-slate-900/90 to-slate-900/90 border border-blue-500/30 rounded-2xl p-3 text-center shadow-inner">
                        <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-white drop-shadow">
                          ‡ß≥ {calculatedCost.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-[9px] text-center mt-1 font-semibold">
                        {calculatedCost > userBalance ? (
                          <span className="text-red-400 font-bold flex items-center justify-center gap-1">
                            <i className="fas fa-exclamation-triangle text-[8px]"></i>
                            <span>Short ‡ß≥ {(calculatedCost - userBalance).toFixed(2)}</span>
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-bold flex items-center justify-center gap-1">
                            <i className="fas fa-check-circle text-[8px]"></i>
                            <span>Balance OK</span>
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handlePlaceOrderClick}
                    disabled={orderSubmitting}
                    className={`btn-primary-solid flex items-center justify-center gap-2.5 transition-all duration-200 ${
                      isStep4Done
                        ? 'shadow-[0_12px_32px_rgba(37,99,235,0.65)] ring-2 ring-cyan-400/60 scale-[1.01]'
                        : ''
                    }`}
                  >
                    {orderSubmitting ? (
                      <span className="loading-spinner"></span>
                    ) : (
                      <>
                        <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center text-amber-300 shadow-sm">
                          <i className="fas fa-paper-plane text-xs"></i>
                        </div>
                        <span className="tracking-wider text-sm font-black">PLACE ORDER NOW (‡¶Ö‡¶∞‡ßç‡¶°‡¶æ‡¶∞ ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§ ‡¶ï‡¶∞‡ßÅ‡¶®)</span>
                        <i className="fas fa-bolt text-xs text-amber-300 animate-pulse"></i>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Security Banner */}
              <div
                className="glass-card p-4 flex gap-3 items-center mb-4"
                style={{
                  background: 'rgba(59,130,246,0.05)',
                  borderColor: 'rgba(59,130,246,0.1)'
                }}
              >
                <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center text-blue-400 flex-shrink-0">
                  <i className="fas fa-shield-alt text-lg"></i>
                </div>
                <div>
                  <h4 className="font-bold text-xs text-white">100% Secure & Refundable</h4>
                  <p className="text-[10px] text-slate-500">
                    Failed orders automatically refund Coins to your account.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* ORDERS TAB */}
          {activeTab === 'orders' && (
            <section className="px-5 mt-5">
              <div className="flex justify-between items-center mb-5">
                <h2 className="section-title text-white">My Orders</h2>
                <div className="live-badge">LIVE</div>
              </div>

              <div className="space-y-3">
                {ordersList.length === 0 ? (
                  <div className="empty-state">
                    <i className="fas fa-receipt"></i>
                    <p>No orders yet</p>
                    <p className="text-[10px] mt-1 font-normal">Place your first order from Home</p>
                  </div>
                ) : (
                  ordersList.map((o) => {
                    let stClass = 'bg-slate-500/15 text-slate-400';
                    let stIcon = 'fa-clock';

                    if (o.status === 'Completed') {
                      stClass = 'bg-blue-500/15 text-blue-400';
                      stIcon = 'fa-check-circle';
                    } else if (o.status === 'Processing' || o.status === 'In Progress') {
                      stClass = 'bg-indigo-500/15 text-indigo-400';
                      stIcon = 'fa-spinner fa-spin';
                    } else if (o.status === 'Cancelled') {
                      stClass = 'bg-red-500/15 text-red-400';
                      stIcon = 'fa-times-circle';
                    }

                    const meta = getPlatformMeta(o.service);

                    return (
                      <div key={o.id} className="glass-card p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[9px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                            #{o.id.slice(-8)}
                          </span>
                          <span className={`order-status ${stClass}`}>
                            <i className={`fas ${stIcon} mr-1 text-[7px]`}></i>
                            {o.status || 'Pending'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 my-1">
                          <div
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-xs flex-shrink-0 border border-white/10"
                            style={{ color: meta.color, backgroundColor: `${meta.color}25` }}
                          >
                            <i className={meta.icon}></i>
                          </div>
                          <h4 className="font-bold text-xs text-white leading-tight">{o.service}</h4>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                          {o.link}
                        </p>
                        <div className="dashed-divider my-3"></div>
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-[8px] font-black text-slate-500 uppercase">
                              Qty
                            </span>
                            <div className="font-bold text-xs text-white">
                              {o.qty?.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <span className="text-[8px] font-black text-slate-500 uppercase">
                              Cost
                            </span>
                            <div className="font-bold text-xs text-blue-400">
                              ‡ß≥ {o.cost?.toFixed(2)}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[8px] font-black text-slate-500 uppercase">
                              Date
                            </span>
                            <div className="text-[10px] text-slate-400">
                              {o.createdAt
                                ? new Date(o.createdAt).toLocaleDateString('en-BD', {
                                    day: '2-digit',
                                    month: 'short'
                                  })
                                : 'Just now'}
                            </div>
                          </div>
                        </div>

                        {/* API Dispatch Indicator & Retry */}
                        <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                          {o.apiOrderId ? (
                            <span className="text-[8px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">
                              ‚úÖ API Order: #{o.apiOrderId}
                            </span>
                          ) : o.apiError ? (
                            <span className="text-[8px] px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-mono">
                              ‚ùå API Error
                            </span>
                          ) : (
                            <span className="text-[8px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                              ‚è≥ Local Order
                            </span>
                          )}

                          {(!o.apiOrderId || o.apiError) && o.status !== 'Completed' && (
                            <button
                              onClick={() => handleRetryOrder(o)}
                              className="text-[10px] px-2.5 py-1 rounded-lg bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 font-bold transition active:scale-95"
                            >
                              üîÑ Retry API
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          )}

          {/* FUNDS TAB (3-STEP WORKFLOW: 1. AMOUNT -> 2. SELECT PAYMENT OPTION -> 3. FULL-PAGE PAYMENT GATEWAY) */}
          {activeTab === 'funds' && (
            <section className="px-4 sm:px-5 mt-5">
              {/* Header Title */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="section-title text-white flex items-center gap-2">
                    <i className="fas fa-wallet text-blue-400"></i>
                    <span>‡¶ü‡¶æ‡¶ï‡¶æ ‡¶ú‡¶Æ‡¶æ (Add Funds)</span>
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    {depositStep === 'amount' && '‡ßß‡¶Æ ‡¶ß‡¶æ‡¶™: ‡¶ï‡¶§ ‡¶ü‡¶æ‡¶ï‡¶æ ‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶ï‡¶∞‡¶§‡ßá ‡¶ö‡¶æ‡¶® ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶®'}
                    {depositStep === 'method' && '‡ß®‡¶Ø‡¶º ‡¶ß‡¶æ‡¶™: ‡¶Ü‡¶™‡¶®‡¶æ‡¶∞ ‡¶™‡¶õ‡¶®‡ßç‡¶¶‡ßá‡¶∞ ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶Ö‡¶™‡¶∂‡¶®‡¶ü‡¶ø ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®'}
                    {depositStep === 'gateway' && '‡ß©‡¶Ø‡¶º ‡¶ß‡¶æ‡¶™: ‡¶ü‡¶æ‡¶ï‡¶æ ‡¶™‡¶æ‡¶†‡¶ø‡¶Ø‡¶º‡ßá TrxID ‡¶¶‡¶ø‡¶Ø‡¶º‡ßá ‡¶≠‡ßá‡¶∞‡¶ø‡¶´‡¶æ‡¶á ‡¶ï‡¶∞‡ßÅ‡¶®'}
                  </p>
                </div>

                {depositStep === 'method' && (
                  <button
                    onClick={() => {
                      setDepositStep('amount');
                      haptic('light');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fas fa-arrow-left text-[10px]"></i>
                    <span>‡¶è‡¶Æ‡¶æ‡¶â‡¶®‡ßç‡¶ü‡ßá ‡¶´‡ßá‡¶∞‡¶§ ‡¶Ø‡¶æ‡¶®</span>
                  </button>
                )}
              </div>

              {/* STEP 1: AMOUNT SELECTION SCREEN */}
              {depositStep === 'amount' && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                  {/* Current Balance Hero Card */}
                  <div className="glass-card p-5 text-center relative overflow-hidden bg-gradient-to-br from-blue-600/20 via-slate-900/90 to-indigo-950/40 border border-blue-500/30 shadow-xl">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-400/10 via-transparent to-transparent pointer-events-none"></div>
                    <div className="relative z-10">
                      <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto text-blue-400 text-xl mb-2.5 shadow-inner">
                        <i className="fas fa-coins text-amber-300"></i>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                        Current Account Balance (‡¶¨‡¶∞‡ßç‡¶§‡¶Æ‡¶æ‡¶® ‡¶¨‡ßç‡¶Ø‡¶æ‡¶≤‡ßá‡¶®‡ßç‡¶∏)
                      </p>
                      <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                        ‡ß≥ {userBalance.toFixed(2)}
                      </h2>
                    </div>
                  </div>

                  {/* Amount Input Card */}
                  <div className="glass-card p-5 space-y-4 border border-white/10 shadow-xl">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-extrabold text-white flex items-center gap-1.5">
                          <i className="fas fa-hand-holding-dollar text-emerald-400"></i>
                          <span>‡¶ï‡¶§‡ßã ‡¶ü‡¶æ‡¶ï‡¶æ ‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶ï‡¶∞‡¶§‡ßá ‡¶ö‡¶æ‡¶® ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶®:</span>
                        </label>
                        <span className="text-xs font-bold text-amber-300">
                          ‡ß≥ {parseFloat(depositAmount) || 0}
                        </span>
                      </div>

                      {/* Large Currency Input Box */}
                      <div className="relative flex items-center">
                        <div className="absolute left-4 text-xl font-black text-blue-400 pointer-events-none select-none">
                          ‡ß≥
                        </div>
                        <input
                          type="number"
                          min="10"
                          max="100000"
                          className="w-full bg-slate-950/80 text-white font-black text-2xl sm:text-3xl pl-10 pr-4 py-3.5 rounded-2xl border-2 border-blue-500/40 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20 shadow-inner tracking-tight placeholder:text-slate-600 transition"
                          placeholder="100"
                          value={depositAmount}
                          onChange={(e) => {
                            setDepositAmount(e.target.value);
                            setDepAmtErr('');
                          }}
                        />
                      </div>
                      {depAmtErr && <p className="text-xs font-bold text-red-400 mt-1.5">‚ö†Ô∏è {depAmtErr}</p>}
                    </div>

                    {/* Quick Amount Chips */}
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">
                        ‡¶ï‡ßÅ‡¶á‡¶ï ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü (Quick Select):
                      </span>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                        {['10', '50', '100', '200', '500', '1000', '2000', '5000'].map((amt) => {
                          const isSelected = depositAmount === amt;
                          return (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => {
                                setDepositAmount(amt);
                                setDepAmtErr('');
                                haptic('light');
                              }}
                              className={`py-2 px-1 text-center font-black text-xs rounded-xl border transition active:scale-95 cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.5)] scale-105'
                                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10 hover:border-white/20'
                              }`}
                            >
                              ‡ß≥ {amt}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Adjust Amount Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/5">
                      <span className="text-[10px] font-bold text-slate-400 mr-1">‡¶ü‡¶æ‡¶ï‡¶æ ‡¶¨‡¶æ‡ßú‡¶æ‡¶®/‡¶ï‡¶Æ‡¶æ‡¶®:</span>
                      {[
                        { label: '+10 ‡ß≥', val: 10 },
                        { label: '+50 ‡ß≥', val: 50 },
                        { label: '+100 ‡ß≥', val: 100 },
                        { label: '+500 ‡ß≥', val: 500 },
                        { label: '-10 ‡ß≥', val: -10 },
                        { label: '-50 ‡ß≥', val: -50 }
                      ].map((btn) => (
                        <button
                          key={btn.label}
                          type="button"
                          onClick={() => {
                            const curr = parseFloat(depositAmount) || 0;
                            const nextVal = Math.max(10, curr + btn.val);
                            setDepositAmount(String(nextVal));
                            setDepAmtErr('');
                            haptic('light');
                          }}
                          className={`px-2.5 py-1 rounded-lg font-extrabold text-[10px] border transition active:scale-95 cursor-pointer ${
                            btn.val > 0
                              ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                              : 'bg-red-500/15 hover:bg-red-500/25 text-red-300 border-red-500/30'
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>

                    {/* Next to Step 2 Button */}
                    <button
                      type="button"
                      onClick={() => {
                        const amt = parseFloat(depositAmount);
                        if (isNaN(amt) || amt < 10) {
                          setDepAmtErr('‡¶∏‡¶∞‡ßç‡¶¨‡¶®‡¶ø‡¶Æ‡ßç‡¶® ‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶™‡¶∞‡¶ø‡¶Æ‡¶æ‡¶£ ‡ß≥ ‡ßß‡ß¶');
                          haptic('error');
                          return;
                        }
                        if (amt > 100000) {
                          setDepAmtErr('‡¶∏‡¶∞‡ßç‡¶¨‡ßã‡¶ö‡ßç‡¶ö ‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶™‡¶∞‡¶ø‡¶Æ‡¶æ‡¶£ ‡ß≥ ‡ßß‡ß¶‡ß¶,‡ß¶‡ß¶‡ß¶');
                          haptic('error');
                          return;
                        }
                        setDepAmtErr('');
                        setDepositStep('method');
                        haptic('success');
                      }}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm sm:text-base tracking-wider uppercase shadow-[0_0_20px_rgba(59,130,246,0.4)] transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer mt-3"
                    >
                      <span>‡¶™‡¶∞‡¶¨‡¶∞‡ßç‡¶§‡ßÄ ‡¶ß‡¶æ‡¶™: ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶Ö‡¶™‡¶∂‡¶® ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®</span>
                      <i className="fas fa-arrow-right text-xs"></i>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: PAYMENT METHOD SELECTION SCREEN */}
              {depositStep === 'method' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  {/* Selected Amount Summary Banner */}
                  <div className="bg-gradient-to-r from-blue-900/40 via-indigo-950/60 to-slate-900/80 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                    <div>
                      <span className="text-[10px] text-blue-300 font-extrabold uppercase tracking-widest block">
                        ‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶ü‡¶æ‡¶ï‡¶æ‡¶∞ ‡¶™‡¶∞‡¶ø‡¶Æ‡¶æ‡¶£ (Deposit Amount):
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-2xl sm:text-3xl font-black text-amber-300">
                          ‡ß≥ {parseFloat(depositAmount) || 0}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">BDT</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setDepositStep('amount');
                        haptic('light');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <i className="fas fa-edit text-[10px]"></i>
                      <span>‡¶è‡¶Æ‡¶æ‡¶â‡¶®‡ßç‡¶ü ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶®</span>
                    </button>
                  </div>

                  {/* Payment Options Header */}
                  <div className="glass-card p-5 space-y-4 border border-white/10 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                          <i className="fas fa-credit-card text-purple-400"></i>
                          <span>‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶Ö‡¶™‡¶∂‡¶® ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡ßÅ‡¶® (Select Payment Method)</span>
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          ‡¶ü‡¶æ‡¶ï‡¶æ ‡¶™‡¶æ‡¶†‡¶æ‡¶®‡ßã‡¶∞ ‡¶ú‡¶®‡ßç‡¶Ø ‡¶®‡¶ø‡¶ö‡ßá‡¶∞ ‡¶Ø‡ßá‡¶ï‡ßã‡¶®‡ßã ‡¶è‡¶ï‡¶ü‡¶ø ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶ó‡ßá‡¶ü‡¶ì‡¶Ø‡¶º‡ßá ‡¶¨‡ßá‡¶õ‡ßá ‡¶®‡¶ø‡¶®:
                        </p>
                      </div>
                    </div>

                    {/* Rich Grid of All Payment Methods with distinct brand styling */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {(Object.entries(paymentMethodsConfig) as [string, PaymentMethodConfig][])
                        .filter(([_, m]) => m && m.active !== false)
                        .map(([key, method]) => {
                          const methodId = method.id || key;
                          const isSelected = selectedMethod === methodId;
                          const mKey = (method.iconType || method.id || method.label || key).toLowerCase();
                          const isBkash = mKey.includes('bkash');
                          const isNagad = mKey.includes('nagad');
                          const isRocket = mKey.includes('rocket');
                          const isUpay = mKey.includes('upay');
                          const isBinance = mKey.includes('binance') || mKey.includes('crypto') || mKey.includes('usdt') || !!method.isCrypto;

                          // Dynamic brand themes for each card
                          let cardBg = 'bg-slate-900/60 hover:bg-slate-900/90 text-slate-300 border-white/10 hover:border-white/20';
                          let brandBadge = 'bg-slate-800 text-slate-300';
                          let brandSub = 'Send Money';

                          if (isBkash) {
                            brandSub = method.type || '‡¶¨‡¶ø‡¶ï‡¶æ‡¶∂ ‡¶∏‡ßá‡¶®‡ßç‡¶° ‡¶Æ‡¶æ‡¶®‡¶ø';
                            cardBg = isSelected
                              ? 'bg-gradient-to-r from-[#9b0f49]/80 via-[#e2136e]/40 to-slate-900 border-[#e2136e] shadow-[0_0_25px_rgba(226,19,110,0.4)] ring-2 ring-[#e2136e]'
                              : 'bg-gradient-to-r from-[#e2136e]/10 to-slate-900/80 border-[#e2136e]/30 hover:border-[#e2136e]/60 text-slate-200';
                            brandBadge = 'bg-[#e2136e]/20 text-pink-300 border border-[#e2136e]/40';
                          } else if (isNagad) {
                            brandSub = method.type || '‡¶®‡¶ó‡¶¶ ‡¶∏‡ßá‡¶®‡ßç‡¶° ‡¶Æ‡¶æ‡¶®‡¶ø';
                            cardBg = isSelected
                              ? 'bg-gradient-to-r from-[#9a3412]/80 via-[#ea580c]/40 to-slate-900 border-[#ea580c] shadow-[0_0_25px_rgba(234,88,12,0.4)] ring-2 ring-[#ea580c]'
                              : 'bg-gradient-to-r from-[#ea580c]/10 to-slate-900/80 border-[#ea580c]/30 hover:border-[#ea580c]/60 text-slate-200';
                            brandBadge = 'bg-[#ea580c]/20 text-orange-300 border border-[#ea580c]/40';
                          } else if (isRocket) {
                            brandSub = method.type || '‡¶∞‡¶ï‡ßá‡¶ü ‡¶∏‡ßá‡¶®‡ßç‡¶° ‡¶Æ‡¶æ‡¶®‡¶ø';
                            cardBg = isSelected
                              ? 'bg-gradient-to-r from-[#581c87]/80 via-[#8c3494]/40 to-slate-900 border-[#8c3494] shadow-[0_0_25px_rgba(140,52,148,0.4)] ring-2 ring-[#8c3494]'
                              : 'bg-gradient-to-r from-[#8c3494]/10 to-slate-900/80 border-[#8c3494]/30 hover:border-[#8c3494]/60 text-slate-200';
                            brandBadge = 'bg-[#8c3494]/20 text-purple-300 border border-[#8c3494]/40';
                          } else if (isUpay) {
                            brandSub = method.type || '‡¶â‡¶™‡¶æ‡¶Ø‡¶º ‡¶∏‡ßá‡¶®‡ßç‡¶° ‡¶Æ‡¶æ‡¶®‡¶ø';
                            cardBg = isSelected
                              ? 'bg-gradient-to-r from-[#003b73]/80 via-[#005696]/40 to-slate-900 border-[#0077b6] shadow-[0_0_25px_rgba(0,119,182,0.4)] ring-2 ring-[#0077b6]'
                              : 'bg-gradient-to-r from-[#005696]/10 to-slate-900/80 border-[#005696]/30 hover:border-[#005696]/60 text-slate-200';
                            brandBadge = 'bg-[#005696]/20 text-cyan-300 border border-[#005696]/40';
                          } else if (isBinance) {
                            brandSub = 'Binance Pay / USDT';
                            cardBg = isSelected
                              ? 'bg-gradient-to-r from-[#713f12]/80 via-[#f0b90b]/20 to-slate-950 border-[#f0b90b] shadow-[0_0_25px_rgba(240,185,11,0.4)] ring-2 ring-[#f0b90b]'
                              : 'bg-gradient-to-r from-[#f0b90b]/10 to-slate-950/80 border-[#f0b90b]/30 hover:border-[#f0b90b]/60 text-slate-200';
                            brandBadge = 'bg-[#f0b90b]/20 text-amber-300 border border-[#f0b90b]/40';
                          } else {
                            brandSub = method.type || '‡¶¨‡ßç‡¶Ø‡¶æ‡¶Ç‡¶ï ‡¶ü‡ßç‡¶∞‡¶æ‡¶®‡ßç‡¶∏‡¶´‡¶æ‡¶∞';
                            cardBg = isSelected
                              ? 'bg-gradient-to-r from-[#064e3b]/80 via-[#0f766e]/40 to-slate-900 border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.4)] ring-2 ring-emerald-500'
                              : 'bg-gradient-to-r from-emerald-600/10 to-slate-900/80 border-emerald-500/30 hover:border-emerald-500/60 text-slate-200';
                            brandBadge = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
                          }

                          return (
                            <div
                              key={methodId}
                              onClick={() => {
                                setSelectedMethod(methodId);
                                haptic('light');
                              }}
                              className={`relative p-4 rounded-2xl cursor-pointer transition-all duration-200 border flex items-center justify-between gap-3 ${cardBg} ${
                                isSelected ? 'scale-[1.02]' : ''
                              }`}
                            >
                              {/* Left: Logo + Label & Type */}
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-black/50 border border-white/10 flex-shrink-0 flex items-center justify-center shadow-inner">
                                  {renderMethodLogo(method, 'w-8 h-8')}
                                </div>
                                <div>
                                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                                    <span>{method.label}</span>
                                    {isBinance && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 font-mono">
                                        ‚ö° Crypto / USD
                                      </span>
                                    )}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${brandBadge}`}>
                                      {brandSub}
                                    </span>
                                    {method.ussd && (
                                      <span className="text-[10px] text-slate-400 font-mono font-bold">
                                        {method.ussd}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Checkbox / Selection Indicator */}
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition flex-shrink-0 ${
                                  isSelected
                                    ? isBkash
                                      ? 'bg-[#e2136e] border-pink-300 text-white shadow-md'
                                      : isNagad
                                      ? 'bg-[#ea580c] border-orange-300 text-white shadow-md'
                                      : isRocket
                                      ? 'bg-[#8c3494] border-purple-300 text-white shadow-md'
                                      : isUpay
                                      ? 'bg-[#005696] border-cyan-300 text-white shadow-md'
                                      : isBinance
                                      ? 'bg-[#f0b90b] border-yellow-200 text-slate-950 font-black shadow-md'
                                      : 'bg-emerald-600 border-emerald-300 text-white shadow-md'
                                    : 'border-white/20 bg-transparent'
                                }`}
                              >
                                {isSelected && <i className="fas fa-check text-[10px] font-black"></i>}
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setDepositStep('amount');
                          haptic('light');
                        }}
                        className="w-1/3 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <i className="fas fa-arrow-left text-[11px]"></i>
                        <span>‡¶¨‡ßç‡¶Ø‡¶æ‡¶ï‡ßá ‡¶Ø‡¶æ‡¶®</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDepositStep('gateway');
                          haptic('success');
                        }}
                        className="w-2/3 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm tracking-wider uppercase shadow-[0_0_20px_rgba(168,85,247,0.4)] transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶™‡ßá‡¶ú‡ßá ‡¶Ø‡¶æ‡¶® (Proceed)</span>
                        <i className="fas fa-arrow-right text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: DEDICATED FULL-PAGE PAYMENT GATEWAY SCREEN (NEW DEDICATED PAGE) */}
              {depositStep === 'gateway' && (
                <div className="fixed inset-0 z-[100] bg-[#060913] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-950/30 via-[#060913] to-black overflow-y-auto flex flex-col justify-between items-center p-3 sm:p-6 animate-in fade-in zoom-in-95 duration-200">
                  {/* Outer Wrapper with Max Width */}
                  <div className="w-full max-w-lg mx-auto space-y-4 my-auto py-2">
                    {/* TOP HEADER BAR */}
                    <div className="bg-slate-900/90 border border-white/10 backdrop-blur-xl rounded-2xl p-3.5 flex items-center justify-between shadow-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setDepositStep('method');
                          haptic('light');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-black transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <i className="fas fa-arrow-left text-[11px]"></i>
                        <span>‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶Æ‡ßá‡¶•‡¶° ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶®</span>
                      </button>

                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1.5 text-xs font-black text-white">
                          <i className="fas fa-shield-alt text-emerald-400"></i>
                          <span>‡¶®‡¶ø‡¶∞‡¶æ‡¶™‡¶¶ ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶ó‡ßá‡¶ü‡¶ì‡¶Ø‡¶º‡ßá</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">256-Bit SSL Encrypted</span>
                      </div>

                      {/* Live 15-Minute Countdown Timer */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-black shadow-inner">
                        <i className="fas fa-clock text-[10px] animate-pulse"></i>
                        <span>{formatGatewayTimer(gatewayTimeLeft)}</span>
                      </div>
                    </div>

                    {/* ORDER & PAYABLE AMOUNT BANNER */}
                    <div className="bg-gradient-to-r from-blue-900/40 via-indigo-950/60 to-slate-900/80 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                      <div>
                        <span className="text-[10px] text-blue-300 font-extrabold uppercase tracking-widest block">
                          ‡¶™‡ßç‡¶∞‡¶¶‡ßá‡¶Ø‡¶º ‡¶ü‡¶æ‡¶ï‡¶æ‡¶∞ ‡¶™‡¶∞‡¶ø‡¶Æ‡¶æ‡¶£ (Payable Amount):
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-2xl sm:text-3xl font-black text-amber-300">
                            ‡ß≥ {parseFloat(depositAmount) || 0}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">BDT</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setDepositStep('amount');
                          haptic('light');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <i className="fas fa-edit text-[10px]"></i>
                        <span>‡¶ü‡¶æ‡¶ï‡¶æ ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶®</span>
                      </button>
                    </div>

                    {/* PAYMENT METHOD SELECTOR TABS (With custom brand badge styling) */}
                    <div>
                      <p className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶ó‡ßá‡¶ü‡¶ì‡¶Ø‡¶º‡ßá ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶®:</span>
                        <button
                          type="button"
                          onClick={() => setDepositStep('method')}
                          className="text-[10px] text-purple-400 hover:text-purple-300 font-bold underline"
                        >
                          ‡¶∏‡¶¨ ‡¶Æ‡ßá‡¶•‡¶° ‡¶¶‡ßá‡¶ñ‡ßÅ‡¶®
                        </button>
                      </p>
                      <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-none pb-1.5">
                        {(Object.entries(paymentMethodsConfig) as [string, PaymentMethodConfig][])
                          .filter(([_, m]) => m && m.active !== false)
                          .map(([key, method]) => {
                            const methodId = method.id || key;
                            const isSelected = selectedMethod === methodId;
                            const mKey = (method.iconType || method.id || method.label || key).toLowerCase();
                            const isBkash = mKey.includes('bkash');
                            const isNagad = mKey.includes('nagad');
                            const isRocket = mKey.includes('rocket');
                            const isUpay = mKey.includes('upay');
                            const isBinance = mKey.includes('binance') || mKey.includes('crypto') || mKey.includes('usdt') || !!method.isCrypto;

                            let tabStyle = 'bg-slate-900/70 hover:bg-slate-900 text-slate-400 border-white/10';
                            if (isSelected) {
                              if (isBkash) tabStyle = 'bg-gradient-to-r from-[#e2136e] to-[#9b0f49] text-white border-pink-300 shadow-[0_0_20px_rgba(226,19,110,0.5)] scale-105';
                              else if (isNagad) tabStyle = 'bg-gradient-to-r from-[#ea580c] to-[#c2410c] text-white border-orange-300 shadow-[0_0_20px_rgba(234,88,12,0.5)] scale-105';
                              else if (isRocket) tabStyle = 'bg-gradient-to-r from-[#8c3494] to-[#4c1d95] text-white border-purple-300 shadow-[0_0_20px_rgba(140,52,148,0.5)] scale-105';
                              else if (isUpay) tabStyle = 'bg-gradient-to-r from-[#005696] to-[#003b73] text-white border-cyan-300 shadow-[0_0_20px_rgba(0,119,182,0.5)] scale-105';
                              else if (isBinance) tabStyle = 'bg-gradient-to-r from-[#f0b90b] to-[#b48608] text-slate-950 font-black border-yellow-200 shadow-[0_0_20px_rgba(240,185,11,0.5)] scale-105';
                              else tabStyle = 'bg-gradient-to-r from-emerald-600 to-teal-800 text-white border-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.5)] scale-105';
                            }

                            return (
                              <div
                                key={methodId}
                                onClick={() => {
                                  setSelectedMethod(methodId);
                                  haptic('light');
                                }}
                                className={`relative flex items-center gap-2 py-2 px-3.5 rounded-2xl cursor-pointer transition-all flex-shrink-0 border font-black text-xs ${tabStyle}`}
                              >
                                {renderMethodLogo(method, 'w-5 h-5')}
                                <span>{method.label}</span>
                                {isSelected && (
                                  <span className="w-2 h-2 rounded-full bg-white shadow-sm animate-ping ml-0.5"></span>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* DEDICATED DISTINCT BRANDED PAYMENT CARDS */}
                    {(() => {
                      const activeCfg = paymentMethodsConfig[selectedMethod] ||
                        (Object.values(paymentMethodsConfig) as PaymentMethodConfig[]).find((m) => m && (m.id === selectedMethod || m.label === selectedMethod)) || {
                          id: selectedMethod,
                          label: selectedMethod,
                          number: '01840442809',
                          type: 'Send Money',
                          ussd: '*247#',
                          color: '#e2136e',
                          active: true
                        };

                      const mKey = (activeCfg.iconType || activeCfg.id || activeCfg.label || selectedMethod).toLowerCase();
                      const isBkash = mKey.includes('bkash');
                      const isNagad = mKey.includes('nagad');
                      const isRocket = mKey.includes('rocket');
                      const isUpay = mKey.includes('upay');
                      const isBinance = mKey.includes('binance') || mKey.includes('crypto') || mKey.includes('usdt') || !!activeCfg.isCrypto;

                      const amountNum = parseFloat(depositAmount) || 0;
                      const usdAmount = (amountNum / 120).toFixed(2);

                      // 1. BKASH (‡¶¨‡¶ø‡¶ï‡¶æ‡¶∂) DEDICATED GATEWAY CARD
                      if (isBkash) {
                        return (
                          <div className="rounded-3xl p-5 sm:p-7 text-white shadow-2xl transition-all duration-300 relative overflow-hidden border border-pink-400/40 bg-gradient-to-br from-[#a00947] via-[#e2136e] to-[#730630]">
                            {/* Decorative ambient elements */}
                            <div className="absolute top-0 right-0 w-56 h-56 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
                            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-pink-400/20 rounded-full blur-2xl pointer-events-none"></div>

                            {/* bKash Header Badge */}
                            <div className="flex items-center justify-between pb-4 mb-4 border-b border-pink-300/30">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-white p-1.5 shadow-lg flex items-center justify-center">
                                  {renderMethodLogo(activeCfg, 'w-9 h-9')}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-black text-lg text-white tracking-wide">
                                      ‡¶¨‡¶ø‡¶ï‡¶æ‡¶∂ ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶ó‡ßá‡¶ü‡¶ì‡¶Ø‡¶º‡ßá
                                    </h3>
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/20 text-white font-extrabold border border-white/30">
                                      bKash Personal
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-pink-100/90 font-medium mt-0.5">
                                    {activeCfg.ussd || '*247#'} ‡¶Ö‡¶•‡¶¨‡¶æ ‡¶¨‡¶ø‡¶ï‡¶æ‡¶∂ ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶™ ‡¶¶‡¶ø‡¶Ø‡¶º‡ßá ‡¶∏‡ßá‡¶®‡ßç‡¶° ‡¶Æ‡¶æ‡¶®‡¶ø ‡¶ï‡¶∞‡ßÅ‡¶®
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Recipient Number Box */}
                            <div className="p-3.5 rounded-2xl bg-black/40 backdrop-blur-md border border-pink-300/40 mb-4 shadow-inner">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-bold text-pink-200 uppercase tracking-wider flex items-center gap-1.5">
                                  <i className="fas fa-mobile-alt text-amber-300"></i>
                                  <span>‡¶¨‡¶ø‡¶ï‡¶æ‡¶∂ ‡¶™‡¶æ‡¶∞‡ßç‡¶∏‡ßã‡¶®‡¶æ‡¶≤ ‡¶®‡¶Æ‡ßç‡¶¨‡¶∞ (‡¶∏‡ßá‡¶®‡ßç‡¶° ‡¶Æ‡¶æ‡¶®‡¶ø):</span>
                                </span>
                                <span className="text-[10px] text-pink-200 font-mono">Personal Send Money</span>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-1">
                                <span className="font-mono font-black text-base sm:text-lg text-amber-300 tracking-widest select-all">
                                  {activeCfg.number}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyNumber(activeCfg.number)}
                                  className="px-3.5 py-1.5 rounded-xl bg-pink-500/40 hover:bg-pink-500/60 text-white border border-pink-300/50 font-black text-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm"
                                >
                                  <i className="fas fa-copy text-amber-300"></i>
                                  <span>Copy Number</span>
                                </button>
                              </div>
                            </div>

                            {/* 5-Step bKash Guidelines */}
                            <div className="space-y-2.5 text-xs sm:text-sm font-semibold text-white/95 leading-relaxed bg-black/25 p-3.5 rounded-2xl border border-pink-400/20 mb-4">
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#e2136e] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ßß
                                </span>
                                <span>
                                  ‡¶¨‡¶ø‡¶ï‡¶æ‡¶∂ ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶™ ‡¶ì‡¶™‡ßá‡¶® ‡¶ï‡¶∞‡ßÅ‡¶® ‡¶Ö‡¶•‡¶¨‡¶æ ‡¶°‡¶æ‡ßü‡¶æ‡¶≤ ‡¶ï‡¶∞‡ßÅ‡¶® <strong>*247#</strong>
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#e2136e] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ß®
                                </span>
                                <span>
                                  <strong>Send Money</strong> (‡¶∏‡ßá‡¶®‡ßç‡¶° ‡¶Æ‡¶æ‡¶®‡¶ø) ‡¶Ö‡¶™‡¶∂‡¶® ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#e2136e] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ß©
                                </span>
                                <span>
                                  ‡¶™‡ßç‡¶∞‡¶æ‡¶™‡¶ï ‡¶®‡¶Æ‡ßç‡¶¨‡¶∞ ‡¶¨‡¶ï‡ßç‡¶∏‡ßá <strong>{activeCfg.number}</strong> ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶®
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#e2136e] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ß™
                                </span>
                                <span>
                                  ‡¶ü‡¶æ‡¶ï‡¶æ‡¶∞ ‡¶™‡¶∞‡¶ø‡¶Æ‡¶æ‡¶£ <strong>‡ß≥ {amountNum}</strong> ‡¶≤‡¶ø‡¶ñ‡ßá ‡¶Ü‡¶™‡¶®‡¶æ‡¶∞ ‡¶¨‡¶ø‡¶ï‡¶æ‡¶∂ <strong>PIN</strong> ‡¶¶‡¶ø‡ßü‡ßá ‡¶≤‡ßá‡¶®‡¶¶‡ßá‡¶® ‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#e2136e] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ß´
                                </span>
                                <span>
                                  ‡¶≤‡ßá‡¶®‡¶¶‡ßá‡¶®‡ßá‡¶∞ ‡¶™‡¶∞ ‡¶Æ‡ßá‡¶∏‡ßá‡¶ú‡ßá ‡¶Ü‡¶∏‡¶æ <strong>TrxID (‡ßß‡ß¶ ‡¶°‡¶ø‡¶ú‡¶ø‡¶ü)</strong> ‡¶®‡¶ø‡¶ö‡ßá‡¶∞ ‡¶¨‡¶ï‡ßç‡¶∏‡ßá ‡¶¶‡¶ø‡¶®
                                </span>
                              </div>
                            </div>

                            {/* Transaction ID Input */}
                            <div className="mb-4">
                              <label className="block text-xs font-black text-white mb-1.5 flex items-center justify-between">
                                <span>‡¶¨‡¶ø‡¶ï‡¶æ‡¶∂ ‡¶ü‡ßç‡¶∞‡¶æ‡¶®‡¶ú‡ßá‡¶ï‡¶∂‡¶® ‡¶Ü‡¶á‡¶°‡¶ø ‡¶¶‡¶ø‡¶® (bKash TrxID):</span>
                                <span className="text-[10px] text-pink-200 font-mono">Example: BLM6AK9012</span>
                              </label>
                              <input
                                type="text"
                                className="w-full bg-white text-slate-950 font-black font-mono text-sm sm:text-base px-4 py-3.5 rounded-xl border-2 border-white/60 focus:border-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-300/30 uppercase placeholder:text-slate-400 shadow-lg text-center tracking-widest"
                                placeholder="‡¶è‡¶ñ‡¶æ‡¶®‡ßá bKash TrxID ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶®"
                                value={depositTrxId}
                                onChange={(e) => {
                                  setDepositTrxId(e.target.value);
                                  setDepTrxErr('');
                                }}
                              />
                              {depTrxErr && (
                                <p className="text-xs font-bold text-yellow-200 mt-2 bg-black/60 px-3 py-1.5 rounded-lg text-center shadow border border-yellow-400/40">
                                  ‚ö†Ô∏è {depTrxErr}
                                </p>
                              )}
                            </div>

                            {/* Screenshot Upload */}
                            <div className="mb-5 p-3 rounded-2xl bg-black/35 backdrop-blur-md border border-pink-300/30 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                                  <i className="fas fa-camera text-yellow-300"></i>
                                  <span>‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡¶∂‡¶ü ‡¶¨‡¶æ ‡¶∏‡ßç‡¶≤‡¶ø‡¶™ ‡¶Ü‡¶™‡¶≤‡ßã‡¶° (‡¶ê‡¶ö‡ßç‡¶õ‡¶ø‡¶ï):</span>
                                </label>
                                {depositReceiptImage && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDepositReceiptImage('');
                                      setDepositReceiptFileName('');
                                      haptic('light');
                                    }}
                                    className="text-[10px] text-pink-200 hover:text-white font-bold underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <i className="fas fa-times"></i> ‡¶õ‡¶¨‡¶ø ‡¶Æ‡ßÅ‡¶õ‡ßÅ‡¶®
                                  </button>
                                )}
                              </div>

                              {depositReceiptImage ? (
                                <div className="relative rounded-xl overflow-hidden border-2 border-pink-300/60 bg-black/60 p-2 flex items-center gap-3">
                                  <img
                                    src={depositReceiptImage}
                                    alt="bKash Screenshot"
                                    className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg border border-white/20 cursor-pointer shadow-md"
                                    onClick={() => setSelectedScreenshotPreview(depositReceiptImage)}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                                      <i className="fas fa-check-circle"></i>
                                      <span>‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡¶∂‡¶ü ‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶π‡ßü‡ßá‡¶õ‡ßá!</span>
                                    </p>
                                    <p className="text-[10px] text-slate-300 truncate font-mono mt-0.5">
                                      {depositReceiptFileName || 'bkash_receipt.png'}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <label className="relative flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-pink-300/40 hover:border-white bg-white/5 hover:bg-white/10 cursor-pointer transition text-center group">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleDepositReceiptUpload}
                                  />
                                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                    <i className="fas fa-cloud-upload-alt text-amber-300"></i>
                                    <span>‡¶¨‡¶ø‡¶ï‡¶æ‡¶∂ ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡¶∂‡¶ü ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®</span>
                                  </span>
                                  <span className="text-[10px] text-pink-200/80 mt-0.5">
                                    JPG, PNG (‡¶∏‡¶∞‡ßç‡¶¨‡ßã‡¶ö‡ßç‡¶ö ‡ßÆMB)
                                  </span>
                                </label>
                              )}
                            </div>

                            {/* Verify Button */}
                            <button
                              type="button"
                              onClick={handleSubmitDeposit}
                              disabled={depositSubmitting}
                              className="w-full py-4 rounded-2xl bg-white hover:bg-pink-50 text-[#e2136e] font-black text-base sm:text-lg tracking-wider uppercase shadow-2xl transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer border-2 border-white/80"
                            >
                              {depositSubmitting ? (
                                <span className="loading-spinner"></span>
                              ) : (
                                <>
                                  <span>‡¶¨‡¶ø‡¶ï‡¶æ‡¶∂ ‡¶≠‡ßá‡¶∞‡¶ø‡¶´‡¶æ‡¶á ‡¶ï‡¶∞‡ßÅ‡¶® (VERIFY bKash)</span>
                                  <i className="fas fa-check-circle text-emerald-600 text-lg"></i>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      }

                      // 2. NAGAD (‡¶®‡¶ó‡¶¶) DEDICATED GATEWAY CARD
                      if (isNagad) {
                        return (
                          <div className="rounded-3xl p-5 sm:p-7 text-white shadow-2xl transition-all duration-300 relative overflow-hidden border border-orange-400/40 bg-gradient-to-br from-[#9a3412] via-[#ea580c] to-[#7c2d12]">
                            {/* Decorative ambient elements */}
                            <div className="absolute top-0 right-0 w-56 h-56 bg-amber-400/15 rounded-full blur-3xl pointer-events-none"></div>
                            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-orange-400/20 rounded-full blur-2xl pointer-events-none"></div>

                            {/* Nagad Header Badge */}
                            <div className="flex items-center justify-between pb-4 mb-4 border-b border-orange-300/30">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-white p-1.5 shadow-lg flex items-center justify-center">
                                  {renderMethodLogo(activeCfg, 'w-9 h-9')}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-black text-lg text-white tracking-wide">
                                      ‡¶®‡¶ó‡¶¶ ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶ó‡ßá‡¶ü‡¶ì‡¶Ø‡¶º‡ßá
                                    </h3>
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/20 text-white font-extrabold border border-white/30">
                                      ‡¶°‡¶æ‡¶ï ‡¶¨‡¶ø‡¶≠‡¶æ‡¶ó ‡¶Ö‡¶®‡ßÅ‡¶Æ‡ßã‡¶¶‡¶ø‡¶§
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-orange-100/90 font-medium mt-0.5">
                                    {activeCfg.ussd || '*167#'} ‡¶°‡¶æ‡ßü‡¶æ‡¶≤ ‡¶Ö‡¶•‡¶¨‡¶æ ‡¶®‡¶ó‡¶¶ ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶™ ‡¶¶‡¶ø‡ßü‡ßá ‡¶∏‡ßá‡¶®‡ßç‡¶° ‡¶Æ‡¶æ‡¶®‡¶ø ‡¶ï‡¶∞‡ßÅ‡¶®
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Recipient Number Box */}
                            <div className="p-3.5 rounded-2xl bg-black/40 backdrop-blur-md border border-orange-300/40 mb-4 shadow-inner">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-bold text-orange-200 uppercase tracking-wider flex items-center gap-1.5">
                                  <i className="fas fa-mobile-alt text-amber-300"></i>
                                  <span>‡¶®‡¶ó‡¶¶ ‡¶è‡¶ï‡¶æ‡¶â‡¶®‡ßç‡¶ü ‡¶®‡¶Æ‡ßç‡¶¨‡¶∞ (Send Money):</span>
                                </span>
                                <span className="text-[10px] text-orange-200 font-mono">Nagad Personal</span>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-1">
                                <span className="font-mono font-black text-base sm:text-lg text-amber-300 tracking-widest select-all">
                                  {activeCfg.number}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyNumber(activeCfg.number)}
                                  className="px-3.5 py-1.5 rounded-xl bg-orange-500/40 hover:bg-orange-500/60 text-white border border-orange-300/50 font-black text-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm"
                                >
                                  <i className="fas fa-copy text-amber-300"></i>
                                  <span>Copy Nagad</span>
                                </button>
                              </div>
                            </div>

                            {/* 5-Step Nagad Guidelines */}
                            <div className="space-y-2.5 text-xs sm:text-sm font-semibold text-white/95 leading-relaxed bg-black/25 p-3.5 rounded-2xl border border-orange-400/20 mb-4">
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#ea580c] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ßß
                                </span>
                                <span>
                                  ‡¶®‡¶ó‡¶¶ ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶™ ‡¶ì‡¶™‡ßá‡¶® ‡¶ï‡¶∞‡ßÅ‡¶® ‡¶Ö‡¶•‡¶¨‡¶æ ‡¶°‡¶æ‡ßü‡¶æ‡¶≤ ‡¶™‡ßç‡¶Ø‡¶æ‡¶°‡ßá ‡¶°‡¶æ‡ßü‡¶æ‡¶≤ ‡¶ï‡¶∞‡ßÅ‡¶® <strong>*167#</strong>
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#ea580c] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ß®
                                </span>
                                <span>
                                  ‡¶Æ‡ßá‡¶®‡ßÅ ‡¶•‡ßá‡¶ï‡ßá <strong>Send Money</strong> (‡¶∏‡ßá‡¶®‡ßç‡¶° ‡¶Æ‡¶æ‡¶®‡¶ø) ‡¶Ö‡¶™‡¶∂‡¶® ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#ea580c] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ß©
                                </span>
                                <span>
                                  ‡¶™‡ßç‡¶∞‡¶æ‡¶™‡¶ï ‡¶®‡¶ó‡¶¶ ‡¶®‡¶Æ‡ßç‡¶¨‡¶∞‡ßá <strong>{activeCfg.number}</strong> ‡¶ü‡¶æ‡¶á‡¶™ ‡¶ï‡¶∞‡ßÅ‡¶®
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#ea580c] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ß™
                                </span>
                                <span>
                                  ‡¶ü‡¶æ‡¶ï‡¶æ‡¶∞ ‡¶™‡¶∞‡¶ø‡¶Æ‡¶æ‡¶£ <strong>‡ß≥ {amountNum}</strong> ‡¶ì ‡¶Ü‡¶™‡¶®‡¶æ‡¶∞ ‡¶®‡¶ó‡¶¶ <strong>PIN</strong> ‡¶¶‡¶ø‡ßü‡ßá ‡¶ü‡ßç‡¶Ø‡¶æ‡¶™ ‡¶ï‡¶∞‡ßá ‡¶ß‡¶∞‡ßá ‡¶∞‡¶æ‡¶ñ‡ßÅ‡¶®
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#ea580c] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ß´
                                </span>
                                <span>
                                  ‡¶≤‡ßá‡¶®‡¶¶‡ßá‡¶® ‡¶∏‡¶´‡¶≤ ‡¶π‡¶≤‡ßá ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶® ‡¶¨‡¶æ ‡¶è‡¶∏‡¶è‡¶Æ‡¶è‡¶∏-‡¶è‡¶∞ <strong>Txn ID (‡ßÆ ‡¶°‡¶ø‡¶ú‡¶ø‡¶ü)</strong> ‡¶®‡¶ø‡¶ö‡ßá ‡¶¶‡¶ø‡¶®
                                </span>
                              </div>
                            </div>

                            {/* Transaction ID Input */}
                            <div className="mb-4">
                              <label className="block text-xs font-black text-white mb-1.5 flex items-center justify-between">
                                <span>‡¶®‡¶ó‡¶¶ ‡¶ü‡ßç‡¶∞‡¶æ‡¶®‡¶ú‡ßá‡¶ï‡¶∂‡¶® ‡¶Ü‡¶á‡¶°‡¶ø ‡¶¶‡¶ø‡¶® (Nagad TxnID):</span>
                                <span className="text-[10px] text-orange-200 font-mono">Example: 7NB82M94</span>
                              </label>
                              <input
                                type="text"
                                className="w-full bg-white text-slate-950 font-black font-mono text-sm sm:text-base px-4 py-3.5 rounded-xl border-2 border-white/60 focus:border-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-300/30 uppercase placeholder:text-slate-400 shadow-lg text-center tracking-widest"
                                placeholder="‡¶è‡¶ñ‡¶æ‡¶®‡ßá Nagad Txn ID ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶®"
                                value={depositTrxId}
                                onChange={(e) => {
                                  setDepositTrxId(e.target.value);
                                  setDepTrxErr('');
                                }}
                              />
                              {depTrxErr && (
                                <p className="text-xs font-bold text-yellow-200 mt-2 bg-black/60 px-3 py-1.5 rounded-lg text-center shadow border border-yellow-400/40">
                                  ‚ö†Ô∏è {depTrxErr}
                                </p>
                              )}
                            </div>

                            {/* Screenshot Upload */}
                            <div className="mb-5 p-3 rounded-2xl bg-black/35 backdrop-blur-md border border-orange-300/30 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                                  <i className="fas fa-camera text-yellow-300"></i>
                                  <span>‡¶®‡¶ó‡¶¶ ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡¶∂‡¶ü (‡¶ê‡¶ö‡ßç‡¶õ‡¶ø‡¶ï):</span>
                                </label>
                                {depositReceiptImage && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDepositReceiptImage('');
                                      setDepositReceiptFileName('');
                                      haptic('light');
                                    }}
                                    className="text-[10px] text-orange-200 hover:text-white font-bold underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <i className="fas fa-times"></i> ‡¶õ‡¶¨‡¶ø ‡¶Æ‡ßÅ‡¶õ‡ßÅ‡¶®
                                  </button>
                                )}
                              </div>

                              {depositReceiptImage ? (
                                <div className="relative rounded-xl overflow-hidden border-2 border-orange-300/60 bg-black/60 p-2 flex items-center gap-3">
                                  <img
                                    src={depositReceiptImage}
                                    alt="Nagad Screenshot"
                                    className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg border border-white/20 cursor-pointer shadow-md"
                                    onClick={() => setSelectedScreenshotPreview(depositReceiptImage)}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                                      <i className="fas fa-check-circle"></i>
                                      <span>‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡¶∂‡¶ü ‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶π‡ßü‡ßá‡¶õ‡ßá!</span>
                                    </p>
                                    <p className="text-[10px] text-slate-300 truncate font-mono mt-0.5">
                                      {depositReceiptFileName || 'nagad_receipt.png'}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <label className="relative flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-orange-300/40 hover:border-white bg-white/5 hover:bg-white/10 cursor-pointer transition text-center group">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleDepositReceiptUpload}
                                  />
                                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                    <i className="fas fa-cloud-upload-alt text-amber-300"></i>
                                    <span>‡¶®‡¶ó‡¶¶ ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡¶∂‡¶ü ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®</span>
                                  </span>
                                  <span className="text-[10px] text-orange-200/80 mt-0.5">
                                    JPG, PNG (‡¶∏‡¶∞‡ßç‡¶¨‡ßã‡¶ö‡ßç‡¶ö ‡ßÆMB)
                                  </span>
                                </label>
                              )}
                            </div>

                            {/* Verify Button */}
                            <button
                              type="button"
                              onClick={handleSubmitDeposit}
                              disabled={depositSubmitting}
                              className="w-full py-4 rounded-2xl bg-white hover:bg-orange-50 text-[#ea580c] font-black text-base sm:text-lg tracking-wider uppercase shadow-2xl transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer border-2 border-white/80"
                            >
                              {depositSubmitting ? (
                                <span className="loading-spinner"></span>
                              ) : (
                                <>
                                  <span>‡¶®‡¶ó‡¶¶ ‡¶≠‡ßá‡¶∞‡¶ø‡¶´‡¶æ‡¶á ‡¶ï‡¶∞‡ßÅ‡¶® (VERIFY NAGAD)</span>
                                  <i className="fas fa-check-circle text-emerald-600 text-lg"></i>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      }

                      // 3. ROCKET (‡¶∞‡¶ï‡ßá‡¶ü - ‡¶°‡¶æ‡¶ö ‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ ‡¶¨‡ßç‡¶Ø‡¶æ‡¶Ç‡¶ï) DEDICATED GATEWAY CARD
                      if (isRocket) {
                        return (
                          <div className="rounded-3xl p-5 sm:p-7 text-white shadow-2xl transition-all duration-300 relative overflow-hidden border border-purple-400/40 bg-gradient-to-br from-[#4c1d95] via-[#8c3494] to-[#2e1065]">
                            {/* Decorative ambient elements */}
                            <div className="absolute top-0 right-0 w-56 h-56 bg-purple-400/15 rounded-full blur-3xl pointer-events-none"></div>
                            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-violet-400/20 rounded-full blur-2xl pointer-events-none"></div>

                            {/* Rocket Header Badge */}
                            <div className="flex items-center justify-between pb-4 mb-4 border-b border-purple-300/30">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-white p-1.5 shadow-lg flex items-center justify-center">
                                  {renderMethodLogo(activeCfg, 'w-9 h-9')}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-black text-lg text-white tracking-wide">
                                      ‡¶∞‡¶ï‡ßá‡¶ü ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶ó‡ßá‡¶ü‡¶ì‡¶Ø‡¶º‡ßá
                                    </h3>
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/20 text-white font-extrabold border border-white/30">
                                      DBBL Rocket
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-purple-200 font-medium mt-0.5">
                                    {activeCfg.ussd || '*322#'} ‡¶°‡¶æ‡ßü‡¶æ‡¶≤ ‡¶Ö‡¶•‡¶¨‡¶æ ‡¶∞‡¶ï‡ßá‡¶ü ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶™ ‡¶¶‡¶ø‡ßü‡ßá ‡¶ü‡¶æ‡¶ï‡¶æ ‡¶™‡¶æ‡¶†‡¶æ‡¶®
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Recipient Number Box */}
                            <div className="p-3.5 rounded-2xl bg-black/40 backdrop-blur-md border border-purple-300/40 mb-4 shadow-inner">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-bold text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
                                  <i className="fas fa-mobile-alt text-amber-300"></i>
                                  <span>‡¶∞‡¶ï‡ßá‡¶ü ‡ßß‡ß®-‡¶°‡¶ø‡¶ú‡¶ø‡¶ü ‡¶è‡¶ï‡¶æ‡¶â‡¶®‡ßç‡¶ü ‡¶®‡¶Æ‡ßç‡¶¨‡¶∞:</span>
                                </span>
                                <span className="text-[10px] text-purple-200 font-mono">12-Digit Account</span>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-1">
                                <span className="font-mono font-black text-base sm:text-lg text-amber-300 tracking-widest select-all">
                                  {activeCfg.number}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyNumber(activeCfg.number)}
                                  className="px-3.5 py-1.5 rounded-xl bg-purple-500/40 hover:bg-purple-500/60 text-white border border-purple-300/50 font-black text-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm"
                                >
                                  <i className="fas fa-copy text-amber-300"></i>
                                  <span>Copy Rocket</span>
                                </button>
                              </div>
                            </div>

                            {/* 5-Step Rocket Guidelines */}
                            <div className="space-y-2.5 text-xs sm:text-sm font-semibold text-white/95 leading-relaxed bg-black/25 p-3.5 rounded-2xl border border-purple-400/20 mb-4">
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#8c3494] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ßß
                                </span>
                                <span>
                                  ‡¶∞‡¶ï‡ßá‡¶ü ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶™ ‡¶ì‡¶™‡ßá‡¶® ‡¶ï‡¶∞‡ßÅ‡¶® ‡¶Ö‡¶•‡¶¨‡¶æ ‡¶°‡¶æ‡ßü‡¶æ‡¶≤ ‡¶ï‡¶∞‡ßÅ‡¶® <strong>*322#</strong>
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#8c3494] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ß®
                                </span>
                                <span>
                                  <strong>Send Money</strong> ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#8c3494] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ß©
                                </span>
                                <span>
                                  ‡¶™‡ßç‡¶∞‡¶æ‡¶™‡¶ï ‡¶∞‡¶ï‡ßá‡¶ü ‡¶è‡¶ï‡¶æ‡¶â‡¶®‡ßç‡¶ü ‡¶®‡¶Æ‡ßç‡¶¨‡¶∞‡ßá <strong>{activeCfg.number}</strong> ‡¶¶‡¶ø‡¶®
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#8c3494] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ß™
                                </span>
                                <span>
                                  ‡¶ü‡¶æ‡¶ï‡¶æ‡¶∞ ‡¶™‡¶∞‡¶ø‡¶Æ‡¶æ‡¶£ <strong>‡ß≥ {amountNum}</strong> ‡¶¶‡¶ø‡ßü‡ßá ‡¶∞‡¶ï‡ßá‡¶ü <strong>PIN</strong> ‡¶¶‡¶ø‡ßü‡ßá ‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#8c3494] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ß´
                                </span>
                                <span>
                                  ‡¶´‡¶ø‡¶∞‡¶§‡¶ø ‡¶Æ‡ßá‡¶∏‡ßá‡¶ú‡ßá ‡¶Ü‡¶∏‡¶æ <strong>Txn ID</strong> ‡¶®‡¶ø‡¶ö‡ßá‡¶∞ ‡¶¨‡¶ï‡ßç‡¶∏‡ßá ‡¶¶‡¶ø‡¶®
                                </span>
                              </div>
                            </div>

                            {/* Transaction ID Input */}
                            <div className="mb-4">
                              <label className="block text-xs font-black text-white mb-1.5 flex items-center justify-between">
                                <span>‡¶∞‡¶ï‡ßá‡¶ü ‡¶ü‡ßç‡¶∞‡¶æ‡¶®‡¶ú‡ßá‡¶ï‡¶∂‡¶® ‡¶Ü‡¶á‡¶°‡¶ø ‡¶¶‡¶ø‡¶® (Rocket TxnID):</span>
                                <span className="text-[10px] text-purple-200 font-mono">Example: 2984716253</span>
                              </label>
                              <input
                                type="text"
                                className="w-full bg-white text-slate-950 font-black font-mono text-sm sm:text-base px-4 py-3.5 rounded-xl border-2 border-white/60 focus:border-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-300/30 uppercase placeholder:text-slate-400 shadow-lg text-center tracking-widest"
                                placeholder="‡¶è‡¶ñ‡¶æ‡¶®‡ßá Rocket Txn ID ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶®"
                                value={depositTrxId}
                                onChange={(e) => {
                                  setDepositTrxId(e.target.value);
                                  setDepTrxErr('');
                                }}
                              />
                              {depTrxErr && (
                                <p className="text-xs font-bold text-yellow-200 mt-2 bg-black/60 px-3 py-1.5 rounded-lg text-center shadow border border-yellow-400/40">
                                  ‚ö†Ô∏è {depTrxErr}
                                </p>
                              )}
                            </div>

                            {/* Screenshot Upload */}
                            <div className="mb-5 p-3 rounded-2xl bg-black/35 backdrop-blur-md border border-purple-300/30 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                                  <i className="fas fa-camera text-yellow-300"></i>
                                  <span>‡¶∞‡¶ï‡ßá‡¶ü ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶∏‡ßç‡¶≤‡¶ø‡¶™ / ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡¶∂‡¶ü (‡¶ê‡¶ö‡ßç‡¶õ‡¶ø‡¶ï):</span>
                                </label>
                                {depositReceiptImage && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDepositReceiptImage('');
                                      setDepositReceiptFileName('');
                                      haptic('light');
                                    }}
                                    className="text-[10px] text-purple-200 hover:text-white font-bold underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <i className="fas fa-times"></i> ‡¶õ‡¶¨‡¶ø ‡¶Æ‡ßÅ‡¶õ‡ßÅ‡¶®
                                  </button>
                                )}
                              </div>

                              {depositReceiptImage ? (
                                <div className="relative rounded-xl overflow-hidden border-2 border-purple-300/60 bg-black/60 p-2 flex items-center gap-3">
                                  <img
                                    src={depositReceiptImage}
                                    alt="Rocket Screenshot"
                                    className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg border border-white/20 cursor-pointer shadow-md"
                                    onClick={() => setSelectedScreenshotPreview(depositReceiptImage)}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                                      <i className="fas fa-check-circle"></i>
                                      <span>‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡¶∂‡¶ü ‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶π‡ßü‡ßá‡¶õ‡ßá!</span>
                                    </p>
                                    <p className="text-[10px] text-slate-300 truncate font-mono mt-0.5">
                                      {depositReceiptFileName || 'rocket_receipt.png'}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <label className="relative flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-purple-300/40 hover:border-white bg-white/5 hover:bg-white/10 cursor-pointer transition text-center group">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleDepositReceiptUpload}
                                  />
                                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                    <i className="fas fa-cloud-upload-alt text-amber-300"></i>
                                    <span>‡¶∞‡¶ï‡ßá‡¶ü ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡¶∂‡¶ü ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®</span>
                                  </span>
                                  <span className="text-[10px] text-purple-200/80 mt-0.5">
                                    JPG, PNG (‡¶∏‡¶∞‡ßç‡¶¨‡ßã‡¶ö‡ßç‡¶ö ‡ßÆMB)
                                  </span>
                                </label>
                              )}
                            </div>

                            {/* Verify Button */}
                            <button
                              type="button"
                              onClick={handleSubmitDeposit}
                              disabled={depositSubmitting}
                              className="w-full py-4 rounded-2xl bg-white hover:bg-purple-50 text-[#8c3494] font-black text-base sm:text-lg tracking-wider uppercase shadow-2xl transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer border-2 border-white/80"
                            >
                              {depositSubmitting ? (
                                <span className="loading-spinner"></span>
                              ) : (
                                <>
                                  <span>‡¶∞‡¶ï‡ßá‡¶ü ‡¶≠‡ßá‡¶∞‡¶ø‡¶´‡¶æ‡¶á ‡¶ï‡¶∞‡ßÅ‡¶® (VERIFY ROCKET)</span>
                                  <i className="fas fa-check-circle text-emerald-600 text-lg"></i>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      }

                      // 4. UPAY (‡¶â‡¶™‡¶æ‡¶Ø‡¶º - UCB FINTECH) DEDICATED GATEWAY CARD
                      if (isUpay) {
                        return (
                          <div className="rounded-3xl p-5 sm:p-7 text-white shadow-2xl transition-all duration-300 relative overflow-hidden border border-cyan-400/40 bg-gradient-to-br from-[#00284d] via-[#005696] to-[#00172e]">
                            {/* Decorative ambient elements */}
                            <div className="absolute top-0 right-0 w-56 h-56 bg-cyan-400/15 rounded-full blur-3xl pointer-events-none"></div>
                            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-blue-500/20 rounded-full blur-2xl pointer-events-none"></div>

                            {/* Upay Header Badge */}
                            <div className="flex items-center justify-between pb-4 mb-4 border-b border-cyan-300/30">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-white p-1.5 shadow-lg flex items-center justify-center">
                                  {renderMethodLogo(activeCfg, 'w-9 h-9')}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-black text-lg text-white tracking-wide">
                                      ‡¶â‡¶™‡¶æ‡¶Ø‡¶º ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶ó‡ßá‡¶ü‡¶ì‡¶Ø‡¶º‡ßá
                                    </h3>
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/20 text-cyan-200 font-extrabold border border-white/30">
                                      UCB Fintech
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-cyan-200 font-medium mt-0.5">
                                    {activeCfg.ussd || '*268#'} ‡¶°‡¶æ‡ßü‡¶æ‡¶≤ ‡¶Ö‡¶•‡¶¨‡¶æ ‡¶â‡¶™‡¶æ‡ßü ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶™ ‡¶¶‡¶ø‡ßü‡ßá ‡¶∏‡ßá‡¶®‡ßç‡¶° ‡¶Æ‡¶æ‡¶®‡¶ø ‡¶ï‡¶∞‡ßÅ‡¶®
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Recipient Number Box */}
                            <div className="p-3.5 rounded-2xl bg-black/40 backdrop-blur-md border border-cyan-300/40 mb-4 shadow-inner">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-bold text-cyan-200 uppercase tracking-wider flex items-center gap-1.5">
                                  <i className="fas fa-mobile-alt text-amber-300"></i>
                                  <span>‡¶â‡¶™‡¶æ‡ßü ‡¶ì‡ßü‡¶æ‡¶≤‡ßá‡¶ü ‡¶®‡¶Æ‡ßç‡¶¨‡¶∞:</span>
                                </span>
                                <span className="text-[10px] text-cyan-200 font-mono">Upay Wallet</span>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-1">
                                <span className="font-mono font-black text-base sm:text-lg text-amber-300 tracking-widest select-all">
                                  {activeCfg.number}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyNumber(activeCfg.number)}
                                  className="px-3.5 py-1.5 rounded-xl bg-cyan-600/40 hover:bg-cyan-600/60 text-white border border-cyan-300/50 font-black text-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm"
                                >
                                  <i className="fas fa-copy text-amber-300"></i>
                                  <span>Copy Upay</span>
                                </button>
                              </div>
                            </div>

                            {/* 5-Step Upay Guidelines */}
                            <div className="space-y-2.5 text-xs sm:text-sm font-semibold text-white/95 leading-relaxed bg-black/25 p-3.5 rounded-2xl border border-cyan-400/20 mb-4">
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#005696] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ßß
                                </span>
                                <span>
                                  ‡¶â‡¶™‡¶æ‡ßü ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶™ ‡¶ì‡¶™‡ßá‡¶® ‡¶ï‡¶∞‡ßÅ‡¶® ‡¶Ö‡¶•‡¶¨‡¶æ ‡¶°‡¶æ‡ßü‡¶æ‡¶≤ ‡¶ï‡¶∞‡ßÅ‡¶® <strong>*268#</strong>
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#005696] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ß®
                                </span>
                                <span>
                                  <strong>Send Money</strong> ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#005696] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ß©
                                </span>
                                <span>
                                  ‡¶™‡ßç‡¶∞‡¶æ‡¶™‡¶ï ‡¶â‡¶™‡¶æ‡ßü ‡¶ì‡ßü‡¶æ‡¶≤‡ßá‡¶ü ‡¶®‡¶Æ‡ßç‡¶¨‡¶∞ ‡¶π‡¶ø‡¶∏‡ßá‡¶¨‡ßá <strong>{activeCfg.number}</strong> ‡¶¶‡¶ø‡¶®
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#005696] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ß™
                                </span>
                                <span>
                                  ‡¶ü‡¶æ‡¶ï‡¶æ‡¶∞ ‡¶™‡¶∞‡¶ø‡¶Æ‡¶æ‡¶£ <strong>‡ß≥ {amountNum}</strong> ‡¶ì ‡¶Ü‡¶™‡¶®‡¶æ‡¶∞ ‡¶â‡¶™‡¶æ‡ßü <strong>PIN</strong> ‡¶¶‡¶ø‡ßü‡ßá ‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#005696] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ß´
                                </span>
                                <span>
                                  ‡¶´‡¶ø‡¶∞‡¶§‡¶ø ‡¶Æ‡ßá‡¶∏‡ßá‡¶ú‡ßá ‡¶™‡¶æ‡¶ì‡ßü‡¶æ <strong>TrxID</strong> ‡¶®‡¶ø‡¶ö‡ßá‡¶∞ ‡¶¨‡¶ï‡ßç‡¶∏‡ßá ‡¶¶‡¶ø‡¶®
                                </span>
                              </div>
                            </div>

                            {/* Transaction ID Input */}
                            <div className="mb-4">
                              <label className="block text-xs font-black text-white mb-1.5 flex items-center justify-between">
                                <span>‡¶â‡¶™‡¶æ‡ßü ‡¶ü‡ßç‡¶∞‡¶æ‡¶®‡¶ú‡ßá‡¶ï‡¶∂‡¶® ‡¶Ü‡¶á‡¶°‡¶ø ‡¶¶‡¶ø‡¶® (Upay TrxID):</span>
                                <span className="text-[10px] text-cyan-200 font-mono">Example: UP18492048</span>
                              </label>
                              <input
                                type="text"
                                className="w-full bg-white text-slate-950 font-black font-mono text-sm sm:text-base px-4 py-3.5 rounded-xl border-2 border-white/60 focus:border-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-300/30 uppercase placeholder:text-slate-400 shadow-lg text-center tracking-widest"
                                placeholder="‡¶è‡¶ñ‡¶æ‡¶®‡ßá Upay Trx ID ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶®"
                                value={depositTrxId}
                                onChange={(e) => {
                                  setDepositTrxId(e.target.value);
                                  setDepTrxErr('');
                                }}
                              />
                              {depTrxErr && (
                                <p className="text-xs font-bold text-yellow-200 mt-2 bg-black/60 px-3 py-1.5 rounded-lg text-center shadow border border-yellow-400/40">
                                  ‚ö†Ô∏è {depTrxErr}
                                </p>
                              )}
                            </div>

                            {/* Screenshot Upload */}
                            <div className="mb-5 p-3 rounded-2xl bg-black/35 backdrop-blur-md border border-cyan-300/30 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                                  <i className="fas fa-camera text-yellow-300"></i>
                                  <span>‡¶â‡¶™‡¶æ‡ßü ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡¶∂‡¶ü (‡¶ê‡¶ö‡ßç‡¶õ‡¶ø‡¶ï):</span>
                                </label>
                                {depositReceiptImage && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDepositReceiptImage('');
                                      setDepositReceiptFileName('');
                                      haptic('light');
                                    }}
                                    className="text-[10px] text-cyan-200 hover:text-white font-bold underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <i className="fas fa-times"></i> ‡¶õ‡¶¨‡¶ø ‡¶Æ‡ßÅ‡¶õ‡ßÅ‡¶®
                                  </button>
                                )}
                              </div>

                              {depositReceiptImage ? (
                                <div className="relative rounded-xl overflow-hidden border-2 border-cyan-300/60 bg-black/60 p-2 flex items-center gap-3">
                                  <img
                                    src={depositReceiptImage}
                                    alt="Upay Screenshot"
                                    className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg border border-white/20 cursor-pointer shadow-md"
                                    onClick={() => setSelectedScreenshotPreview(depositReceiptImage)}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                                      <i className="fas fa-check-circle"></i>
                                      <span>‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡¶∂‡¶ü ‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶π‡ßü‡ßá‡¶õ‡ßá!</span>
                                    </p>
                                    <p className="text-[10px] text-slate-300 truncate font-mono mt-0.5">
                                      {depositReceiptFileName || 'upay_receipt.png'}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <label className="relative flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-cyan-300/40 hover:border-white bg-white/5 hover:bg-white/10 cursor-pointer transition text-center group">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleDepositReceiptUpload}
                                  />
                                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                    <i className="fas fa-cloud-upload-alt text-amber-300"></i>
                                    <span>‡¶â‡¶™‡¶æ‡ßü ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡¶∂‡¶ü ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®</span>
                                  </span>
                                  <span className="text-[10px] text-cyan-200/80 mt-0.5">
                                    JPG, PNG (‡¶∏‡¶∞‡ßç‡¶¨‡ßã‡¶ö‡ßç‡¶ö ‡ßÆMB)
                                  </span>
                                </label>
                              )}
                            </div>

                            {/* Verify Button */}
                            <button
                              type="button"
                              onClick={handleSubmitDeposit}
                              disabled={depositSubmitting}
                              className="w-full py-4 rounded-2xl bg-white hover:bg-cyan-50 text-[#005696] font-black text-base sm:text-lg tracking-wider uppercase shadow-2xl transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer border-2 border-white/80"
                            >
                              {depositSubmitting ? (
                                <span className="loading-spinner"></span>
                              ) : (
                                <>
                                  <span>‡¶â‡¶™‡¶æ‡ßü ‡¶≠‡ßá‡¶∞‡¶ø‡¶´‡¶æ‡¶á ‡¶ï‡¶∞‡ßÅ‡¶® (VERIFY UPAY)</span>
                                  <i className="fas fa-check-circle text-emerald-600 text-lg"></i>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      }

                      // 5. BINANCE / USDT / CRYPTO DEDICATED GATEWAY CARD
                      if (isBinance) {
                        return (
                          <div className="rounded-3xl p-5 sm:p-7 text-white shadow-2xl transition-all duration-300 relative overflow-hidden border border-yellow-400/50 bg-gradient-to-br from-[#1e2329] via-[#12161a] to-[#0b0e11]">
                            {/* Decorative ambient elements */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/15 rounded-full blur-3xl pointer-events-none"></div>
                            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-amber-500/15 rounded-full blur-2xl pointer-events-none"></div>

                            {/* Binance Header Badge */}
                            <div className="flex items-center justify-between pb-4 mb-4 border-b border-yellow-500/30">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-[#f0b90b] p-1.5 shadow-lg flex items-center justify-center">
                                  {renderMethodLogo(activeCfg, 'w-9 h-9')}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-black text-lg text-yellow-400 tracking-wide font-mono">
                                      BINANCE PAY & USDT
                                    </h3>
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#f0b90b]/20 text-yellow-300 font-extrabold border border-[#f0b90b]/40 font-mono">
                                      0% Fee
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                                    Binance Pay UID ‡¶Ö‡¶•‡¶¨‡¶æ USDT (BEP20 / TRC20) ‡¶®‡ßá‡¶ü‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶ï‡ßá ‡¶™‡ßá ‡¶ï‡¶∞‡ßÅ‡¶®
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Real-time Crypto USD Rate & Calculator Banner */}
                            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-yellow-950/40 via-amber-950/50 to-slate-900/80 border border-yellow-500/40 mb-4 shadow-inner">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-extrabold text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <i className="fas fa-calculator text-yellow-300"></i>
                                  <span>USD ‡¶°‡¶≤‡¶æ‡¶∞ ‡¶ï‡¶®‡¶≠‡¶æ‡¶∞‡ßç‡¶∂‡¶® ‡¶∞‡ßá‡¶ü (1 USDT = ‡ß≥120):</span>
                                </span>
                                <span className="text-[10px] text-amber-300 font-mono font-bold">Instant Rate</span>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-1">
                                <div>
                                  <span className="font-mono font-black text-xl sm:text-2xl text-yellow-300 tracking-wider">
                                    $ {usdAmount} <span className="text-xs text-slate-400 font-normal">USD / USDT</span>
                                  </span>
                                  <span className="text-[11px] text-slate-400 block font-mono mt-0.5">
                                    (Equivalent to ‡ß≥ {amountNum} BDT)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => copyNumber(usdAmount)}
                                  className="px-3.5 py-1.5 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-400/40 font-black text-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm font-mono"
                                >
                                  <i className="fas fa-copy text-yellow-400"></i>
                                  <span>Copy ${usdAmount}</span>
                                </button>
                              </div>
                            </div>

                            {/* Binance Pay UID / Wallet Box */}
                            <div className="p-3.5 rounded-2xl bg-black/60 backdrop-blur-md border border-yellow-500/40 mb-4 shadow-inner">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-bold text-yellow-300 uppercase tracking-wider flex items-center gap-1.5">
                                  <i className="fas fa-wallet text-yellow-400"></i>
                                  <span>Binance Pay ID / UID (‡¶¨‡¶æ ‡¶ì‡ßü‡¶æ‡¶≤‡ßá‡¶ü ‡¶è‡¶°‡ßç‡¶∞‡ßá‡¶∏):</span>
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">Binance Pay</span>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-1">
                                <span className="font-mono font-black text-base sm:text-lg text-yellow-300 tracking-widest select-all">
                                  {activeCfg.number}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyNumber(activeCfg.number)}
                                  className="px-3.5 py-1.5 rounded-xl bg-[#f0b90b] hover:bg-yellow-400 text-slate-950 font-black text-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm"
                                >
                                  <i className="fas fa-copy text-slate-900"></i>
                                  <span>Copy UID</span>
                                </button>
                              </div>
                            </div>

                            {/* 5-Step Binance Guidelines */}
                            <div className="space-y-2.5 text-xs sm:text-sm font-semibold text-slate-200 leading-relaxed bg-black/40 p-3.5 rounded-2xl border border-yellow-500/20 mb-4">
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-[#f0b90b] text-slate-950 font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ßß
                                </span>
                                <span>
                                  Binance App ‡¶ì‡¶™‡ßá‡¶® ‡¶ï‡¶∞‡ßá <strong>Pay</strong> ‡¶Ö‡¶•‡¶¨‡¶æ <strong>Send</strong> ‡¶Ö‡¶™‡¶∂‡¶®‡ßá ‡¶Ø‡¶æ‡¶® (‡¶¨‡¶æ Trust Wallet)
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-[#f0b90b] text-slate-950 font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ß®
                                </span>
                                <span>
                                  <strong>Pay ID / Binance UID</strong> ‡¶Ö‡¶•‡¶¨‡¶æ USDT ‡¶®‡ßá‡¶ü‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶ï ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-[#f0b90b] text-slate-950 font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ß©
                                </span>
                                <span>
                                  Payee ID ‡¶π‡¶ø‡¶∏‡ßá‡¶¨‡ßá <strong>{activeCfg.number}</strong> ‡¶¶‡¶ø‡¶®
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-[#f0b90b] text-slate-950 font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ß™
                                </span>
                                <span>
                                  ‡¶∏‡¶†‡¶ø‡¶ï ‡¶™‡¶∞‡¶ø‡¶Æ‡¶æ‡¶£ <strong>${usdAmount} USD</strong> ‡¶™‡¶æ‡¶†‡¶ø‡ßü‡ßá ‡¶≤‡ßá‡¶®‡¶¶‡ßá‡¶® ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§ ‡¶ï‡¶∞‡ßÅ‡¶®
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-[#f0b90b] text-slate-950 font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ‡ß´
                                </span>
                                <span>
                                  ‡¶≤‡ßá‡¶®‡¶¶‡ßá‡¶®‡ßá‡¶∞ <strong>Order ID / TxID / Transaction Hash</strong> ‡¶®‡¶ø‡¶ö‡ßá‡¶∞ ‡¶¨‡¶ï‡ßç‡¶∏‡ßá ‡¶¶‡¶ø‡¶®
                                </span>
                              </div>
                            </div>

                            {/* Transaction ID Input */}
                            <div className="mb-4">
                              <label className="block text-xs font-black text-yellow-300 mb-1.5 flex items-center justify-between">
                                <span>Binance Order ID / TxID / Hash ‡¶¶‡¶ø‡¶®:</span>
                                <span className="text-[10px] text-slate-400 font-mono">Example: 3948201948</span>
                              </label>
                              <input
                                type="text"
                                className="w-full bg-slate-950 text-yellow-300 font-black font-mono text-sm sm:text-base px-4 py-3.5 rounded-xl border-2 border-yellow-500/60 focus:border-yellow-300 focus:outline-none focus:ring-4 focus:ring-yellow-400/20 uppercase placeholder:text-slate-500 shadow-lg text-center tracking-widest"
                                placeholder="Binance Order ID / Hash ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶®"
                                value={depositTrxId}
                                onChange={(e) => {
                                  setDepositTrxId(e.target.value);
                                  setDepTrxErr('');
                                }}
                              />
                              {depTrxErr && (
                                <p className="text-xs font-bold text-yellow-300 mt-2 bg-black/80 px-3 py-1.5 rounded-lg text-center shadow border border-yellow-400/50">
                                  ‚ö†Ô∏è {depTrxErr}
                                </p>
                              )}
                            </div>

                            {/* Screenshot Upload */}
                            <div className="mb-5 p-3 rounded-2xl bg-black/40 backdrop-blur-md border border-yellow-500/30 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-yellow-200 flex items-center gap-1.5">
                                  <i className="fas fa-camera text-yellow-400"></i>
                                  <span>Binance ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡¶∂‡¶ü (‡¶ê‡¶ö‡ßç‡¶õ‡¶ø‡¶ï):</span>
                                </label>
                                {depositReceiptImage && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDepositReceiptImage('');
                                      setDepositReceiptFileName('');
                                      haptic('light');
                                    }}
                                    className="text-[10px] text-yellow-300 hover:text-white font-bold underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <i className="fas fa-times"></i> ‡¶õ‡¶¨‡¶ø ‡¶Æ‡ßÅ‡¶õ‡ßÅ‡¶®
                                  </button>
                                )}
                              </div>

                              {depositReceiptImage ? (
                                <div className="relative rounded-xl overflow-hidden border-2 border-yellow-400/60 bg-black/60 p-2 flex items-center gap-3">
                                  <img
                                    src={depositReceiptImage}
                                    alt="Binance Screenshot"
                                    className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg border border-white/20 cursor-pointer shadow-md"
                                    onClick={() => setSelectedScreenshotPreview(depositReceiptImage)}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                                      <i className="fas fa-check-circle"></i>
                                      <span>‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡¶∂‡¶ü ‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶π‡ßü‡ßá‡¶õ‡ßá!</span>
                                    </p>
                                    <p className="text-[10px] text-slate-300 truncate font-mono mt-0.5">
                                      {depositReceiptFileName || 'binance_receipt.png'}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <label className="relative flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-yellow-400/40 hover:border-yellow-300 bg-white/5 hover:bg-white/10 cursor-pointer transition text-center group">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleDepositReceiptUpload}
                                  />
                                  <span className="text-xs font-bold text-yellow-300 flex items-center gap-1.5">
                                    <i className="fas fa-cloud-upload-alt text-yellow-400"></i>
                                    <span>Binance ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡¶∂‡¶ü ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®</span>
                                  </span>
                                  <span className="text-[10px] text-slate-400 mt-0.5">
                                    JPG, PNG (‡¶∏‡¶∞‡ßç‡¶¨‡ßã‡¶ö‡ßç‡¶ö ‡ßÆMB)
                                  </span>
                                </label>
                              )}
                            </div>

                            {/* Verify Button */}
                            <button
                              type="button"
                              onClick={handleSubmitDeposit}
                              disabled={depositSubmitting}
                              className="w-full py-4 rounded-2xl bg-[#f0b90b] hover:bg-yellow-400 text-slate-950 font-black text-base sm:text-lg tracking-wider uppercase shadow-[0_0_25px_rgba(240,185,11,0.4)] transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer border-2 border-yellow-300"
                            >
                              {depositSubmitting ? (
                                <span className="loading-spinner"></span>
                              ) : (
                                <>
                                  <span>VERIFY BINANCE PAYMENT</span>
                                  <i className="fas fa-check-circle text-slate-950 text-lg"></i>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      }

                      // 6. BANK TRANSFER / OTHER CUSTOM METHODS DEDICATED GATEWAY CARD
                      return (
                        <div className="rounded-3xl p-5 sm:p-7 text-white shadow-2xl transition-all duration-300 relative overflow-hidden border border-emerald-400/40 bg-gradient-to-br from-[#064e3b] via-[#0f766e] to-[#022c22]">
                          {/* Decorative ambient elements */}
                          <div className="absolute top-0 right-0 w-56 h-56 bg-emerald-400/15 rounded-full blur-3xl pointer-events-none"></div>

                          {/* Bank Header Badge */}
                          <div className="flex items-center justify-between pb-4 mb-4 border-b border-emerald-300/30">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-white p-1.5 shadow-lg flex items-center justify-center">
                                {renderMethodLogo(activeCfg, 'w-9 h-9')}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-black text-lg text-white tracking-wide">
                                    {activeCfg.label || selectedMethod} ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶ó‡ßá‡¶ü‡¶ì‡¶Ø‡¶º‡ßá
                                  </h3>
                                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/20 text-emerald-200 font-extrabold border border-white/30">
                                    Bank / Custom
                                  </span>
                                </div>
                                <p className="text-[11px] text-emerald-100 font-medium mt-0.5">
                                  ‡¶®‡¶ø‡¶ö‡ßá‡¶∞ ‡¶è‡¶ï‡¶æ‡¶â‡¶®‡ßç‡¶ü‡ßá ‡¶ü‡¶æ‡¶ï‡¶æ ‡¶™‡¶æ‡¶†‡¶ø‡ßü‡ßá ‡¶ü‡ßç‡¶∞‡¶æ‡¶®‡¶ú‡ßá‡¶ï‡¶∂‡¶® ‡¶Ü‡¶á‡¶°‡¶ø ‡¶¶‡¶ø‡¶®
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Recipient Number / Account Box */}
                          <div className="p-3.5 rounded-2xl bg-black/40 backdrop-blur-md border border-emerald-300/40 mb-4 shadow-inner">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider flex items-center gap-1.5">
                                <i className="fas fa-university text-amber-300"></i>
                                <span>‡¶¨‡ßç‡¶Ø‡¶æ‡¶Ç‡¶ï ‡¶è‡¶ï‡¶æ‡¶â‡¶®‡ßç‡¶ü ‡¶®‡¶Æ‡ßç‡¶¨‡¶∞:</span>
                              </span>
                              <span className="text-[10px] text-emerald-200 font-mono">Account / Wallet</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-1">
                              <span className="font-mono font-black text-base sm:text-lg text-amber-300 tracking-widest select-all">
                                {activeCfg.number}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyNumber(activeCfg.number)}
                                className="px-3.5 py-1.5 rounded-xl bg-emerald-600/40 hover:bg-emerald-600/60 text-white border border-emerald-300/50 font-black text-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm"
                              >
                                <i className="fas fa-copy text-amber-300"></i>
                                <span>Copy Details</span>
                              </button>
                            </div>
                          </div>

                          {/* Instructions */}
                          <div className="space-y-2.5 text-xs sm:text-sm font-semibold text-white/95 leading-relaxed bg-black/25 p-3.5 rounded-2xl border border-emerald-400/20 mb-4">
                            <div className="flex items-start gap-2.5">
                              <span className="w-5 h-5 rounded-full bg-white text-emerald-800 font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                ‡ßß
                              </span>
                              <span>
                                ‡¶Ü‡¶™‡¶®‡¶æ‡¶∞ ‡¶¨‡ßç‡¶Ø‡¶æ‡¶Ç‡¶ï ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶™ ‡¶Ö‡¶•‡¶¨‡¶æ ‡¶∂‡¶æ‡¶ñ‡¶æ ‡¶•‡ßá‡¶ï‡ßá ‡¶ü‡¶æ‡¶ï‡¶æ ‡¶™‡¶æ‡¶†‡¶æ‡¶®
                              </span>
                            </div>
                            <div className="flex items-start gap-2.5">
                              <span className="w-5 h-5 rounded-full bg-white text-emerald-800 font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                ‡ß®
                              </span>
                              <span>
                                ‡¶™‡ßç‡¶∞‡¶æ‡¶™‡¶ï ‡¶π‡¶ø‡¶∏‡ßá‡¶¨‡ßá <strong>{activeCfg.number}</strong> ‡¶®‡¶Æ‡ßç‡¶¨‡¶∞‡ßá <strong>‡ß≥ {amountNum}</strong> ‡¶™‡¶æ‡¶†‡¶æ‡¶®
                              </span>
                            </div>
                            <div className="flex items-start gap-2.5">
                              <span className="w-5 h-5 rounded-full bg-white text-emerald-800 font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                ‡ß©
                              </span>
                              <span>
                                ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶® ‡¶ï‡¶∞‡ßá ‡¶¨‡ßç‡¶Ø‡¶æ‡¶Ç‡¶ï <strong>Reference No / Transaction ID</strong> ‡¶®‡¶ø‡¶ö‡ßá‡¶∞ ‡¶¨‡¶ï‡ßç‡¶∏‡ßá ‡¶¶‡¶ø‡¶®
                              </span>
                            </div>
                          </div>

                          {/* Transaction ID Input */}
                          <div className="mb-4">
                            <label className="block text-xs font-black text-white mb-1.5 flex items-center justify-between">
                              <span>‡¶ü‡ßç‡¶∞‡¶æ‡¶®‡¶ú‡ßá‡¶ï‡¶∂‡¶® ‡¶Ü‡¶á‡¶°‡¶ø / ‡¶∞‡ßá‡¶´‡¶æ‡¶∞‡ßá‡¶®‡ßç‡¶∏ ‡¶®‡¶Æ‡ßç‡¶¨‡¶∞ ‡¶¶‡¶ø‡¶®:</span>
                              <span className="text-[10px] text-emerald-200 font-mono">Reference ID</span>
                            </label>
                            <input
                              type="text"
                              className="w-full bg-white text-slate-950 font-black font-mono text-sm sm:text-base px-4 py-3.5 rounded-xl border-2 border-white/60 focus:border-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-300/30 uppercase placeholder:text-slate-400 shadow-lg text-center tracking-widest"
                              placeholder="Transaction / Ref ID ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶®"
                              value={depositTrxId}
                              onChange={(e) => {
                                setDepositTrxId(e.target.value);
                                setDepTrxErr('');
                              }}
                            />
                            {depTrxErr && (
                              <p className="text-xs font-bold text-yellow-200 mt-2 bg-black/60 px-3 py-1.5 rounded-lg text-center shadow border border-yellow-400/40">
                                ‚ö†Ô∏è {depTrxErr}
                              </p>
                            )}
                          </div>

                          {/* Screenshot Upload */}
                          <div className="mb-5 p-3 rounded-2xl bg-black/35 backdrop-blur-md border border-emerald-300/30 space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                                <i className="fas fa-camera text-yellow-300"></i>
                                <span>‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶∏‡ßç‡¶≤‡¶ø‡¶™ ‡¶¨‡¶æ ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡¶∂‡¶ü (‡¶ê‡¶ö‡ßç‡¶õ‡¶ø‡¶ï):</span>
                              </label>
                              {depositReceiptImage && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDepositReceiptImage('');
                                    setDepositReceiptFileName('');
                                    haptic('light');
                                  }}
                                  className="text-[10px] text-emerald-200 hover:text-white font-bold underline flex items-center gap-1 cursor-pointer"
                                >
                                  <i className="fas fa-times"></i> ‡¶õ‡¶¨‡¶ø ‡¶Æ‡ßÅ‡¶õ‡ßÅ‡¶®
                                </button>
                              )}
                            </div>

                            {depositReceiptImage ? (
                              <div className="relative rounded-xl overflow-hidden border-2 border-emerald-300/60 bg-black/60 p-2 flex items-center gap-3">
                                <img
                                  src={depositReceiptImage}
                                  alt="Bank Screenshot"
                                  className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg border border-white/20 cursor-pointer shadow-md"
                                  onClick={() => setSelectedScreenshotPreview(depositReceiptImage)}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                                    <i className="fas fa-check-circle"></i>
                                    <span>‡¶∞‡¶∏‡¶ø‡¶¶‡ßá‡¶∞ ‡¶õ‡¶¨‡¶ø ‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶π‡ßü‡ßá‡¶õ‡ßá!</span>
                                  </p>
                                  <p className="text-[10px] text-slate-300 truncate font-mono mt-0.5">
                                    {depositReceiptFileName || 'bank_slip.png'}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <label className="relative flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-emerald-300/40 hover:border-white bg-white/5 hover:bg-white/10 cursor-pointer transition text-center group">
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={handleDepositReceiptUpload}
                                />
                                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                  <i className="fas fa-cloud-upload-alt text-amber-300"></i>
                                  <span>‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶∏‡ßç‡¶≤‡¶ø‡¶™‡ßá‡¶∞ ‡¶õ‡¶¨‡¶ø ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®</span>
                                </span>
                                <span className="text-[10px] text-emerald-200/80 mt-0.5">
                                  JPG, PNG (‡¶∏‡¶∞‡ßç‡¶¨‡ßã‡¶ö‡ßç‡¶ö ‡ßÆMB)
                                </span>
                              </label>
                            )}
                          </div>

                          {/* Verify Button */}
                          <button
                            type="button"
                            onClick={handleSubmitDeposit}
                            disabled={depositSubmitting}
                            className="w-full py-4 rounded-2xl bg-white hover:bg-emerald-50 text-[#064e3b] font-black text-base sm:text-lg tracking-wider uppercase shadow-2xl transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer border-2 border-white/80"
                          >
                            {depositSubmitting ? (
                              <span className="loading-spinner"></span>
                            ) : (
                              <>
                                <span>‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶≠‡ßá‡¶∞‡¶ø‡¶´‡¶æ‡¶á ‡¶ï‡¶∞‡ßÅ‡¶® (VERIFY PAYMENT)</span>
                                <i className="fas fa-check-circle text-emerald-600 text-lg"></i>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })()}

                    {/* GATEWAY FOOTER */}
                    <div className="text-center py-2 text-[11px] text-slate-400 flex items-center justify-center gap-4">
                      <span className="flex items-center gap-1">
                        <i className="fas fa-lock text-emerald-400"></i> ‡¶®‡¶ø‡¶∞‡¶æ‡¶™‡¶¶ ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü
                      </span>
                      <span>‚Ä¢</span>
                      <span className="flex items-center gap-1">
                        <i className="fas fa-bolt text-amber-400"></i> ‡¶¶‡ßç‡¶∞‡ßÅ‡¶§ ‡¶≠‡ßá‡¶∞‡¶ø‡¶´‡¶ø‡¶ï‡ßá‡¶∂‡¶®
                      </span>
                      <span>‚Ä¢</span>
                      <a
                        href="https://t.me/RF2_SMM"
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:underline flex items-center gap-1 font-bold"
                      >
                        <i className="fab fa-telegram"></i> ‡¶π‡ßá‡¶≤‡ßç‡¶™‡¶≤‡¶æ‡¶á‡¶®
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Deposit History */}
              <div className="mt-6">
                <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <i className="fas fa-history text-blue-400"></i>
                  <span>Recent Deposit Requests (‡¶Ü‡¶™‡¶®‡¶æ‡¶∞ ‡¶∏‡¶æ‡¶Æ‡ßç‡¶™‡ßç‡¶∞‡¶§‡¶ø‡¶ï ‡¶∞‡¶ø‡¶ï‡ßã‡¶Ø‡¶º‡ßá‡¶∏‡ßç‡¶ü)</span>
                </h3>

                {depositHistory.length === 0 ? (
                  <div className="glass-card p-4 text-center">
                    <p className="text-[11px] text-slate-500 font-medium">
                      ‡¶è‡¶ñ‡¶®‡ßã ‡¶ï‡ßã‡¶®‡ßã ‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶∞‡¶ø‡¶ï‡ßã‡¶Ø‡¶º‡ßá‡¶∏‡ßç‡¶ü ‡¶®‡ßá‡¶á
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {depositHistory.map((dep) => (
                      <div key={dep.id} className="deposit-history-card">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[9px] text-slate-400 font-mono">
                            {dep.timestamp
                              ? new Date(dep.timestamp.seconds * 1000).toLocaleString('en-BD', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : 'Just now'}
                          </span>
                          <span
                            className={`text-[8px] font-bold px-2 py-0.5 rounded-md ${
                              dep.status === 'Approved'
                                ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/25'
                                : dep.status === 'Rejected'
                                ? 'text-red-400 bg-red-500/15 border border-red-500/25'
                                : 'text-amber-400 bg-amber-500/15 border border-amber-500/25'
                            }`}
                          >
                            {dep.status}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-slate-300 font-bold uppercase flex items-center gap-1">
                            <span>{dep.method}</span>
                            <span className="text-slate-500">‚Ä¢</span>
                            <span className="font-mono text-amber-300">{dep.trxId}</span>
                          </span>
                          <span className="font-black text-base text-white">
                            ‡ß≥ {dep.amount}
                          </span>
                        </div>
                        {dep.screenshotUrl && (
                          <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <i className="fas fa-image text-amber-400"></i>
                              <span>‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡¶∂‡¶ü ‡¶∏‡¶Ç‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶Ü‡¶õ‡ßá</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedScreenshotPreview(dep.screenshotUrl!)}
                              className="text-[10px] font-bold text-amber-300 hover:text-amber-200 underline flex items-center gap-1 cursor-pointer"
                            >
                              <i className="fas fa-eye text-[9px]"></i>
                              <span>‡¶õ‡¶¨‡¶ø ‡¶¶‡ßá‡¶ñ‡ßÅ‡¶®</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <section className="px-4 sm:px-6 mt-4 pb-20 animate-fade-in space-y-5">
              {/* Profile Card Header */}
              <div className="glass-card p-6 border border-amber-500/30 bg-gradient-to-br from-slate-900/90 via-[#0b1329] to-slate-900 relative overflow-hidden shadow-[0_0_40px_rgba(245,158,11,0.15)] text-center rounded-3xl">
                {/* Background Decorative Glow */}
                <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-36 h-36 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

                {/* Profile Avatar with Upload Camera Badge */}
                <div className="relative w-28 h-28 mx-auto mb-3 group">
                  <div className="w-28 h-28 rounded-3xl overflow-hidden border-2 border-amber-400/60 shadow-2xl bg-slate-950 flex items-center justify-center relative ring-4 ring-amber-500/10">
                    {userPhotoURL || currentUser?.photoURL ? (
                      <img
                        src={userPhotoURL || currentUser?.photoURL}
                        alt="Profile"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                          currentUser?.name || 'User'
                        )}&background=3b82f6&color=fff&bold=true&size=200`}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    )}

                    {profileSubmitting && (
                      <div className="absolute inset-0 bg-black/75 flex items-center justify-center backdrop-blur-xs">
                        <span className="loading-spinner"></span>
                      </div>
                    )}
                  </div>

                  {/* Upload Camera Icon Button */}
                  <label
                    className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black flex items-center justify-center shadow-xl cursor-pointer border-2 border-[#030712] transition active:scale-95 group/btn"
                    title="Change Profile Picture (‡¶õ‡¶¨‡¶ø ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®)"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePicUpload}
                      className="hidden"
                      disabled={profileSubmitting}
                    />
                    <i className="fas fa-camera text-sm"></i>
                  </label>

                  {/* Remove Photo option if custom photo exists */}
                  {(userPhotoURL || currentUser?.photoURL) && (
                    <button
                      onClick={handleRemoveProfilePic}
                      disabled={profileSubmitting}
                      className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-600/90 text-white flex items-center justify-center text-xs shadow-md hover:scale-110 transition border border-white/20"
                      title="Remove Photo"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  )}
                </div>

                {/* User Name & Name Edit Form */}
                {isEditingName ? (
                  <div className="flex items-center justify-center gap-2 max-w-xs mx-auto mt-2">
                    <input
                      type="text"
                      className="input-modern py-1.5 px-3 text-xs text-center font-bold"
                      value={editUserName}
                      onChange={(e) => setEditUserName(e.target.value)}
                      placeholder="Enter full name"
                    />
                    <button
                      onClick={handleUpdateUserName}
                      disabled={profileSubmitting}
                      className="px-3 py-1.5 bg-emerald-500 text-black text-xs font-black rounded-xl hover:bg-emerald-400 transition shadow"
                    >
                      {profileSubmitting ? '...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setIsEditingName(false)}
                      className="px-2 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <h2 className="text-xl font-black text-white">{currentUser?.name || 'User'}</h2>
                    <button
                      onClick={() => {
                        setEditUserName(currentUser?.name || '');
                        setIsEditingName(true);
                      }}
                      className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-amber-400 flex items-center justify-center text-xs transition border border-white/5"
                      title="Edit Display Name (‡¶®‡¶æ‡¶Æ ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶®)"
                    >
                      <i className="fas fa-pen"></i>
                    </button>
                  </div>
                )}

                {/* User Meta Badges & Username Edit */}
                <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                  {isEditingUsername ? (
                    <div className="w-full max-w-xs mx-auto mt-2 p-3 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-amber-300 font-bold">
                        <span>Change Username (‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶®‡¶æ‡¶Æ ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶®)</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">@</span>
                        <input
                          type="text"
                          className="auth-input py-1 pl-7 text-xs font-mono lowercase"
                          placeholder="new_username"
                          value={editUserUsername}
                          onChange={(e) => setEditUserUsername(e.target.value)}
                        />
                      </div>
                      {editUserUsernameErr && (
                        <p className="text-[10px] text-red-400 font-semibold">{editUserUsernameErr}</p>
                      )}
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingUsername(false);
                            setEditUserUsernameErr('');
                          }}
                          className="px-2.5 py-1 bg-slate-800 text-slate-300 text-[11px] font-bold rounded-lg hover:bg-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleUpdateUserUsername}
                          disabled={profileSubmitting}
                          className="px-3 py-1 bg-amber-500 text-black text-[11px] font-black rounded-lg hover:bg-amber-400 transition"
                        >
                          {profileSubmitting ? 'Saving...' : 'Update Username'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold text-slate-300 bg-white/5 px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
                        <i className="fas fa-at text-amber-400"></i>
                        <span>{currentUser?.username || currentUser?.uid.slice(0, 8)}</span>
                      </span>
                      <button
                        onClick={() => {
                          setEditUserUsername(currentUser?.username || '');
                          setEditUserUsernameErr('');
                          setIsEditingUsername(true);
                        }}
                        className="w-6 h-6 rounded-md bg-white/5 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 flex items-center justify-center text-[10px] transition border border-white/5"
                        title="Change Username (‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶®‡¶æ‡¶Æ ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®)"
                      >
                        <i className="fas fa-pen"></i>
                      </button>
                    </div>
                  )}

                  <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
                    <i className="fas fa-shield-check text-emerald-400"></i>
                    <span>VERIFIED USER</span>
                  </span>
                </div>
              </div>

              {/* Account Details & Stats */}
              <div className="glass-card p-4 space-y-3">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-id-card text-amber-400"></i>
                    <span>Account Details (‡¶è‡¶ï‡¶æ‡¶â‡¶®‡ßç‡¶ü ‡¶§‡¶•‡ßç‡¶Ø)</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">ACTIVE</span>
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-slate-400">User ID (UID):</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-amber-300 font-bold">{currentUser?.uid}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(currentUser?.uid || '');
                          showToast('UID Copied to clipboard', 'success');
                        }}
                        className="text-[10px] text-slate-400 hover:text-white bg-white/5 px-2 py-0.5 rounded transition"
                      >
                        <i className="fas fa-copy"></i>
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-slate-400">Username:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-white font-bold">@{currentUser?.username}</span>
                      <button
                        onClick={() => {
                          setEditUserUsername(currentUser?.username || '');
                          setEditUserUsernameErr('');
                          setIsEditingUsername(true);
                        }}
                        className="text-[10px] text-amber-400 hover:text-amber-300 underline"
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-slate-400">Full Name:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold">{currentUser?.name}</span>
                      <button
                        onClick={() => {
                          setEditUserName(currentUser?.name || '');
                          setIsEditingName(true);
                        }}
                        className="text-[10px] text-amber-400 hover:text-amber-300 underline"
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  {currentUser?.email && (
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-slate-400">Gmail / Email:</span>
                      <span className="font-mono text-slate-200 font-semibold">{currentUser.email}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-slate-400">Current Balance:</span>
                    <span className="font-mono text-emerald-400 font-extrabold text-sm">‡ß≥ {userBalance.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-400">Total Orders:</span>
                    <span className="font-mono text-blue-400 font-extrabold text-sm">{userTotalOrders}</span>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                  <button
                    onClick={() => {
                      setActiveTab('funds');
                      haptic('light');
                    }}
                    className="py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-extrabold flex items-center justify-center gap-1.5 transition border border-emerald-500/30 active:scale-95"
                  >
                    <i className="fas fa-plus-circle"></i> ADD FUNDS (‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü)
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('orders');
                      haptic('light');
                    }}
                    className="py-2 px-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[10px] font-extrabold flex items-center justify-center gap-1.5 transition border border-blue-500/30 active:scale-95"
                  >
                    <i className="fas fa-list"></i> MY ORDERS (‡¶Ö‡¶∞‡ßç‡¶°‡¶æ‡¶∞)
                  </button>
                </div>
              </div>

              {/* Security & Credentials Section */}
              <div className="glass-card p-4 space-y-3">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-shield-alt text-amber-400"></i>
                    <span>Security & Account Settings (‡¶∏‡¶ø‡¶ï‡¶ø‡¶â‡¶∞‡¶ø‡¶ü‡¶ø ‡¶ì ‡¶∏‡ßá‡¶ü‡¶ø‡¶Ç‡¶∏)</span>
                  </div>
                </h4>

                <div className="space-y-2">
                  {/* Change Password Button & Trigger */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xs">
                        <i className="fas fa-key"></i>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Password (‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶°)</p>
                        <p className="text-[10px] text-slate-400">‡¶Ü‡¶™‡¶®‡¶æ‡¶∞ ‡¶è‡¶ï‡¶æ‡¶â‡¶®‡ßç‡¶ü‡ßá‡¶∞ ‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶° ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowChangePassModal(true);
                        setChangePassErr('');
                        setChangePassSuccess('');
                        setCurrentPasswordInput('');
                        setNewPasswordInput('');
                        setConfirmNewPasswordInput('');
                        haptic('light');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-bold transition active:scale-95 flex items-center gap-1.5"
                    >
                      <i className="fas fa-lock text-[10px]"></i>
                      <span>‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶° ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶®</span>
                    </button>
                  </div>

                  {/* Change Username Button & Trigger */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xs">
                        <i className="fas fa-at"></i>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Username (‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶®‡¶æ‡¶Æ)</p>
                        <p className="text-[10px] text-slate-400">‡¶¨‡¶∞‡ßç‡¶§‡¶Æ‡¶æ‡¶®: @{currentUser?.username}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEditUserUsername(currentUser?.username || '');
                        setEditUserUsernameErr('');
                        setIsEditingUsername(true);
                        haptic('light');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 text-[11px] font-bold transition active:scale-95 flex items-center gap-1.5"
                    >
                      <i className="fas fa-pen text-[10px]"></i>
                      <span>‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶®‡¶æ‡¶Æ ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶®</span>
                    </button>
                  </div>
                </div>
              </div>

{/* Referral & 10% Deposit Bonus Card in Profile */}
              <div
                onClick={() => {
                  setShowReferralModal(true);
                  haptic('heavy');
                }}
                className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-600/15 to-slate-900 border border-amber-500/40 flex items-center justify-between cursor-pointer hover:border-amber-400 transition active:scale-95 shadow-[0_4px_20px_rgba(245,158,11,0.15)]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/30 text-amber-300 flex items-center justify-center text-lg border border-amber-500/40 shadow-inner">
                    <i className="fas fa-hand-holding-dollar"></i>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-xs text-white">‡¶∞‡ßá‡¶´‡¶æ‡¶∞‡ßá‡¶≤ ‡¶™‡ßç‡¶∞‡ßã‡¶ó‡ßç‡¶∞‡¶æ‡¶Æ ({referralConfig.bonusPercent || 10}% ‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶¨‡ßã‡¶®‡¶æ‡¶∏)</h4>
                      <span className="bg-emerald-500 text-black font-black text-[9px] px-1.5 py-0.2 rounded font-mono">
                        +{referralConfig.bonusPercent || 10}%
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-200/80 mt-0.5">
                      ‡¶Æ‡ßã‡¶ü ‡¶∞‡ßá‡¶´‡¶æ‡¶∞: <strong className="text-white">{userTotalReferrals} ‡¶ú‡¶®</strong> ‚Ä¢ ‡¶Ö‡¶∞‡ßç‡¶ú‡¶ø‡¶§ ‡¶¨‡ßã‡¶®‡¶æ‡¶∏: <strong className="text-emerald-400 font-mono">‡ß≥{userReferralEarnings.toFixed(2)}</strong>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-black bg-amber-500/10 px-2.5 py-1.5 rounded-xl border border-amber-500/30">
                  <span>‡¶°‡ßç‡¶Ø‡¶æ‡¶∂‡¶¨‡ßã‡¶∞‡ßç‡¶°</span>
                  <i className="fas fa-arrow-right text-[9px]"></i>
                </div>
              </div>

              {/* Earn Free Rewards Banner */}
              <div
                onClick={() => {
                  setShowTasksModal(true);
                  haptic('heavy');
                }}
                className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-transparent border border-amber-500/30 flex items-center justify-between cursor-pointer hover:border-amber-400 transition active:scale-95"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/30 text-amber-400 flex items-center justify-center text-lg border border-amber-500/40">
                    <i className="fas fa-gift"></i>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-white">Daily Tasks & Screenshot Rewards</h4>
                    <p className="text-[10px] text-amber-200/80">‡¶ü‡¶æ‡¶∏‡ßç‡¶ï ‡¶ï‡¶Æ‡¶™‡ßç‡¶≤‡¶ø‡¶ü ‡¶ï‡¶∞‡ßá ‡¶´‡ßç‡¶∞‡¶ø‡¶§‡ßá ‡¶ü‡¶æ‡¶ï‡¶æ ‡¶á‡¶®‡¶ï‡¶æ‡¶Æ ‡¶ï‡¶∞‡ßÅ‡¶®</p>
                  </div>
                </div>
                <i className="fas fa-chevron-right text-amber-400 text-xs"></i>
              </div>


              {/* Support & Community Section */}
              <div className="glass-card p-4 space-y-3">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
                  <i className="fas fa-headset text-amber-400"></i>
                  <span>Help & Support Center (‡¶∏‡¶æ‡¶™‡ßã‡¶∞‡ßç‡¶ü ‡¶ì ‡¶∏‡ßã‡¶∂‡ßç‡¶Ø‡¶æ‡¶≤ ‡¶≤‡¶ø‡¶ô‡ßç‡¶ï)</span>
                </h4>

                {/* Live AI Support Card in Profile */}
                {welcomeConfig.aiSupportEnabled !== false && (
                  <div
                    onClick={() => {
                      setShowAISupportModal(true);
                      haptic('heavy');
                    }}
                    className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-600/10 to-blue-900/30 border border-amber-500/40 hover:border-amber-400 flex items-center justify-between cursor-pointer transition active:scale-95 shadow-[0_4px_15px_rgba(245,158,11,0.1)]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/30 text-amber-300 flex items-center justify-center text-lg border border-amber-500/40">
                        <i className="fas fa-robot"></i>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h5 className="font-extrabold text-xs text-white">‡ß®‡ß™/‡ß≠ ‡¶≤‡¶æ‡¶á‡¶≠ AI ‡¶∏‡¶æ‡¶™‡ßã‡¶∞‡ßç‡¶ü</h5>
                          <span className="bg-emerald-500 text-black text-[9px] font-bold px-1.5 py-0.2 rounded font-mono">
                            INSTANT
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-300 mt-0.5">‡¶Ø‡ßá‡¶ï‡ßã‡¶®‡ßã ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®, ‡¶≠‡ßü‡ßá‡¶∏‡ßá ‡¶∂‡ßÅ‡¶®‡ßÅ‡¶® ‡¶¨‡¶æ ‡¶ü‡¶æ‡¶á‡¶™ ‡¶ï‡¶∞‡ßÅ‡¶®</p>
                      </div>
                    </div>
                    <button className="px-3 py-1.5 rounded-xl bg-amber-500 text-black font-extrabold text-xs shadow hover:bg-amber-400 transition">
                      ‡¶ö‡ßç‡¶Ø‡¶æ‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <a
                    href="https://t.me/RF2_SMM"
                    target="_blank"
                    rel="noreferrer"
                    className="p-3.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 flex items-center gap-3 transition active:scale-95"
                  >
                    <div className="w-9 h-9 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center text-lg">
                      <i className="fab fa-telegram-plane"></i>
                    </div>
                    <div>
                      <h5 className="font-extrabold text-xs text-white">Telegram</h5>
                      <p className="text-[9px] text-sky-300">Admin Chat</p>
                    </div>
                  </a>

                  <a
                    href="https://wa.me/8801342163841"
                    target="_blank"
                    rel="noreferrer"
                    className="p-3.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 flex items-center gap-3 transition active:scale-95"
                  >
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg">
                      <i className="fab fa-whatsapp"></i>
                    </div>
                    <div>
                      <h5 className="font-extrabold text-xs text-white">WhatsApp</h5>
                      <p className="text-[9px] text-emerald-300">24/7 Available</p>
                    </div>
                  </a>
                </div>

                <div className="pt-2 border-t border-white/5 space-y-2">
                  <div
                    onClick={() => {
                      navigator.clipboard.writeText('https://t.me/RF2_SMM');
                      showToast('Telegram Link Copied', 'success');
                    }}
                    className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/5 flex items-center justify-between cursor-pointer transition text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <i className="fab fa-telegram text-sky-400"></i>
                      <span className="font-semibold text-white">Official Telegram Group</span>
                    </div>
                    <i className="fas fa-copy text-slate-500 text-[10px]"></i>
                  </div>

                  <div
                    onClick={() => {
                      navigator.clipboard.writeText('https://www.facebook.com/share/1EKKUHMxCw/');
                      showToast('Facebook Link Copied', 'success');
                    }}
                    className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/5 flex items-center justify-between cursor-pointer transition text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <i className="fab fa-facebook text-blue-500"></i>
                      <span className="font-semibold text-white">Facebook Official Page</span>
                    </div>
                    <i className="fas fa-copy text-slate-500 text-[10px]"></i>
                  </div>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="w-full py-3 rounded-2xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95"
              >
                <i className="fas fa-right-from-bracket"></i>
                <span>LOGOUT FROM ACCOUNT (‡¶≤‡¶ó‡¶Ü‡¶â‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®)</span>
              </button>
            </section>
          )}

          {/* ADMIN TAB */}
          {activeTab === 'admin' && isAdminUser && (
            <section className="px-4 sm:px-6 mt-4 pb-20 animate-fade-in">
              {/* Top Banner */}
              <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.2)] mb-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-lg shadow-lg">
                      <i className="fas fa-crown"></i>
                    </div>
                    <div>
                      <h2 className="text-base font-black text-white flex items-center gap-2">
                        <span>SMM Panel Admin Dashboard</span>
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-bold">
                          FULL CONTROL
                        </span>
                      </h2>
                      <p className="text-[10px] text-slate-400">Manage users, deposits, orders, services & settings</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportBackup}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-white/10 flex items-center gap-1.5 transition active:scale-95"
                    >
                      <i className="fas fa-download text-amber-400"></i>
                      <span>Backup JSON</span>
                    </button>
                  </div>
                </div>

                {/* Stat Counters Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-white/10">
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Total Users</span>
                    <div className="text-lg font-black text-white mt-0.5">{allUsersList.length}</div>
                  </div>
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Total Orders</span>
                    <div className="text-lg font-black text-blue-400 mt-0.5">{allAdminOrdersList.length}</div>
                  </div>
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                    <span className="text-[9px] font-bold text-amber-400/80 uppercase">Pending Deposits</span>
                    <div className="text-lg font-black text-amber-400 mt-0.5">
                      {allDepositRequests.filter((d) => d.status === 'Pending').length}
                    </div>
                  </div>
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                    <span className="text-[9px] font-bold text-emerald-400/80 uppercase">Services Active</span>
                    <div className="text-lg font-black text-emerald-400 mt-0.5">{allServices.length}</div>
                  </div>
                </div>
              </div>

              {/* Sub Navigation Bar */}
              <div className="flex overflow-x-auto gap-2 p-1.5 bg-slate-900/90 rounded-2xl border border-white/10 mb-5 scrollbar-none">
                {[
                  { id: 'users', label: 'Users & Balance', icon: 'fas fa-users' },
                  { id: 'referrals', label: 'Referral 5% Bonus (‡¶∞‡ßá‡¶´‡¶æ‡¶∞‡ßá‡¶≤)', icon: 'fas fa-gift' },
                  { id: 'payment', label: 'Payment Numbers', icon: 'fas fa-mobile-alt' },
                  { id: 'deposits', label: 'Deposit Requests', icon: 'fas fa-wallet' },
                  { id: 'orders', label: 'Orders Control', icon: 'fas fa-list-check' },
                  { id: 'services', label: 'Services (API)', icon: 'fas fa-server' },
                  { id: 'telegram', label: 'Telegram Notifications (‡¶ü‡ßá‡¶≤‡¶ø‡¶ó‡ßç‡¶∞‡¶æ‡¶Æ ‡¶ö‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤)', icon: 'fab fa-telegram-plane' },
                  { id: 'welcome', label: '3D ‡¶≠‡¶Ø‡¶º‡ßá‡¶∏ ‡¶ì ‡¶Æ‡ßá‡¶∏‡ßá‡¶ú', icon: 'fas fa-volume-up' },
                  { id: 'notifications', label: 'Broadcast', icon: 'fas fa-bullhorn' },
                  { id: 'links', label: 'Support Links', icon: 'fas fa-link' },
                  { id: 'settings', label: 'Site Logo & Settings (‡¶≤‡ßã‡¶ó‡ßã ‡¶ì ‡¶∏‡ßá‡¶ü‡¶ø‡¶Ç‡¶∏)', icon: 'fas fa-cog' },
                  { id: 'support', label: 'Live AI & Chat Support (‡¶≤‡¶æ‡¶á‡¶≠ ‡¶á‡¶®‡¶¨‡¶ï‡ßç‡¶∏)', icon: 'fas fa-headset' },
                  { id: 'tasks', label: 'Tasks & Screenshots Proof (‡¶ü‡¶æ‡¶∏‡ßç‡¶ï ‡¶™‡ßç‡¶∞‡ßÅ‡¶´)', icon: 'fas fa-tasks' }
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => {
                      setAdminSubTab(st.id as any);
                      haptic('light');
                    }}
                    className={`whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      adminSubTab === st.id
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <i className={st.icon}></i>
                    <span>{st.label}</span>
                  </button>
                ))}
              </div>

              {/* SUB TAB 1: USERS & BALANCE (‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶è‡¶Æ‡¶æ‡¶â‡¶®‡ßç‡¶ü ‡¶¨‡¶æ‡ßú‡¶æ‡¶®‡ßã-‡¶ï‡¶Æ‡¶æ‡¶®‡ßã) */}
              {adminSubTab === 'users' && (
                <div className="space-y-4">
                  {/* Search bar */}
                  <div className="relative">
                    <input
                      type="text"
                      className="input-modern pl-10 text-xs"
                      placeholder="Search User by UID or Name..."
                      value={adminSearch}
                      onChange={(e) => setAdminSearch(e.target.value)}
                    />
                    <i className="fas fa-search absolute left-3.5 top-3.5 text-slate-500 text-xs"></i>
                  </div>

                  {/* Users Cards */}
                  <div className="space-y-3">
                    {allUsersList
                      .filter((u) => {
                        const q = adminSearch.toLowerCase().trim();
                        if (!q) return true;
                        return u.uid.toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q);
                      })
                      .map((u) => {
                        const currentVal = userBalanceAdjustInput[u.uid] || '';
                        const numVal = parseFloat(currentVal) || 0;

                        return (
                          <div
                            key={u.uid}
                            className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 space-y-3 shadow-lg"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm">
                                  <i className="fas fa-user"></i>
                                </div>
                                <div>
                                  <h4 className="font-extrabold text-sm text-white">{u.name || 'User'}</h4>
                                  <p className="text-[10px] text-slate-400 font-mono">UID: {u.uid}</p>
                                </div>
                              </div>

                              <div className="text-right">
                                <span className="text-[9px] text-slate-500 font-bold uppercase block">Current Balance</span>
                                <span className="text-base font-black text-emerald-400">‡ß≥ {(u.balance || 0).toFixed(2)}</span>
                              </div>
                            </div>

                            {/* Quick Balance Adjustment Row (‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶¨‡¶æ‡ßú‡¶æ‡¶®‡ßã / ‡¶ï‡¶Æ‡¶æ‡¶®‡ßã) */}
                            <div className="bg-black/30 p-3 rounded-xl border border-white/5 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold text-slate-300 flex items-center gap-1">
                                  <i className="fas fa-coins text-amber-400"></i>
                                  <span>Adjust Balance (‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶è‡¶Æ‡¶æ‡¶â‡¶®‡ßç‡¶ü ‡¶¨‡¶æ‡ßú‡¶æ‡¶® / ‡¶ï‡¶Æ‡¶æ‡¶®):</span>
                                </span>
                              </div>

                              {/* Quick buttons */}
                              <div className="flex flex-wrap gap-1.5">
                                {[50, 100, 500, 1000].map((amt) => (
                                  <button
                                    key={amt}
                                    onClick={() => handleAddUserBalance(u.uid, amt)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-extrabold text-[10px] border border-emerald-500/30 transition active:scale-95"
                                  >
                                    +‡ß≥{amt}
                                  </button>
                                ))}
                                {[50, 100, 500].map((amt) => (
                                  <button
                                    key={amt}
                                    onClick={() => handleSubtractUserBalance(u.uid, amt)}
                                    className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-extrabold text-[10px] border border-red-500/30 transition active:scale-95"
                                  >
                                    -‡ß≥{amt}
                                  </button>
                                ))}
                              </div>

                              {/* Custom input */}
                              <div className="flex items-center gap-2 pt-1">
                                <input
                                  type="number"
                                  className="input-modern text-xs py-1.5 px-3"
                                  placeholder="Enter custom amount..."
                                  value={currentVal}
                                  onChange={(e) =>
                                    setUserBalanceAdjustInput((prev) => ({
                                      ...prev,
                                      [u.uid]: e.target.value
                                    }))
                                  }
                                />
                                <button
                                  onClick={() => handleAddUserBalance(u.uid, numVal)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-xl transition active:scale-95 flex-shrink-0"
                                >
                                  ADD (+)
                                </button>
                                <button
                                  onClick={() => handleSubtractUserBalance(u.uid, numVal)}
                                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] rounded-xl transition active:scale-95 flex-shrink-0"
                                >
                                  SUB (-)
                                </button>
                                <button
                                  onClick={() => handleSetUserBalance(u.uid, numVal)}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] rounded-xl transition active:scale-95 flex-shrink-0"
                                >
                                  SET EXACT
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* SUB TAB: PAYMENT NUMBERS & CUSTOM LOGO / GATEWAY MANAGEMENT */}
              {adminSubTab === 'payment' && (
                <div className="space-y-4">
                  {/* Top Banner with Add Method Button */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900/50 via-indigo-900/40 to-slate-900/80 border border-blue-500/30 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <i className="fas fa-mobile-alt text-amber-400 text-base"></i>
                        <h3 className="font-extrabold text-sm text-white">‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶ó‡ßá‡¶ü‡¶ì‡¶Ø‡¶º‡ßá, ‡¶≤‡ßã‡¶ó‡ßã ‡¶ì ‡¶®‡¶Æ‡ßç‡¶¨‡¶∞ ‡¶ï‡¶®‡ßç‡¶ü‡ßç‡¶∞‡ßã‡¶≤</h3>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        ‡¶è‡¶ñ‡¶æ‡¶®‡ßá ‡¶¨‡¶ø‡¶ï‡¶æ‡¶∂, ‡¶®‡¶ó‡¶¶, ‡¶∞‡¶ï‡ßá‡¶ü‡ßá‡¶∞ ‡¶®‡¶Æ‡ßç‡¶¨‡¶∞, ‡¶°‡¶æ‡ßü‡¶æ‡¶≤ ‡¶ï‡ßã‡¶°, ‡¶≤‡ßã‡¶ó‡ßã ‡¶è‡¶¨‡¶Ç ‡¶®‡¶§‡ßÅ‡¶® ‡¶Ø‡ßá‡¶ï‡ßã‡¶®‡ßã ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶∏‡¶ø‡¶∏‡ßç‡¶ü‡ßá‡¶Æ ‡¶Ø‡ßã‡¶ó ‡¶¨‡¶æ ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶® ‡¶ï‡¶∞‡¶§‡ßá ‡¶™‡¶æ‡¶∞‡¶¨‡ßá‡¶®‡•§
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowAddMethodModal(true);
                        haptic('light');
                      }}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg transition active:scale-95 flex items-center justify-center gap-1.5 flex-shrink-0 cursor-pointer"
                    >
                      <i className="fas fa-plus-circle"></i>
                      <span>+ ‡¶®‡¶§‡ßÅ‡¶® ‡¶Æ‡ßá‡¶•‡¶° ‡¶Ø‡ßã‡¶ó ‡¶ï‡¶∞‡ßÅ‡¶®</span>
                    </button>
                  </div>

                  {/* ADD NEW PAYMENT METHOD MODAL */}
                  {showAddMethodModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                      <div className="bg-slate-900 border border-white/20 rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-3 border-b border-white/10">
                          <h3 className="font-black text-sm sm:text-base text-white flex items-center gap-2">
                            <i className="fas fa-wallet text-emerald-400"></i>
                            <span>‡¶®‡¶§‡ßÅ‡¶® ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶Æ‡ßá‡¶•‡¶° ‡¶Ø‡ßã‡¶ó ‡¶ï‡¶∞‡ßÅ‡¶®</span>
                          </h3>
                          <button
                            onClick={() => setShowAddMethodModal(false)}
                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white flex items-center justify-center text-xs transition"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>

                        <div className="space-y-3">
                          {/* Method Name */}
                          <div>
                            <label className="text-[11px] font-bold text-slate-300 block mb-1">
                              ‡¶Æ‡ßá‡¶•‡¶°‡ßá‡¶∞ ‡¶®‡¶æ‡¶Æ (Method Label, e.g. Upay Personal, Cellfin): *
                            </label>
                            <input
                              type="text"
                              className="input-modern text-xs py-2.5 px-3 font-bold"
                              placeholder="e.g. Upay, Rocket, Bank Transfer"
                              value={newMethodLabel}
                              onChange={(e) => setNewMethodLabel(e.target.value)}
                            />
                          </div>

                          {/* Account/Phone Number */}
                          <div>
                            <label className="text-[11px] font-bold text-slate-300 block mb-1">
                              ‡¶´‡ßã‡¶® ‡¶®‡¶Æ‡ßç‡¶¨‡¶∞ / ‡¶ì‡ßü‡¶æ‡¶≤‡ßá‡¶ü ‡¶è‡¶°‡ßç‡¶∞‡ßá‡¶∏ (Account / Phone Number): *
                            </label>
                            <input
                              type="text"
                              className="input-modern text-xs py-2.5 px-3 font-mono font-bold text-amber-300"
                              placeholder="e.g. 01840442809"
                              value={newMethodNumber}
                              onChange={(e) => setNewMethodNumber(e.target.value)}
                            />
                          </div>

                          {/* Method Type & USSD Grid */}
                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="text-[10px] font-bold text-slate-300 block mb-1">
                                ‡¶≤‡ßá‡¶®‡¶¶‡ßá‡¶®‡ßá‡¶∞ ‡¶ß‡¶∞‡¶® (Type):
                              </label>
                              <select
                                className="input-modern text-xs py-2 px-2 bg-slate-800 text-white font-bold"
                                value={newMethodType}
                                onChange={(e) => setNewMethodType(e.target.value as any)}
                              >
                                <option value="Send Money">Send Money (‡¶∏‡ßá‡¶®‡ßç‡¶° ‡¶Æ‡¶æ‡¶®‡¶ø)</option>
                                <option value="Cash Out">Cash Out (‡¶ï‡ßç‡¶Ø‡¶æ‡¶∂ ‡¶Ü‡¶â‡¶ü)</option>
                                <option value="Payment">Payment (‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü)</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-300 block mb-1">
                                ‡¶°‡¶æ‡ßü‡¶æ‡¶≤ ‡¶ï‡ßã‡¶° (USSD Code):
                              </label>
                              <input
                                type="text"
                                className="input-modern text-xs py-2 px-2 font-mono font-bold text-cyan-300"
                                placeholder="e.g. *247# or *167#"
                                value={newMethodUssd}
                                onChange={(e) => setNewMethodUssd(e.target.value)}
                              />
                            </div>
                          </div>

                          {/* Brand Theme Color */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-300 block mb-1.5">
                              ‡¶¨‡ßç‡¶Ø‡¶æ‡¶®‡ßç‡¶° ‡¶ï‡¶æ‡¶≤‡¶æ‡¶∞ (Brand Theme Color):
                            </label>
                            <div className="flex flex-wrap items-center gap-2">
                              {[
                                { name: 'bKash Pink', code: '#e2136e' },
                                { name: 'Nagad Orange', code: '#ea580c' },
                                { name: 'Rocket Purple', code: '#8c3494' },
                                { name: 'Upay Blue', code: '#005696' },
                                { name: 'Binance Gold', code: '#f0b90b' },
                                { name: 'Emerald', code: '#10b981' },
                                { name: 'Sky Blue', code: '#0284c7' },
                                { name: 'Indigo', code: '#4f46e5' },
                                { name: 'Red', code: '#dc2626' }
                              ].map((c) => (
                                <button
                                  key={c.code}
                                  type="button"
                                  onClick={() => setNewMethodColor(c.code)}
                                  className={`w-7 h-7 rounded-xl border-2 transition active:scale-95 ${
                                    newMethodColor === c.code ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-80 hover:opacity-100'
                                  }`}
                                  style={{ backgroundColor: c.code }}
                                  title={c.name}
                                />
                              ))}
                              <input
                                type="color"
                                value={newMethodColor}
                                onChange={(e) => setNewMethodColor(e.target.value)}
                                className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
                                title="Custom Color Picker"
                              />
                              <span className="text-[10px] font-mono font-bold text-slate-300">
                                {newMethodColor}
                              </span>
                            </div>
                          </div>

                          {/* Preset Icon Type & Logo URL */}
                          <div className="space-y-2 pt-2 border-t border-white/10">
                            <label className="text-[10px] font-bold text-slate-300 block">
                              ‡¶≤‡ßã‡¶ó‡ßã ‡¶Ö‡¶™‡¶∂‡¶® (Logo Selection):
                            </label>

                            <div className="grid grid-cols-4 gap-1.5">
                              {[
                                { id: 'bkash', label: 'bKash SVG' },
                                { id: 'nagad', label: 'Nagad SVG' },
                                { id: 'rocket', label: 'Rocket SVG' },
                                { id: 'upay', label: 'Upay SVG' },
                                { id: 'binance', label: 'Binance' },
                                { id: 'usdt', label: 'USDT ‚ÇÆ' },
                                { id: 'custom', label: 'Custom URL' }
                              ].map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => setNewMethodIconType(item.id as any)}
                                  className={`py-1.5 px-2 rounded-xl text-[10px] font-bold border transition ${
                                    newMethodIconType === item.id
                                      ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                                      : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-400 block mb-1">
                                ‡¶ï‡¶æ‡¶∏‡ßç‡¶ü‡¶Æ ‡¶≤‡ßã‡¶ó‡ßã ‡¶õ‡¶¨‡¶ø ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶¨‡¶æ ‡¶≤‡¶ø‡¶Ç‡¶ï (Logo Image Upload or URL):
                              </label>
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <label className="flex-1 cursor-pointer py-2 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95">
                                    <i className="fas fa-image"></i>
                                    <span>‡¶ó‡ßç‡¶Ø‡¶æ‡¶≤‡¶æ‡¶∞‡¶ø ‡¶•‡ßá‡¶ï‡ßá ‡¶õ‡¶¨‡¶ø ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶ï‡¶∞‡ßÅ‡¶®</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          try {
                                            const base64 = await compressImageToBase64(file, 400, 400, 0.85);
                                            setNewMethodLogoUrl(base64);
                                            setNewMethodIconType('custom');
                                            showToast('‚úÖ ‡¶≤‡ßã‡¶ó‡ßã ‡¶õ‡¶¨‡¶ø ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶π‡ßü‡ßá‡¶õ‡ßá!', 'success');
                                          } catch (err) {
                                            showToast('Failed to load image', 'error');
                                          }
                                        }
                                      }}
                                    />
                                  </label>
                                  {newMethodLogoUrl && (
                                    <button
                                      type="button"
                                      onClick={() => setNewMethodLogoUrl('')}
                                      className="px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-bold border border-red-500/30 transition"
                                      title="‡¶õ‡¶¨‡¶ø ‡¶∞‡¶ø‡¶Æ‡ßÅ‡¶≠ ‡¶ï‡¶∞‡ßÅ‡¶®"
                                    >
                                      <i className="fas fa-times"></i>
                                    </button>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  className="input-modern text-xs py-2 px-3"
                                  placeholder="‡¶Ö‡¶•‡¶¨‡¶æ ‡¶õ‡¶¨‡¶ø‡¶∞ URL ‡¶™‡ßá‡¶∏‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶® (e.g. https://...)"
                                  value={newMethodLogoUrl}
                                  onChange={(e) => setNewMethodLogoUrl(e.target.value)}
                                />
                              </div>
                            </div>

                            {/* Live Logo Preview Box */}
                            <div className="p-3 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-400">‡¶≤‡¶æ‡¶á‡¶≠ ‡¶≤‡ßã‡¶ó‡ßã ‡¶™‡ßç‡¶∞‡¶ø‡¶≠‡¶ø‡¶â:</span>
                              <div className="flex items-center gap-2">
                                {renderMethodLogo(
                                  {
                                    label: newMethodLabel || 'Demo',
                                    iconType: newMethodIconType,
                                    logoUrl: newMethodLogoUrl,
                                    color: newMethodColor
                                  },
                                  'w-8 h-8'
                                )}
                                <span className="text-xs font-black text-white">{newMethodLabel || 'Preview'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Extra Note / Details */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-300 block mb-1">
                              ‡¶®‡ßã‡¶ü / ‡¶®‡¶ø‡¶∞‡ßç‡¶¶‡ßá‡¶∂‡¶ø‡¶ï‡¶æ (Optional Notice / Rate):
                            </label>
                            <input
                              type="text"
                              className="input-modern text-xs py-2 px-3"
                              placeholder="e.g. 0.10$ = 12 TK / Only Personal Send Money"
                              value={newMethodNote}
                              onChange={(e) => setNewMethodNote(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => setShowAddMethodModal(false)}
                            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-bold transition"
                          >
                            ‡¶¨‡¶æ‡¶§‡¶ø‡¶≤
                          </button>
                          <button
                            type="button"
                            onClick={handleAddNewPaymentMethod}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg transition active:scale-95 flex items-center gap-1.5"
                          >
                            <i className="fas fa-save"></i>
                            <span>üíæ ‡¶Æ‡ßá‡¶•‡¶° ‡¶Ø‡ßã‡¶ó ‡¶ï‡¶∞‡ßÅ‡¶®</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ALL PAYMENT METHODS LIST */}
                  <div className="grid grid-cols-1 gap-4">
                    {(Object.entries(paymentMethodsConfig) as [string, PaymentMethodConfig][]).map(([key, config]) => {
                      const editState: PaymentMethodConfig = editingPaymentMethods[key] || {
                        ...config
                      };

                      return (
                        <div
                          key={key}
                          className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl hover:border-white/20 transition"
                        >
                          {/* Card Header */}
                          <div className="flex items-center justify-between pb-3 border-b border-white/10">
                            <div className="flex items-center gap-3">
                              {/* Live Logo */}
                              {renderMethodLogo(editState, 'w-10 h-10')}
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-black text-sm text-white">{editState.label || config.label}</h4>
                                  <span className="text-[9px] bg-white/10 px-2 py-0.5 rounded-md text-slate-300 font-mono">
                                    ID: {key}
                                  </span>
                                </div>
                                <span className="text-[10px] text-amber-300/90 font-mono font-bold">
                                  {editState.number || 'No number set'}
                                </span>
                              </div>
                            </div>

                            {/* Active Toggle & Delete Button */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingPaymentMethods((prev) => ({
                                    ...prev,
                                    [key]: { ...editState, active: editState.active === false ? true : false }
                                  }))
                                }
                                className={`text-[10px] font-extrabold px-3 py-1 rounded-full border transition cursor-pointer ${
                                  editState.active !== false
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                    : 'bg-red-500/15 text-red-400 border-red-500/30'
                                }`}
                              >
                                {editState.active !== false ? '‚óè Active (‡¶ö‡¶æ‡¶≤‡ßÅ)' : '‚óã Inactive (‡¶¨‡¶®‡ßç‡¶ß)'}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete "${config.label}"?`)) {
                                    handleDeletePaymentMethod(key);
                                  }
                                }}
                                className="w-8 h-8 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center text-xs transition active:scale-95 cursor-pointer"
                                title="Delete Method"
                              >
                                <i className="fas fa-trash-alt"></i>
                              </button>
                            </div>
                          </div>

                          {/* Editable Controls Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Label */}
                            <div>
                              <label className="text-[10px] font-bold text-slate-300 block mb-1">
                                ‡¶Æ‡ßá‡¶•‡¶°‡ßá‡¶∞ ‡¶®‡¶æ‡¶Æ (Method Label):
                              </label>
                              <input
                                type="text"
                                className="input-modern text-xs py-2 px-3 font-bold"
                                value={editState.label}
                                onChange={(e) =>
                                  setEditingPaymentMethods((prev) => ({
                                    ...prev,
                                    [key]: { ...editState, label: e.target.value }
                                  }))
                                }
                              />
                            </div>

                            {/* Number */}
                            <div>
                              <label className="text-[10px] font-bold text-slate-300 block mb-1">
                                ‡¶®‡¶Æ‡ßç‡¶¨‡¶∞ / ‡¶ì‡ßü‡¶æ‡¶≤‡ßá‡¶ü ‡¶è‡¶°‡ßç‡¶∞‡ßá‡¶∏ (Phone / Account):
                              </label>
                              <input
                                type="text"
                                className="input-modern text-xs py-2 px-3 font-mono font-bold text-amber-300"
                                value={editState.number}
                                onChange={(e) =>
                                  setEditingPaymentMethods((prev) => ({
                                    ...prev,
                                    [key]: { ...editState, number: e.target.value }
                                  }))
                                }
                              />
                            </div>

                            {/* Type */}
                            <div>
                              <label className="text-[10px] font-bold text-slate-300 block mb-1">
                                ‡¶ß‡¶∞‡¶® (Type):
                              </label>
                              <select
                                className="input-modern text-xs py-2 px-2 bg-slate-800 text-white font-bold"
                                value={editState.type || 'Send Money'}
                                onChange={(e) =>
                                  setEditingPaymentMethods((prev) => ({
                                    ...prev,
                                    [key]: { ...editState, type: e.target.value as any }
                                  }))
                                }
                              >
                                <option value="Send Money">Send Money</option>
                                <option value="Cash Out">Cash Out</option>
                                <option value="Payment">Payment</option>
                              </select>
                            </div>

                            {/* USSD Code */}
                            <div>
                              <label className="text-[10px] font-bold text-slate-300 block mb-1">
                                ‡¶°‡¶æ‡ßü‡¶æ‡¶≤ ‡¶ï‡ßã‡¶° (USSD Dial Code):
                              </label>
                              <input
                                type="text"
                                className="input-modern text-xs py-2 px-3 font-mono font-bold text-cyan-300"
                                value={editState.ussd || '*247#'}
                                onChange={(e) =>
                                  setEditingPaymentMethods((prev) => ({
                                    ...prev,
                                    [key]: { ...editState, ussd: e.target.value }
                                  }))
                                }
                              />
                            </div>

                            {/* Custom Color Selection */}
                            <div>
                              <label className="text-[10px] font-bold text-slate-300 block mb-1">
                                ‡¶•‡¶ø‡¶Æ ‡¶ï‡¶æ‡¶≤‡¶æ‡¶∞ (Theme Color):
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={editState.color || '#e2136e'}
                                  onChange={(e) =>
                                    setEditingPaymentMethods((prev) => ({
                                      ...prev,
                                      [key]: { ...editState, color: e.target.value }
                                    }))
                                  }
                                  className="w-7 h-7 rounded-lg bg-transparent border-0 cursor-pointer"
                                />
                                <input
                                  type="text"
                                  className="input-modern text-xs py-1 px-2 font-mono"
                                  value={editState.color || '#e2136e'}
                                  onChange={(e) =>
                                    setEditingPaymentMethods((prev) => ({
                                      ...prev,
                                      [key]: { ...editState, color: e.target.value }
                                    }))
                                  }
                                />
                              </div>
                            </div>

                            {/* Custom Logo Image Upload or URL */}
                            <div className="sm:col-span-2">
                              <label className="text-[10px] font-bold text-slate-300 block mb-1">
                                ‡¶≤‡ßã‡¶ó‡ßã ‡¶õ‡¶¨‡¶ø ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶® (Upload Image or paste URL):
                              </label>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <label className="cursor-pointer py-2 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 flex-shrink-0">
                                  <i className="fas fa-image"></i>
                                  <span>‡¶ó‡ßç‡¶Ø‡¶æ‡¶≤‡¶æ‡¶∞‡¶ø ‡¶•‡ßá‡¶ï‡ßá ‡¶õ‡¶¨‡¶ø</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        try {
                                          const base64 = await compressImageToBase64(file, 400, 400, 0.85);
                                          setEditingPaymentMethods((prev) => ({
                                            ...prev,
                                            [key]: { ...editState, logoUrl: base64 }
                                          }));
                                          showToast('‚úÖ ‡¶õ‡¶¨‡¶ø ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶π‡ßü‡ßá‡¶õ‡ßá! ‡¶®‡¶ø‡¶ö‡ßá Save ‡¶¨‡¶æ‡¶ü‡¶®‡ßá ‡¶ö‡¶æ‡¶™‡ßÅ‡¶®‡•§', 'success');
                                        } catch (err) {
                                          showToast('Failed to load image', 'error');
                                        }
                                      }
                                    }}
                                  />
                                </label>
                                {editState.logoUrl && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingPaymentMethods((prev) => ({
                                        ...prev,
                                        [key]: { ...editState, logoUrl: '' }
                                      }))
                                    }
                                    className="px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-bold border border-red-500/30 transition flex-shrink-0"
                                    title="‡¶õ‡¶¨‡¶ø ‡¶∞‡¶ø‡¶Æ‡ßÅ‡¶≠ ‡¶ï‡¶∞‡ßÅ‡¶®"
                                  >
                                    <i className="fas fa-trash-alt mr-1"></i> ‡¶õ‡¶¨‡¶ø ‡¶∏‡¶∞‡¶æ‡¶®
                                  </button>
                                )}
                                <input
                                  type="text"
                                  className="input-modern text-xs py-2 px-3 flex-1"
                                  placeholder="‡¶Ö‡¶•‡¶¨‡¶æ ‡¶õ‡¶¨‡¶ø‡¶∞ URL ‡¶™‡ßá‡¶∏‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®..."
                                  value={editState.logoUrl || ''}
                                  onChange={(e) =>
                                    setEditingPaymentMethods((prev) => ({
                                      ...prev,
                                      [key]: { ...editState, logoUrl: e.target.value }
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          </div>

                          {/* Note Field */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-300 block mb-1">
                              ‡¶®‡ßã‡¶ü / ‡¶∞‡ßá‡¶ü / ‡¶®‡¶ø‡¶∞‡ßç‡¶¶‡ßá‡¶∂‡¶ø‡¶ï‡¶æ (Optional Notice):
                            </label>
                            <input
                              type="text"
                              className="input-modern text-xs py-2 px-3"
                              placeholder="e.g. 0.10$ = 12 TK"
                              value={editState.note || ''}
                              onChange={(e) =>
                                setEditingPaymentMethods((prev) => ({
                                  ...prev,
                                  [key]: { ...editState, note: e.target.value }
                                }))
                              }
                            />
                          </div>

                          {/* Save Button */}
                          <button
                            type="button"
                            onClick={() => handleSavePaymentMethod(key, editState)}
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <i className="fas fa-save"></i>
                            <span>‡¶∏‡ßá‡¶≠ ‡¶ï‡¶∞‡ßÅ‡¶® ({editState.label || key})</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SUB TAB 2: DEPOSIT REQUESTS (‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶ï‡¶®‡ßç‡¶ü‡ßç‡¶∞‡ßã‡¶≤ & ‡¶è‡¶Æ‡¶æ‡¶â‡¶®‡ßç‡¶ü ‡¶è‡¶°‡¶ø‡¶ü) */}
              {adminSubTab === 'deposits' && (
                <div className="space-y-3">
                  {/* Filter tabs */}
                  <div className="flex gap-2">
                    {(['all', 'Pending', 'Approved', 'Rejected'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setDepFilter(f)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                          depFilter === f
                            ? 'bg-amber-500 text-slate-950 shadow'
                            : 'bg-slate-900 border border-white/10 text-slate-400'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  {allDepositRequests
                    .filter((d) => (depFilter === 'all' ? true : d.status === depFilter))
                    .map((dep) => {
                      const currentEditable = customDepAmounts[dep.id] ?? String(dep.amount);

                      return (
                        <div
                          key={dep.id}
                          className={`p-4 rounded-2xl border transition-all space-y-3 ${
                            dep.status === 'Pending'
                              ? 'bg-slate-900/90 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                              : dep.status === 'Approved'
                              ? 'bg-slate-900/60 border-emerald-500/30'
                              : 'bg-slate-900/40 border-red-500/30 opacity-75'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                                  dep.status === 'Approved'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : dep.status === 'Rejected'
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-amber-500/20 text-amber-400 animate-pulse'
                                }`}
                              >
                                {dep.status}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {dep.method.toUpperCase()}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500">
                              {dep.timestamp
                                ? new Date(dep.timestamp.seconds * 1000).toLocaleString('en-BD', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : 'Recent'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-[9px] text-slate-500 font-bold uppercase block">User UID</span>
                              <span className="font-mono text-slate-300 font-bold">{dep.uid}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-500 font-bold uppercase block">Trx ID / Hash</span>
                              <span className="font-mono text-blue-400 font-extrabold">{dep.trxId}</span>
                            </div>
                          </div>

                          {/* Uploaded Payment Screenshot (Proof) */}
                          {dep.screenshotUrl && (
                            <div className="p-2.5 bg-black/50 rounded-xl border border-amber-500/30 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <img
                                  src={dep.screenshotUrl}
                                  alt="Deposit Proof"
                                  className="w-12 h-12 object-cover rounded-lg border border-amber-400/40 cursor-pointer hover:scale-105 transition"
                                  onClick={() => setSelectedScreenshotPreview(dep.screenshotUrl!)}
                                />
                                <div>
                                  <span className="text-[10px] font-bold text-amber-300 block">
                                    üì∏ ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡¶∂‡¶ü ‡¶™‡ßç‡¶∞‡ßÅ‡¶´
                                  </span>
                                  <span className="text-[9px] text-slate-400">‡¶õ‡¶¨‡¶ø ‡¶¶‡ßá‡¶ñ‡¶§‡ßá ‡¶ï‡ßç‡¶≤‡¶ø‡¶ï ‡¶ï‡¶∞‡ßÅ‡¶®</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedScreenshotPreview(dep.screenshotUrl!)}
                                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                              >
                                <i className="fas fa-search-plus"></i>
                                <span>View Proof</span>
                              </button>
                            </div>
                          )}

                          {/* Editable Deposit Amount before Approval */}
                          <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 font-bold">Requested Deposit Amount:</span>
                              <span className="text-sm font-black text-white">‡ß≥ {dep.amount}</span>
                            </div>

                            {dep.status === 'Pending' && (
                              <div className="space-y-2 pt-1 border-t border-white/5">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-extrabold text-amber-400 flex items-center gap-1">
                                    <i className="fas fa-edit"></i>
                                    <span>Edit Deposit Amount (‡¶è‡¶Æ‡¶æ‡¶â‡¶®‡ßç‡¶ü ‡¶¨‡¶æ‡ßú‡¶æ‡¶® ‡¶¨‡¶æ ‡¶ï‡¶Æ‡¶æ‡¶®):</span>
                                  </label>
                                  {parseFloat(currentEditable) !== dep.amount && (
                                    <span className="text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full animate-pulse">
                                      ‡ß≥{dep.amount} ‚Üí ‡ß≥{currentEditable}
                                    </span>
                                  )}
                                </div>

                                {/* Quick Adjustment Buttons (+10, +50, -10, Reset) */}
                                <div className="flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const val = (parseFloat(currentEditable) || dep.amount) + 10;
                                      setCustomDepAmounts((prev) => ({ ...prev, [dep.id]: String(val) }));
                                    }}
                                    className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-extrabold text-[10px] rounded-lg border border-emerald-500/30 transition active:scale-95"
                                  >
                                    +10 ‡ß≥
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const val = (parseFloat(currentEditable) || dep.amount) + 50;
                                      setCustomDepAmounts((prev) => ({ ...prev, [dep.id]: String(val) }));
                                    }}
                                    className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-extrabold text-[10px] rounded-lg border border-emerald-500/30 transition active:scale-95"
                                  >
                                    +50 ‡ß≥
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const val = Math.max(0, (parseFloat(currentEditable) || dep.amount) - 10);
                                      setCustomDepAmounts((prev) => ({ ...prev, [dep.id]: String(val) }));
                                    }}
                                    className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-extrabold text-[10px] rounded-lg border border-red-500/30 transition active:scale-95"
                                  >
                                    -10 ‡ß≥
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomDepAmounts((prev) => ({ ...prev, [dep.id]: String(dep.amount) }));
                                    }}
                                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] rounded-lg border border-white/10 transition active:scale-95"
                                  >
                                    Reset (‡ß≥{dep.amount})
                                  </button>
                                </div>

                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    className="input-modern text-xs py-1.5 px-3 font-mono font-bold text-amber-300"
                                    placeholder="Enter final amount..."
                                    value={currentEditable}
                                    onChange={(e) =>
                                      setCustomDepAmounts((prev) => ({
                                        ...prev,
                                        [dep.id]: e.target.value
                                      }))
                                    }
                                  />
                                  <span className="text-xs font-bold text-slate-400">‡ß≥</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          {dep.status === 'Pending' && (
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() =>
                                  handleApproveDepositCustom(dep.id, dep.uid, parseFloat(currentEditable) || dep.amount)
                                }
                                className="flex-1 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow transition active:scale-95 flex items-center justify-center gap-1.5"
                              >
                                <i className="fas fa-check-circle"></i>
                                <span>APPROVE & CREDIT (‡ß≥ {currentEditable})</span>
                              </button>
                              <button
                                onClick={() => handleRejectDeposit(dep.id)}
                                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 font-bold text-xs rounded-xl transition active:scale-95 flex items-center justify-center gap-1"
                              >
                                <i className="fas fa-times-circle"></i>
                                <span>REJECT</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}

              {/* SUB TAB 3: ORDERS CONTROL */}
              {adminSubTab === 'orders' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-extrabold text-slate-300">All Orders ({allAdminOrdersList.length})</span>
                    <select
                      className="input-modern py-1 px-3 text-xs w-auto"
                      value={orderStatusFilter}
                      onChange={(e) => setOrderStatusFilter(e.target.value)}
                    >
                      <option value="all">All Statuses</option>
                      <option value="Pending">Pending</option>
                      <option value="Processing">Processing</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>

                  {allAdminOrdersList
                    .filter((o) => (orderStatusFilter === 'all' ? true : o.status === orderStatusFilter))
                    .map((o) => (
                      <div key={o.id} className="glass-card p-4 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-mono text-slate-400 font-bold">#{o.id.slice(-8)}</span>
                          <span className="font-mono text-slate-400 text-[10px]">User: {o.uid.slice(0, 8)}</span>
                        </div>

                        <h4 className="font-extrabold text-xs text-white leading-snug">{o.service}</h4>
                        <p className="text-[10px] text-slate-400 font-mono truncate">{o.link}</p>

                        <div className="flex justify-between items-center pt-2 border-t border-white/5">
                          <div className="text-xs">
                            <span className="text-slate-400">Qty: {o.qty?.toLocaleString()} | </span>
                            <span className="text-emerald-400 font-bold">‡ß≥ {o.cost?.toFixed(2)}</span>
                          </div>

                          {/* Change Status Dropdown */}
                          <div className="flex items-center gap-2">
                            <select
                              className="input-modern text-xs py-1 px-2.5 w-auto"
                              value={o.status || 'Pending'}
                              onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value)}
                            >
                              <option value="Pending">Pending</option>
                              <option value="Processing">Processing</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Completed">Completed</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>

                            {(!o.apiOrderId || o.apiError) && (
                              <button
                                onClick={() => handleRetryOrder(o)}
                                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[10px] rounded-lg border border-amber-500/30"
                              >
                                Retry API
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* SUB TAB 4: SERVICES MANAGEMENT */}
              {adminSubTab === 'services' && (
                <div className="space-y-5">
                  {/* Service Add/Edit Form Card */}
                  <div className={`glass-card p-4 sm:p-5 space-y-4 border ${editingServiceId ? 'border-amber-400 bg-amber-950/20 shadow-[0_0_25px_rgba(251,191,36,0.2)]' : 'border-slate-800 bg-slate-900/90'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${editingServiceId ? 'bg-amber-400 text-slate-950 shadow-md' : 'bg-gradient-to-tr from-sky-500 to-blue-600 text-white'}`}>
                          <i className={editingServiceId ? 'fas fa-edit' : 'fas fa-plus'}></i>
                        </div>
                        <div>
                          <h3 className="font-extrabold text-xs sm:text-sm text-white">
                            {editingServiceId ? '‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏ ‡¶è‡¶°‡¶ø‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶® (Edit Service)' : '‡¶®‡¶§‡ßÅ‡¶® ‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏ ‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶ï‡¶∞‡ßÅ‡¶® (Add Service)'}
                          </h3>
                          <p className="text-[10px] text-slate-400">
                            {editingServiceId ? `Editing Service ID: ${editingServiceId}` : 'SMMGen ‡¶¨‡¶æ ‡¶ï‡¶æ‡¶∏‡ßç‡¶ü‡¶Æ ‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏ Firestore-‡¶è ‡¶Ø‡ßã‡¶ó ‡¶ï‡¶∞‡ßÅ‡¶®'}
                          </p>
                        </div>
                      </div>
                      {editingServiceId && (
                        <button
                          onClick={() => {
                            setEditingServiceId(null);
                            setAdminName('');
                            setAdminCategory('');
                            setAdminPrice('');
                            setAdminMin('100');
                            setAdminMax('100000');
                            setAdminDesc('');
                            setAdminApiServiceId('');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 text-[11px] font-bold border border-red-500/30 flex items-center gap-1 transition"
                        >
                          <i className="fas fa-times"></i>
                          <span>‡¶è‡¶°‡¶ø‡¶ü ‡¶¨‡¶æ‡¶§‡¶ø‡¶≤ (Cancel)</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="form-label text-[11px] flex items-center justify-between">
                          <span>‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏‡ßá‡¶∞ ‡¶®‡¶æ‡¶Æ (Service Name)</span>
                          <span className="text-[9px] text-amber-400 font-normal">‡¶Ü‡¶¨‡¶∂‡ßç‡¶Ø‡¶ï</span>
                        </label>
                        <input
                          type="text"
                          className="input-modern text-xs"
                          placeholder="e.g. Facebook Page Followers [Super Instant]"
                          value={adminName}
                          onChange={(e) => setAdminName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label text-[11px] flex items-center justify-between">
                          <span>‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡ßá‡¶ó‡¶∞‡¶ø (Category)</span>
                          <span className="text-[9px] text-amber-400 font-normal">‡¶Ø‡ßá‡¶Æ‡¶®: Facebook, YouTube, TikTok</span>
                        </label>
                        <input
                          type="text"
                          className="input-modern text-xs"
                          placeholder="e.g. Facebook, YouTube, Instagram"
                          value={adminCategory}
                          onChange={(e) => setAdminCategory(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label className="form-label text-[10px] sm:text-[11px] flex items-center justify-between">
                          <span>‡¶™‡ßç‡¶∞‡¶§‡¶ø ‡ßß,‡ß¶‡ß¶‡ß¶ ‡¶¶‡¶æ‡¶Æ (‡ß≥)</span>
                          <span className="text-[9px] text-emerald-400 font-normal">Price/1k</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          className="input-modern text-xs font-bold text-emerald-400"
                          placeholder="‡ß≥ 25"
                          value={adminPrice}
                          onChange={(e) => setAdminPrice(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label text-[10px] sm:text-[11px]">Min Qty</label>
                        <input
                          type="number"
                          className="input-modern text-xs font-mono"
                          placeholder="100"
                          value={adminMin}
                          onChange={(e) => setAdminMin(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label text-[10px] sm:text-[11px]">API Service ID</label>
                        <input
                          type="text"
                          className="input-modern text-xs font-mono text-cyan-300"
                          placeholder="e.g. 15806"
                          value={adminApiServiceId}
                          onChange={(e) => setAdminApiServiceId(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="form-label text-[11px]">‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏ ‡¶°‡ßá‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡¶™‡¶∂‡¶® ‡¶¨‡¶æ ‡¶¨‡¶∞‡ßç‡¶£‡¶®‡¶æ (‡¶ê‡¶ö‡ßç‡¶õ‡¶ø‡¶ï)</label>
                      <input
                        type="text"
                        className="input-modern text-xs"
                        placeholder="e.g. ‚ö° Speed: 50K/Day | Non Drop | 30 Days Refill"
                        value={adminDesc}
                        onChange={(e) => setAdminDesc(e.target.value)}
                      />
                    </div>

                    <button
                      onClick={handleSaveServiceManual}
                      disabled={adminSubmitting}
                      className={`py-2.5 text-xs font-extrabold w-full flex items-center justify-center gap-1.5 rounded-xl shadow-lg transition ${editingServiceId ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950' : 'btn-primary-solid'}`}
                    >
                      {adminSubmitting ? (
                        <span className="loading-spinner"></span>
                      ) : (
                        <>
                          <i className={editingServiceId ? 'fas fa-check-circle' : 'fas fa-plus-circle'}></i>
                          <span>{editingServiceId ? '‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏ ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶® ‡¶∏‡ßá‡¶≠ ‡¶ï‡¶∞‡ßÅ‡¶® (SAVE SERVICE CHANGES)' : '‡¶®‡¶§‡ßÅ‡¶® ‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏ ‡¶Ø‡ßã‡¶ó ‡¶ï‡¶∞‡ßÅ‡¶® (CREATE SERVICE NOW)'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* SEARCH & FILTER CONTROLS FOR SERVICES */}
                  <div className="glass-card p-4 space-y-3 border border-sky-500/30 bg-gradient-to-b from-slate-900/90 to-slate-950/90 shadow-md">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center text-xs">
                          <i className="fas fa-search"></i>
                        </div>
                        <div>
                          <h4 className="font-extrabold text-xs text-white flex items-center gap-2">
                            <span>‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏ ‡¶∏‡¶æ‡¶∞‡ßç‡¶ö ‡¶ì ‡¶¶‡ßç‡¶∞‡ßÅ‡¶§ ‡¶¶‡¶æ‡¶Æ ‡¶ï‡¶®‡ßç‡¶ü‡ßç‡¶∞‡ßã‡¶≤ (Service Search & Price Manager)</span>
                          </h4>
                          <p className="text-[10px] text-slate-400">‡¶®‡¶æ‡¶Æ, ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡ßá‡¶ó‡¶∞‡¶ø ‡¶¨‡¶æ ‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏ ID ‡¶≤‡¶ø‡¶ñ‡ßá ‡¶∏‡¶æ‡¶•‡ßá ‡¶∏‡¶æ‡¶•‡ßá ‡¶ñ‡ßÅ‡¶Å‡¶ú‡ßÅ‡¶® ‡¶è‡¶¨‡¶Ç ‡¶¶‡¶æ‡¶Æ ‡¶ï‡¶Æ‡¶æ‡¶®/‡¶¨‡¶æ‡ßú‡¶æ‡¶®</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/10">
                          ‡¶Æ‡ßã‡¶ü: {allServices.length} ‡¶ü‡¶ø ‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏
                        </span>
                      </div>
                    </div>

                    {/* Search Input Bar with Clear Button */}
                    <div className="relative">
                      <input
                        type="text"
                        className="input-modern pl-9 pr-9 text-xs bg-slate-950/80 border-sky-500/40 focus:border-sky-400 placeholder:text-slate-500"
                        placeholder="üîç ‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏ ‡¶ñ‡ßÅ‡¶Å‡¶ú‡ßÅ‡¶® (‡¶Ø‡ßá‡¶Æ‡¶®: Facebook Likes, Followers, YouTube, TikTok ‡¶¨‡¶æ ID)..."
                        value={adminServiceSearch}
                        onChange={(e) => setAdminServiceSearch(e.target.value)}
                      />
                      <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-sky-400 text-xs pointer-events-none"></i>
                      {adminServiceSearch && (
                        <button
                          onClick={() => setAdminServiceSearch('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-800"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      )}
                    </div>

                    {/* Category Filter Pills */}
                    {categories.length > 0 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[10px]">
                        <button
                          onClick={() => setAdminServiceCategoryFilter('ALL')}
                          className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition ${
                            adminServiceCategoryFilter === 'ALL'
                              ? 'bg-sky-500 text-slate-950 shadow'
                              : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-white/5'
                          }`}
                        >
                          All ({allServices.length})
                        </button>
                        {categories.map((cat) => {
                          const count = allServices.filter((s) => s.category === cat).length;
                          return (
                            <button
                              key={cat}
                              onClick={() => setAdminServiceCategoryFilter(cat)}
                              className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition flex items-center gap-1 ${
                                adminServiceCategoryFilter === cat
                                  ? 'bg-amber-400 text-slate-950 shadow'
                                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-white/5'
                              }`}
                            >
                              <span>{cat}</span>
                              <span className={`text-[8px] px-1 py-0.2 rounded font-mono ${adminServiceCategoryFilter === cat ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-900 text-slate-400'}`}>
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Filtered Services List */}
                  {(() => {
                    const queryStr = adminServiceSearch.trim().toLowerCase();
                    const filtered = allServices.filter((svc) => {
                      // Category filter
                      if (adminServiceCategoryFilter !== 'ALL' && svc.category !== adminServiceCategoryFilter) {
                        return false;
                      }
                      // Search query filter
                      if (!queryStr) return true;
                      const matchName = svc.name?.toLowerCase().includes(queryStr);
                      const matchCat = svc.category?.toLowerCase().includes(queryStr);
                      const matchId = String(svc.id || '').toLowerCase().includes(queryStr);
                      const matchApiId = String(svc.apiServiceId || '').toLowerCase().includes(queryStr);
                      const matchDesc = (svc.desc || '').toLowerCase().includes(queryStr);
                      return matchName || matchCat || matchId || matchApiId || matchDesc;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="p-8 text-center bg-slate-900/60 border border-white/5 rounded-2xl space-y-2">
                          <i className="fas fa-search text-3xl text-slate-600"></i>
                          <p className="text-xs text-slate-400 font-medium">
                            "{adminServiceSearch}" ‡¶¶‡¶ø‡ßü‡ßá ‡¶ï‡ßã‡¶®‡ßã ‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏ ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶Ø‡¶æ‡ßü‡¶®‡¶ø!
                          </p>
                          <button
                            onClick={() => {
                              setAdminServiceSearch('');
                              setAdminServiceCategoryFilter('ALL');
                            }}
                            className="text-[11px] text-sky-400 hover:underline"
                          >
                            ‡¶´‡¶ø‡¶≤‡ßç‡¶ü‡¶æ‡¶∞ ‡¶ï‡ßç‡¶≤‡¶ø‡ßü‡¶æ‡¶∞ ‡¶ï‡¶∞‡ßÅ‡¶® (Show All)
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                          <span>‡¶¶‡ßá‡¶ñ‡¶æ‡¶®‡ßã ‡¶π‡¶ö‡ßç‡¶õ‡ßá: <strong>{filtered.length}</strong> ‡¶ü‡¶ø ‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏</span>
                          {adminServiceSearch && (
                            <span className="text-amber-400 text-[10px]">
                              ‡¶∏‡¶æ‡¶∞‡ßç‡¶ö ‡¶´‡¶≤‡¶æ‡¶´‡¶≤: "{adminServiceSearch}"
                            </span>
                          )}
                        </div>

                        {filtered.map((svc) => {
                          const isEditingThis = editingServiceId === svc.id;
                          const isUpdatingPrice = adminUpdatingPriceId === svc.id;
                          const quickInputVal = adminQuickPriceInputs[svc.id] ?? '';

                          return (
                            <div
                              key={svc.id}
                              className={`p-3.5 bg-slate-900/90 border rounded-2xl transition space-y-2.5 ${
                                isEditingThis
                                  ? 'border-amber-400/80 bg-amber-950/20 shadow-[0_0_15px_rgba(251,191,36,0.15)]'
                                  : 'border-white/10 hover:border-sky-500/40'
                              }`}
                            >
                              {/* Top Bar: Category badge, Service ID, API ID & Action Buttons */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1 flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[9px] bg-sky-500/20 text-sky-300 font-bold px-2 py-0.5 rounded border border-sky-500/30">
                                      {svc.category}
                                    </span>
                                    {svc.apiServiceId && (
                                      <span className="text-[9px] bg-purple-500/20 text-purple-300 font-mono font-bold px-1.5 py-0.5 rounded border border-purple-500/30">
                                        API ID: {svc.apiServiceId}
                                      </span>
                                    )}
                                    <span className="text-[9px] font-mono text-slate-500">
                                      DOC: {svc.id.slice(0, 8)}...
                                    </span>
                                  </div>
                                  <h4 className="font-extrabold text-xs sm:text-sm text-white leading-snug break-words">
                                    {svc.name}
                                  </h4>
                                  {svc.desc && (
                                    <p className="text-[10px] text-slate-400 line-clamp-1">
                                      {svc.desc}
                                    </p>
                                  )}
                                </div>

                                {/* Edit and Delete Main Buttons */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    title="‡¶∏‡¶Æ‡ßç‡¶™‡ßÇ‡¶∞‡ßç‡¶£ ‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏ ‡¶è‡¶°‡¶ø‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®"
                                    onClick={() => {
                                      setEditingServiceId(svc.id);
                                      setAdminName(svc.name);
                                      setAdminCategory(svc.category);
                                      setAdminPrice(String(svc.price));
                                      setAdminMin(String(svc.min || 100));
                                      setAdminMax(String(svc.max || 100000));
                                      setAdminDesc(svc.desc || '');
                                      setAdminApiServiceId(svc.apiServiceId || '');
                                      // Scroll smoothly to top edit form
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/30 text-xs font-bold flex items-center gap-1 transition"
                                  >
                                    <i className="fas fa-edit"></i>
                                    <span className="hidden sm:inline">‡¶è‡¶°‡¶ø‡¶ü</span>
                                  </button>
                                  <button
                                    title="‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏ ‡¶°‡¶ø‡¶≤‡¶ø‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®"
                                    onClick={() => handleDeleteService(svc.id, svc.name)}
                                    className="w-7 h-7 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 flex items-center justify-center text-xs transition"
                                  >
                                    <i className="fas fa-trash"></i>
                                  </button>
                                </div>
                              </div>

                              {/* Price Bar & Quick Price Stepper / Adjustment Controls */}
                              <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2.5 bg-slate-950/60 -mx-3.5 -mb-3.5 p-3 rounded-b-2xl">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-slate-400 uppercase font-bold">‡¶¨‡¶∞‡ßç‡¶§‡¶Æ‡¶æ‡¶® ‡¶¶‡¶æ‡¶Æ:</span>
                                  <span className="text-xs sm:text-sm font-black text-emerald-400 font-mono">
                                    ‡ß≥ {svc.price} <span className="text-[9px] font-normal text-slate-400">/ 1k</span>
                                  </span>
                                </div>

                                {/* Quick Price Increase / Decrease & Direct Input Controls */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {/* Quick Stepper Buttons: -5, -1, +1, +5 */}
                                  <div className="flex items-center bg-slate-900 border border-white/10 rounded-lg p-0.5 gap-0.5">
                                    <button
                                      disabled={isUpdatingPrice}
                                      onClick={() => handleQuickPriceUpdate(svc.id, svc.name, -5, true, svc.price)}
                                      title="‡ß≥‡ß´ ‡¶ï‡¶Æ‡¶æ‡¶®"
                                      className="px-1.5 py-0.5 text-[10px] font-bold text-red-400 hover:bg-red-500/20 rounded transition"
                                    >
                                      -5
                                    </button>
                                    <button
                                      disabled={isUpdatingPrice}
                                      onClick={() => handleQuickPriceUpdate(svc.id, svc.name, -1, true, svc.price)}
                                      title="‡ß≥‡ßß ‡¶ï‡¶Æ‡¶æ‡¶®"
                                      className="px-1.5 py-0.5 text-[10px] font-bold text-red-400 hover:bg-red-500/20 rounded transition border-r border-white/10"
                                    >
                                      -1
                                    </button>
                                    <button
                                      disabled={isUpdatingPrice}
                                      onClick={() => handleQuickPriceUpdate(svc.id, svc.name, 1, true, svc.price)}
                                      title="‡ß≥‡ßß ‡¶¨‡¶æ‡ßú‡¶æ‡¶®"
                                      className="px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/20 rounded transition border-l border-white/10"
                                    >
                                      +1
                                    </button>
                                    <button
                                      disabled={isUpdatingPrice}
                                      onClick={() => handleQuickPriceUpdate(svc.id, svc.name, 5, true, svc.price)}
                                      title="‡ß≥‡ß´ ‡¶¨‡¶æ‡ßú‡¶æ‡¶®"
                                      className="px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/20 rounded transition"
                                    >
                                      +5
                                    </button>
                                  </div>

                                  {/* Custom Price Direct Input & Save */}
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      step="any"
                                      placeholder={`‡ß≥${svc.price}`}
                                      value={quickInputVal}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setAdminQuickPriceInputs((prev) => ({
                                          ...prev,
                                          [svc.id]: val
                                        }));
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && quickInputVal) {
                                          handleQuickPriceUpdate(svc.id, svc.name, quickInputVal, false, svc.price);
                                        }
                                      }}
                                      className="w-16 h-7 text-xs bg-slate-900 border border-emerald-500/40 rounded-lg px-1.5 text-center font-bold text-emerald-300 focus:border-emerald-400"
                                    />
                                    <button
                                      disabled={!quickInputVal || isUpdatingPrice}
                                      onClick={() => handleQuickPriceUpdate(svc.id, svc.name, quickInputVal, false, svc.price)}
                                      title="‡¶®‡¶§‡ßÅ‡¶® ‡¶¶‡¶æ‡¶Æ ‡¶∏‡¶Ç‡¶∞‡¶ï‡ßç‡¶∑‡¶£ ‡¶ï‡¶∞‡ßÅ‡¶®"
                                      className={`h-7 px-2 text-[10px] font-bold rounded-lg flex items-center gap-1 transition ${
                                        quickInputVal
                                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold shadow'
                                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                      }`}
                                    >
                                      {isUpdatingPrice ? (
                                        <i className="fas fa-spinner fa-spin text-xs"></i>
                                      ) : (
                                        <>
                                          <i className="fas fa-save"></i>
                                          <span>‡¶∏‡ßá‡¶≠</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
              {/* SUB TAB 5: BROADCAST & LIVE NOTICE TICKER */}
              {adminSubTab === 'notifications' && (
                <div className="space-y-4">
                  {/* SECTION 1: HOME PAGE SCROLLING LIVE NOTICE TICKER */}
                  <div className="glass-card p-5 space-y-4 border border-amber-500/40 bg-gradient-to-br from-amber-950/20 via-slate-900/90 to-slate-900/90 shadow-[0_4px_25px_rgba(245,158,11,0.15)] rounded-2xl animate-fade-in">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-500 flex items-center justify-center text-slate-950 text-lg font-black shadow-lg">
                          <i className="fas fa-bullhorn"></i>
                        </div>
                        <div>
                          <h3 className="font-black text-sm text-white flex items-center gap-2">
                            <span>‡¶π‡ßã‡¶Æ ‡¶™‡ßá‡¶á‡¶ú‡ßá‡¶∞ ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶≤‡¶ø‡¶Ç ‡¶®‡ßã‡¶ü‡¶ø‡¶∂ ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶® (Live Notice Ticker)</span>
                            <span className="text-[9px] bg-amber-500/25 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40 font-mono font-bold">
                              HOMEPAGE TICKER
                            </span>
                          </h3>
                          <p className="text-[11px] text-slate-300">
                            ‡¶è‡¶ñ‡¶æ‡¶®‡ßá ‡¶Ø‡ßá ‡¶®‡ßã‡¶ü‡¶ø‡¶∂ ‡¶≤‡¶ø‡¶ñ‡¶¨‡ßá‡¶® ‡¶§‡¶æ ‡¶∏‡¶Æ‡¶∏‡ßç‡¶§ ‡¶á‡¶â‡¶ú‡¶æ‡¶∞‡¶¶‡ßá‡¶∞ ‡¶π‡ßã‡¶Æ ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡ßá‡¶∞ ‡¶â‡¶™‡¶∞‡ßá ‡¶≤‡¶æ‡¶á‡¶≠ ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶®‡¶ø‡¶Æ‡ßá‡¶ü‡ßá‡¶° ‡¶π‡ßü‡ßá ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶≤ ‡¶ï‡¶∞‡¶¨‡ßá‡•§
                          </p>
                        </div>
                      </div>

                      {/* On/Off Switch */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-300">‡¶®‡ßã‡¶ü‡¶ø‡¶∂ ‡¶¨‡¶æ‡¶∞:</span>
                        <button
                          type="button"
                          onClick={() => handleQuickToggleFeature('showNoticeTicker', !adminShowNoticeTicker)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer active:scale-95 ${
                            adminShowNoticeTicker
                              ? 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                              : 'bg-red-500/30 text-red-300 border border-red-500/40'
                          }`}
                        >
                          {adminShowNoticeTicker ? '‚úÖ ‡¶ö‡¶æ‡¶≤‡ßÅ (ON)' : '‚ùå ‡¶¨‡¶®‡ßç‡¶ß (OFF)'}
                        </button>
                      </div>
                    </div>

                    {/* Live Preview Box */}
                    <div className="p-3 bg-black/50 rounded-xl border border-amber-500/30">
                      <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-amber-400 mb-2">
                        <span>‡¶≤‡¶æ‡¶á‡¶≠ ‡¶™‡ßç‡¶∞‡¶ø‡¶≠‡¶ø‡¶â (Live Preview)</span>
                        <span className="text-slate-400 font-normal">‡¶á‡¶â‡¶ú‡¶æ‡¶∞‡¶∞‡¶æ ‡¶†‡¶ø‡¶ï ‡¶Ø‡ßá‡¶≠‡¶æ‡¶¨‡ßá ‡¶¶‡ßá‡¶ñ‡¶¨‡ßá</span>
                      </div>
                      <div className="overflow-hidden rounded-xl bg-slate-900/90 border border-amber-500/30 p-2 flex items-center gap-2 shadow-inner">
                        <div className="flex items-center gap-1 bg-amber-500/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-lg border border-amber-500/40 whitespace-nowrap">
                          <i className="fas fa-bullhorn text-amber-400 text-xs animate-bounce"></i>
                          <span>‡¶®‡ßã‡¶ü‡¶ø‡¶∂</span>
                        </div>
                        <div className="overflow-hidden whitespace-nowrap w-full">
                          <p className="text-[11px] font-semibold text-slate-200 inline-block animate-marquee">
                            {adminNoticeText || '‚ö° ‡¶ï‡ßã‡¶®‡ßã ‡¶®‡ßã‡¶ü‡¶ø‡¶∂ ‡¶¶‡ßá‡¶ì‡ßü‡¶æ ‡¶®‡ßá‡¶á'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Notice Input */}
                    <div>
                      <label className="form-label text-slate-300 flex items-center justify-between">
                        <span className="font-extrabold">‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶≤‡¶ø‡¶Ç ‡¶®‡ßã‡¶ü‡¶ø‡¶∂ ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶® (Notice Text)</span>
                        <span className="text-[10px] text-slate-400">‡¶á‡¶Æ‡ßã‡¶ú‡¶ø ‡¶ì ‡¶∏‡ßç‡¶™‡ßá‡¶∂‡¶æ‡¶≤ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶∞‡ßá‡¶ï‡ßç‡¶ü‡¶æ‡¶∞ ‡¶∏‡¶æ‡¶™‡ßã‡¶∞‡ßç‡¶ü ‡¶ï‡¶∞‡ßá</span>
                      </label>
                      <textarea
                        rows={3}
                        className="input-modern text-xs text-white resize-none border-amber-500/30 focus:border-amber-400"
                        placeholder="‡¶Ø‡ßá‡¶Æ‡¶®: ‚ö° ‡ß®‡ß™/‡ß≠ ‡¶á‡¶®‡¶∏‡ßç‡¶ü‡ßç‡¶Ø‡¶æ‡¶®‡ßç‡¶ü ‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏ ‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡ßü | ‡¶¨‡¶ø‡¶ï‡¶æ‡¶∂, ‡¶®‡¶ó‡¶¶, ‡¶∞‡¶ï‡ßá‡¶ü‡ßá ‡¶á‡¶®‡¶∏‡ßç‡¶ü‡ßç‡¶Ø‡¶æ‡¶®‡ßç‡¶ü ‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶¨‡ßã‡¶®‡¶æ‡¶∏ ‡¶ö‡¶≤‡¶õ‡ßá | ‡¶Ø‡ßá‡¶ï‡ßã‡¶®‡ßã ‡¶™‡ßç‡¶∞‡ßü‡ßã‡¶ú‡¶®‡ßá ‡¶≤‡¶æ‡¶á‡¶≠ ‡¶∏‡¶æ‡¶™‡ßã‡¶∞‡ßç‡¶ü‡ßá ‡¶Ø‡ßã‡¶ó‡¶æ‡¶Ø‡ßã‡¶ó ‡¶ï‡¶∞‡ßÅ‡¶® üöÄ"
                        value={adminNoticeText}
                        onChange={(e) => setAdminNoticeText(e.target.value)}
                      />
                    </div>

                    {/* Quick Preset Templates */}
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 block mb-2">‡¶§‡¶æ‡¶§‡ßç‡¶ï‡ßç‡¶∑‡¶£‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶ø-‡¶∏‡ßá‡¶ü ‡¶®‡ßã‡¶ü‡¶ø‡¶∂ (Quick Notice Presets):</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const t = '‚ö° ‡ß®‡ß™/‡ß≠ ‡¶á‡¶®‡¶∏‡ßç‡¶ü‡ßç‡¶Ø‡¶æ‡¶®‡ßç‡¶ü ‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏ ‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡ßü | ‡¶¨‡¶ø‡¶ï‡¶æ‡¶∂, ‡¶®‡¶ó‡¶¶, ‡¶∞‡¶ï‡ßá‡¶ü‡ßá ‡¶á‡¶®‡¶∏‡ßç‡¶ü‡ßç‡¶Ø‡¶æ‡¶®‡ßç‡¶ü ‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶¨‡ßã‡¶®‡¶æ‡¶∏ ‡¶ö‡¶≤‡¶õ‡ßá | ‡¶Ø‡ßá‡¶ï‡ßã‡¶®‡ßã ‡¶™‡ßç‡¶∞‡ßü‡ßã‡¶ú‡¶®‡ßá ‡¶Ü‡¶Æ‡¶æ‡¶¶‡ßá‡¶∞ ‡¶≤‡¶æ‡¶á‡¶≠ ‡¶∏‡¶æ‡¶™‡ßã‡¶∞‡ßç‡¶ü‡ßá ‡¶Ø‡ßã‡¶ó‡¶æ‡¶Ø‡ßã‡¶ó ‡¶ï‡¶∞‡ßÅ‡¶® üöÄ';
                            setAdminNoticeText(t);
                            showToast('‡¶™‡ßç‡¶∞‡¶ø-‡¶∏‡ßá‡¶ü ‡¶≤‡ßã‡¶° ‡¶π‡ßü‡ßá‡¶õ‡ßá, ‡¶∏‡ßá‡¶≠ ‡¶¨‡¶æ‡¶ü‡¶®‡ßá ‡¶ï‡ßç‡¶≤‡¶ø‡¶ï ‡¶ï‡¶∞‡ßÅ‡¶®', 'info');
                          }}
                          className="p-2 text-left rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                        >
                          üåü <strong className="text-white">‡¶∏‡ßç‡¶ü‡ßç‡¶Ø‡¶æ‡¶®‡ßç‡¶°‡¶æ‡¶∞‡ßç‡¶° ‡¶®‡ßã‡¶ü‡¶ø‡¶∂:</strong> ‡ß®‡ß™/‡ß≠ ‡¶á‡¶®‡¶∏‡ßç‡¶ü‡ßç‡¶Ø‡¶æ‡¶®‡ßç‡¶ü ‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏ ‡¶ì ‡¶∏‡¶æ‡¶™‡ßã‡¶∞‡ßç‡¶ü
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const t = 'üéâ ‡¶ß‡¶æ‡¶Æ‡¶æ‡¶ï‡¶æ ‡¶Ö‡¶´‡¶æ‡¶∞! ‡¶™‡ßç‡¶∞‡¶§‡¶ø ‡ßß‡ß¶‡ß¶‡ß¶ ‡¶ü‡¶æ‡¶ï‡¶æ ‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü‡ßá ‡ßß‡ß¶‡ß¶ ‡¶ü‡¶æ‡¶ï‡¶æ ‡¶´‡ßç‡¶∞‡¶ø ‡¶¨‡ßã‡¶®‡¶æ‡¶∏ | ‡¶Ö‡¶ü‡ßã‡¶Æ‡ßá‡¶ü‡¶ø‡¶ï ‡¶¨‡¶ø‡¶ï‡¶æ‡¶∂ ‡¶ì ‡¶®‡¶ó‡¶¶ ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶ö‡¶æ‡¶≤‡ßÅ ‡¶Ü‡¶õ‡ßá üí∞';
                            setAdminNoticeText(t);
                            showToast('‡¶™‡ßç‡¶∞‡¶ø-‡¶∏‡ßá‡¶ü ‡¶≤‡ßã‡¶° ‡¶π‡ßü‡ßá‡¶õ‡ßá, ‡¶∏‡ßá‡¶≠ ‡¶¨‡¶æ‡¶ü‡¶®‡ßá ‡¶ï‡ßç‡¶≤‡¶ø‡¶ï ‡¶ï‡¶∞‡ßÅ‡¶®', 'info');
                          }}
                          className="p-2 text-left rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                        >
                          üéÅ <strong className="text-white">‡¶°‡¶ø‡¶™‡ßã‡¶ú‡¶ø‡¶ü ‡¶Ö‡¶´‡¶æ‡¶∞:</strong> ‡¶ï‡ßç‡¶Ø‡¶æ‡¶∂‡¶¨‡ßç‡¶Ø‡¶æ‡¶ï ‡¶ì ‡¶¨‡ßã‡¶®‡¶æ‡¶∏ ‡¶®‡ßã‡¶ü‡¶ø‡¶∂
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const t = 'üöÄ ‡¶´‡ßá‡¶∏‡¶¨‡ßÅ‡¶ï ‡¶´‡¶≤‡ßã‡¶Ø‡¶º‡¶æ‡¶∞, ‡¶á‡¶â‡¶ü‡¶ø‡¶â‡¶¨ ‡¶∏‡¶æ‡¶¨‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶æ‡¶á‡¶¨‡¶æ‡¶∞ ‡¶ì ‡¶á‡¶®‡¶∏‡ßç‡¶ü‡¶æ‡¶ó‡ßç‡¶∞‡¶æ‡¶Æ ‡¶≤‡¶æ‡¶á‡¶ï ‡¶è‡¶ñ‡¶® ‡¶∏‡ßÅ‡¶™‡¶æ‡¶∞ ‡¶´‡¶æ‡¶∏‡ßç‡¶ü ‡¶∏‡ßç‡¶™‡¶ø‡¶°‡ßá ‡¶°‡ßá‡¶≤‡¶ø‡¶≠‡¶æ‡¶∞‡¶ø ‡¶π‡¶ö‡ßç‡¶õ‡ßá! ‡¶è‡¶ñ‡¶®‡¶á ‡¶Ö‡¶∞‡ßç‡¶°‡¶æ‡¶∞ ‡¶ï‡¶∞‡ßÅ‡¶® üî•';
                            setAdminNoticeText(t);
                            showToast('‡¶™‡ßç‡¶∞‡¶ø-‡¶∏‡ßá‡¶ü ‡¶≤‡ßã‡¶° ‡¶π‡ßü‡ßá‡¶õ‡ßá, ‡¶∏‡ßá‡¶≠ ‡¶¨‡¶æ‡¶ü‡¶®‡ßá ‡¶ï‡ßç‡¶≤‡¶ø‡¶ï ‡¶ï‡¶∞‡ßÅ‡¶®', 'info');
                          }}
                          className="p-2 text-left rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                        >
                          ‚ö° <strong className="text-white">‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏ ‡¶Ü‡¶™‡¶°‡ßá‡¶ü:</strong> ‡¶∏‡ßÅ‡¶™‡¶æ‡¶∞ ‡¶∏‡ßç‡¶™‡¶ø‡¶° ‡¶°‡ßá‡¶≤‡¶ø‡¶≠‡¶æ‡¶∞‡¶ø
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const t = 'üì¢ ‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶æ‡¶∞ ‡¶Æ‡ßá‡¶á‡¶®‡¶ü‡ßá‡¶®‡ßç‡¶Ø‡¶æ‡¶®‡ßç‡¶∏ ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶® ‡¶π‡ßü‡ßá‡¶õ‡ßá | ‡¶∏‡¶ï‡¶≤ ‡¶∏‡ßã‡¶∂‡ßç‡¶Ø‡¶æ‡¶≤ ‡¶Æ‡¶ø‡¶°‡¶ø‡ßü‡¶æ ‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏ ‡ßß‡ß¶‡ß¶% ‡¶∏‡¶ö‡¶≤ ‡¶ì ‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡ßü ‡¶Ü‡¶õ‡ßá üõ°Ô∏è';
                            setAdminNoticeText(t);
                            showToast('‡¶™‡ßç‡¶∞‡¶ø-‡¶∏‡ßá‡¶ü ‡¶≤‡ßã‡¶° ‡¶π‡ßü‡ßá‡¶õ‡ßá, ‡¶∏‡ßá‡¶≠ ‡¶¨‡¶æ‡¶ü‡¶®‡ßá ‡¶ï‡ßç‡¶≤‡¶ø‡¶ï ‡¶ï‡¶∞‡ßÅ‡¶®', 'info');
                          }}
                          className="p-2 text-left rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                        >
                          üõ†Ô∏è <strong className="text-white">‡¶Æ‡ßá‡¶á‡¶®‡¶ü‡ßá‡¶®‡ßç‡¶Ø‡¶æ‡¶®‡ßç‡¶∏ ‡¶®‡ßã‡¶ü‡¶ø‡¶∂:</strong> ‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶æ‡¶∞ ‡¶Ü‡¶™‡¶°‡ßá‡¶ü
                        </button>
                      </div>
                    </div>

                    {/* Save Notice Button */}
                    <div className="pt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveNoticeText()}
                        disabled={adminSavingNotice}
                        className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-slate-950 font-black text-xs sm:text-sm shadow-[0_4px_20px_rgba(245,158,11,0.3)] hover:brightness-110 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {adminSavingNotice ? (
                          <>
                            <i className="fas fa-spinner fa-spin"></i>
                            <span>‡¶®‡ßã‡¶ü‡¶ø‡¶∂ ‡¶∏‡ßá‡¶≠ ‡¶π‡¶ö‡ßç‡¶õ‡ßá...</span>
                          </>
                        ) : (
                          <>
                            <i className="fas fa-save"></i>
                            <span>üíæ ‡¶π‡ßã‡¶Æ ‡¶®‡ßã‡¶ü‡¶ø‡¶∂ ‡¶Ü‡¶™‡¶°‡ßá‡¶ü ‡¶ì ‡¶∏‡ßá‡¶≠ ‡¶ï‡¶∞‡ßÅ‡¶® (Save Notice)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* SECTION 2: BROADCAST NOTIFICATION TO ALL USERS */}
                  <div className="glass-card p-5 space-y-4 border border-blue-500/30 rounded-2xl">
                    <h3 className="font-extrabold text-xs text-white flex items-center gap-2 pb-2 border-b border-white/10">
                      <i className="fas fa-paper-plane text-blue-400"></i>
                      <span>‡¶™‡ßÅ‡¶∂ ‡¶¨‡ßç‡¶∞‡¶°‡¶ï‡¶æ‡¶∏‡ßç‡¶ü ‡¶®‡ßã‡¶ü‡¶ø‡¶´‡¶ø‡¶ï‡ßá‡¶∂‡¶® ‡¶™‡¶æ‡¶†‡¶æ‡¶® (Post Broadcast Notification to All Users)</span>
                    </h3>

                    <div>
                      <label className="form-label">Notification Title</label>
                      <input
                        type="text"
                        className="input-modern text-xs"
                        placeholder="e.g. Special Weekend Deposit Bonus üéâ"
                        value={broadcastTitle}
                        onChange={(e) => setBroadcastTitle(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="form-label">Type</label>
                      <select
                        className="input-modern text-xs"
                        value={broadcastType}
                        onChange={(e) => setBroadcastType(e.target.value as any)}
                      >
                        <option value="system">System Notice üöÄ</option>
                        <option value="promo">Promo / Offer üéâ</option>
                        <option value="deposit">Deposit Update üí≥</option>
                      </select>
                    </div>

                    <div>
                      <label className="form-label">Message Details</label>
                      <textarea
                        rows={3}
                        className="input-modern text-xs resize-none"
                        placeholder="Write message to send to all users..."
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                      />
                    </div>

                    {/* Broadcast Image / Banner Upload */}
                    <div className="space-y-2 p-3 bg-black/40 rounded-2xl border border-white/10">
                      <div className="flex justify-between items-center text-xs">
                        <label className="font-extrabold text-white flex items-center gap-1.5">
                          <i className="fas fa-image text-amber-400"></i>
                          <span>Attach Image / Banner (‡¶õ‡¶¨‡¶ø ‡¶∏‡¶Ç‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶ï‡¶∞‡ßÅ‡¶® - ‡¶ê‡¶ö‡ßç‡¶õ‡¶ø‡¶ï)</span>
                        </label>
                        {broadcastImage && (
                          <button
                            onClick={() => setBroadcastImage(null)}
                            className="text-[10px] text-red-400 hover:underline font-bold cursor-pointer"
                          >
                            Remove Photo
                          </button>
                        )}
                      </div>

                      {broadcastImage ? (
                        <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-amber-500/40 bg-slate-950">
                          <img src={broadcastImage} alt="Broadcast Banner Preview" className="w-full h-full object-cover" />
                          <button
                            onClick={() => setBroadcastImage(null)}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center text-xs shadow hover:scale-110 transition cursor-pointer"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-amber-500/30 hover:border-amber-400 bg-amber-500/5 hover:bg-amber-500/10 rounded-xl transition cursor-pointer text-center">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAdminBroadcastImageUpload}
                            className="hidden"
                          />
                          <i className="fas fa-cloud-arrow-up text-amber-400 text-xl mb-1"></i>
                          <span className="text-xs font-bold text-white">‡¶¨‡ßç‡¶∞‡¶°‡¶ï‡¶æ‡¶∏‡ßç‡¶ü ‡¶®‡ßã‡¶ü‡¶ø‡¶∂‡ßá‡¶∞ ‡¶ú‡¶®‡ßç‡¶Ø ‡¶õ‡¶¨‡¶ø ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶ï‡¶∞‡ßÅ‡¶®</span>
                        </label>
                      )}
                    </div>

                    <button
                      onClick={handleSendBroadcast}
                      className="btn-primary-solid py-2.5 text-xs w-full flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <i className="fas fa-paper-plane text-xs"></i>
                      <span>BROADCAST TO ALL USERS</span>
                    </button>
                  </div>
                </div>
              )}

              {/* SUB TAB 6: SUPPORT LINKS */}
              {adminSubTab === 'links' && (
                <div className="space-y-4">
                  <div className="glass-card p-4 space-y-3">
                    <h3 className="font-extrabold text-xs text-white">Add New Support Link</h3>
                    <input
                      type="text"
                      className="input-modern text-xs"
                      placeholder="Link Title (e.g. Telegram Channel)"
                      value={newLinkName}
                      onChange={(e) => setNewLinkName(e.target.value)}
                    />
                    <input
                      type="text"
                      className="input-modern text-xs"
                      placeholder="URL (e.g. https://t.me/RF2_SMM)"
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                    />
                    <button
                      onClick={handleAddSupportLink}
                      className="btn-primary-solid py-2 text-xs w-full flex items-center justify-center gap-1"
                    >
                      <i className="fas fa-plus"></i>
                      <span>ADD LINK</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {supportLinks.map((sl) => (
                      <div key={sl.id} className="p-3 bg-slate-900/80 border border-white/10 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <i className={`${sl.icon} text-blue-400 text-sm`}></i>
                          <div>
                            <h4 className="font-extrabold text-xs text-white">{sl.name}</h4>
                            <p className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]">{sl.url}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteSupportLink(sl.id)}
                          className="w-7 h-7 rounded-lg bg-red-500/20 text-red-300 flex items-center justify-center text-xs"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SUB TAB: 3D WELCOME VOICE & ANNOUNCEMENT SETTINGS */}
              {adminSubTab === 'welcome' && (
                <div className="glass-card p-5 space-y-5 animate-fade-in">
                  {/* Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white text-lg shadow">
                        <i className="fas fa-volume-up"></i>
                      </div>
                      <div>
                        <h3 className="font-black text-sm text-white flex items-center gap-2">
                          <span>3D ‡¶ì‡¶Ø‡¶º‡ßá‡¶≤‡¶ï‡¶æ‡¶Æ ‡¶≠‡¶Ø‡¶º‡ßá‡¶∏ ‡¶ì ‡¶Æ‡ßá‡¶∏‡ßá‡¶ú ‡¶ï‡¶®‡ßç‡¶ü‡ßç‡¶∞‡ßã‡¶≤</span>
                          <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30 font-mono">
                            AUDIO & SPEECH
                          </span>
                        </h3>
                        <p className="text-[11px] text-slate-300">
                          ‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶ï‡¶æ‡¶â‡¶®‡ßç‡¶ü‡ßá ‡¶¢‡ßã‡¶ï‡¶æ‡¶∞ ‡¶™‡¶∞ ‡¶∏‡ßç‡¶™‡¶ø‡¶ï‡¶æ‡¶∞‡ßá ‡¶Ø‡¶æ ‡¶¨‡¶≤‡¶¨‡ßá (‡¶Ö‡¶°‡¶ø‡¶ì ‡¶´‡¶æ‡¶á‡¶≤/‡¶≠‡ßü‡ßá‡¶∏ ‡¶∞‡ßá‡¶ï‡¶∞‡ßç‡¶°/TTS) ‡¶è‡¶¨‡¶Ç ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡ßá ‡¶Ø‡ßá ‡¶Æ‡ßá‡¶∏‡ßá‡¶ú ‡¶¶‡ßá‡¶ñ‡¶æ‡¶¨‡ßá
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* MASTER SOUND & USER PANEL VISIBILITY TOGGLES */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-cyan-500/30 space-y-3 shadow-inner">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <i className="fas fa-sliders-h text-cyan-400 text-sm"></i>
                        <span className="text-xs font-black text-white">‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶™‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤ ‡¶∏‡¶æ‡¶â‡¶®‡ßç‡¶° ‡¶ì ‡¶°‡¶ø‡¶∏‡¶™‡ßç‡¶≤‡ßá ‡¶ï‡¶®‡ßç‡¶ü‡ßç‡¶∞‡ßã‡¶≤ (Sound & Visibility Switches)</span>
                      </div>
                      <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full font-mono border border-cyan-500/30 font-bold">
                        REAL-TIME SYNC
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* 1. Welcome Sound / Voice Toggle */}
                      <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${adminSoundEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                            <i className={`fas ${adminSoundEnabled ? 'fa-volume-up' : 'fa-volume-mute'}`}></i>
                          </div>
                          <div>
                            <div className="text-xs font-black text-white">‡¶ì‡¶Ø‡¶º‡ßá‡¶≤‡¶ï‡¶æ‡¶Æ ‡¶∏‡¶æ‡¶â‡¶®‡ßç‡¶° / ‡¶≠‡¶Ø‡¶º‡ßá‡¶∏</div>
                            <div className="text-[10px] text-slate-400">
                              {adminSoundEnabled ? 'üîä ‡¶∏‡¶æ‡¶â‡¶®‡ßç‡¶° ‡¶ö‡¶æ‡¶≤‡ßÅ (Play Audio)' : 'üîá ‡¶Æ‡¶ø‡¶â‡¶ü / ‡¶ï‡ßã‡¶®‡ßã ‡¶∏‡¶æ‡¶â‡¶®‡ßç‡¶° ‡¶Ü‡¶∏‡¶¨‡ßá ‡¶®‡¶æ'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickToggleFeature('soundEnabled', !adminSoundEnabled)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer active:scale-95 ${
                            adminSoundEnabled
                              ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                              : 'bg-red-500/30 text-red-300 border border-red-500/40'
                          }`}
                        >
                          {adminSoundEnabled ? 'ON (‡¶ö‡¶æ‡¶≤‡ßÅ)' : 'OFF (‡¶¨‡¶®‡ßç‡¶ß)'}
                        </button>
                      </div>

                      {/* 2. Welcome Modal Popup Toggle */}
                      <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${adminWelcomeEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                            <i className="fas fa-window-restore"></i>
                          </div>
                          <div>
                            <div className="text-xs font-black text-white">‡¶ì‡¶Ø‡¶º‡ßá‡¶≤‡¶ï‡¶æ‡¶Æ ‡¶™‡¶™‡¶Ü‡¶™ ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®</div>
                            <div className="text-[10px] text-slate-400">
                              {adminWelcomeEnabled ? 'üåü ‡¶≤‡¶ó‡¶á‡¶®‡ßá ‡¶™‡¶™‡¶Ü‡¶™ ‡¶Ü‡¶∏‡¶¨‡ßá' : 'üö´ ‡¶™‡¶™‡¶Ü‡¶™ ‡¶¨‡¶®‡ßç‡¶ß (‡¶á‡¶â‡¶ú‡¶æ‡¶∞‡ßá ‡¶¶‡ßá‡¶ñ‡¶æ‡¶¨‡ßá ‡¶®‡¶æ)'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickToggleFeature('enabled', !adminWelcomeEnabled)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer active:scale-95 ${
                            adminWelcomeEnabled
                              ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                              : 'bg-red-500/30 text-red-300 border border-red-500/40'
                          }`}
                        >
                          {adminWelcomeEnabled ? 'ON (‡¶ö‡¶æ‡¶≤‡ßÅ)' : 'OFF (‡¶¨‡¶®‡ßç‡¶ß)'}
                        </button>
                      </div>

                      {/* 3. Header 3D Live Button Toggle */}
                      <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${adminShow3DButton ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                            <i className="fas fa-cube"></i>
                          </div>
                          <div>
                            <div className="text-xs font-black text-white">‡¶π‡ßá‡¶°‡¶æ‡¶∞‡ßá‡¶∞ 3D ‡¶≤‡¶æ‡¶á‡¶≠ ‡¶¨‡¶æ‡¶ü‡¶®</div>
                            <div className="text-[10px] text-slate-400">
                              {adminShow3DButton ? 'üßä ‡¶π‡ßá‡¶°‡¶æ‡¶∞‡ßá 3D ‡¶¨‡¶æ‡¶ü‡¶® ‡¶¶‡ßÉ‡¶∂‡ßç‡¶Ø‡¶Æ‡¶æ‡¶®' : 'üö´ ‡¶π‡ßá‡¶°‡¶æ‡¶∞‡ßá 3D ‡¶¨‡¶æ‡¶ü‡¶® ‡¶¶‡ßá‡¶ñ‡¶æ‡¶¨‡ßá ‡¶®‡¶æ'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickToggleFeature('show3DButton', !adminShow3DButton)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer active:scale-95 ${
                            adminShow3DButton
                              ? 'bg-cyan-400 text-slate-950 shadow-[0_0_12px_rgba(56,189,248,0.5)]'
                              : 'bg-red-500/30 text-red-300 border border-red-500/40'
                          }`}
                        >
                          {adminShow3DButton ? 'ON (‡¶ö‡¶æ‡¶≤‡ßÅ)' : 'OFF (‡¶¨‡¶®‡ßç‡¶ß)'}
                        </button>
                      </div>

                      {/* 4. Live Notice Ticker Toggle */}
                      <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${adminShowNoticeTicker ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                            <i className="fas fa-bullhorn"></i>
                          </div>
                          <div>
                            <div className="text-xs font-black text-white">‡¶π‡ßã‡¶Æ ‡¶®‡ßã‡¶ü‡¶ø‡¶∂ ‡¶ü‡¶ø‡¶ï‡¶æ‡¶∞ ‡¶¨‡¶æ‡¶∞</div>
                            <div className="text-[10px] text-slate-400">
                              {adminShowNoticeTicker ? 'üì¢ ‡¶®‡ßã‡¶ü‡¶ø‡¶∂ ‡¶¨‡¶æ‡¶∞ ‡¶ö‡¶æ‡¶≤‡ßÅ' : 'üö´ ‡¶®‡ßã‡¶ü‡¶ø‡¶∂ ‡¶¨‡¶æ‡¶∞ ‡¶≤‡ßÅ‡¶ï‡¶æ‡¶®‡ßã (OFF)'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickToggleFeature('showNoticeTicker', !adminShowNoticeTicker)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer active:scale-95 ${
                            adminShowNoticeTicker
                              ? 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                              : 'bg-red-500/30 text-red-300 border border-red-500/40'
                          }`}
                        >
                          {adminShowNoticeTicker ? 'ON (‡¶ö‡¶æ‡¶≤‡ßÅ)' : 'OFF (‡¶¨‡¶®‡ßç‡¶ß)'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Audio Mode Selection Tabs */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-2">
                      ‡¶≠‡¶Ø‡¶º‡ßá‡¶∏ ‡¶Æ‡ßá‡¶•‡¶° ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡ßÅ‡¶® (Select Voice Mode):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Option 1: Bangla TTS */}
                      <button
                        type="button"
                        onClick={() => setAdminAudioMode('tts')}
                        className={`p-3.5 rounded-2xl border text-left transition flex items-start gap-3 cursor-pointer ${
                          adminAudioMode === 'tts'
                            ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_20px_rgba(56,189,248,0.25)]'
                            : 'bg-slate-900/60 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${
                            adminAudioMode === 'tts' ? 'bg-cyan-500 text-slate-950 shadow' : 'bg-white/10 text-slate-300'
                          }`}
                        >
                          <i className="fas fa-comment-dots"></i>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-xs text-white">‡ßß. ‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ ‡¶ü‡ßá‡¶ï‡ßç‡¶∏‡¶ü-‡¶ü‡ßÅ-‡¶∏‡ßç‡¶™‡¶ø‡¶ö (TTS)</h4>
                            {adminAudioMode === 'tts' && (
                              <span className="text-[9px] bg-cyan-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            ‡¶®‡¶ø‡¶ö‡ßá ‡¶Ø‡¶æ ‡¶≤‡¶ø‡¶ñ‡¶¨‡ßá‡¶®, ‡¶∏‡ßç‡¶™‡¶ø‡¶ï‡¶æ‡¶∞ ‡¶∏‡ßç‡¶™‡¶∑‡ßç‡¶ü ‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ‡ßü ‡¶™‡ßú‡ßá ‡¶∂‡ßã‡¶®‡¶æ‡¶¨‡ßá
                          </p>
                        </div>
                      </button>

                      {/* Option 2: Custom Audio Upload / Record */}
                      <button
                        type="button"
                        onClick={() => setAdminAudioMode('custom')}
                        className={`p-3.5 rounded-2xl border text-left transition flex items-start gap-3 cursor-pointer ${
                          adminAudioMode === 'custom'
                            ? 'bg-purple-500/20 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.25)]'
                            : 'bg-slate-900/60 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${
                            adminAudioMode === 'custom' ? 'bg-purple-500 text-white shadow' : 'bg-white/10 text-slate-300'
                          }`}
                        >
                          <i className="fas fa-microphone-lines"></i>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-xs text-white">‡ß®. ‡¶ï‡¶æ‡¶∏‡ßç‡¶ü‡¶Æ ‡¶Ö‡¶°‡¶ø‡¶ì ‡¶Ü‡¶™‡¶≤‡ßã‡¶° / ‡¶≠‡ßü‡ßá‡¶∏ ‡¶∞‡ßá‡¶ï‡¶∞‡ßç‡¶°</h4>
                            {adminAudioMode === 'custom' && (
                              <span className="text-[9px] bg-purple-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            ‡¶®‡¶ø‡¶ú‡ßá‡¶∞ ‡¶∞‡ßá‡¶ï‡¶∞‡ßç‡¶° ‡¶ï‡¶∞‡¶æ MP3 ‡¶Ö‡¶°‡¶ø‡¶ì ‡¶´‡¶æ‡¶á‡¶≤ ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶¨‡¶æ ‡¶∏‡¶∞‡¶æ‡¶∏‡¶∞‡¶ø ‡¶∞‡ßá‡¶ï‡¶∞‡ßç‡¶° ‡¶ï‡¶∞‡ßÅ‡¶®
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* CUSTOM AUDIO UPLOAD & RECORDING CONTROLS (If custom mode is selected) */}
                  {adminAudioMode === 'custom' && (
                    <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30 space-y-4 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-purple-300 flex items-center gap-1.5">
                          <i className="fas fa-file-audio"></i>
                          <span>‡¶ï‡¶æ‡¶∏‡ßç‡¶ü‡¶Æ ‡¶Ö‡¶°‡¶ø‡¶ì ‡¶´‡¶æ‡¶á‡¶≤ ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶Ö‡¶•‡¶¨‡¶æ ‡¶≤‡¶æ‡¶á‡¶≠ ‡¶∞‡ßá‡¶ï‡¶∞‡ßç‡¶° ‡¶ï‡¶∞‡ßÅ‡¶®</span>
                        </span>
                        {adminCustomAudioUrl && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40 font-mono">
                            ‚úÖ ‡¶Ö‡¶°‡¶ø‡¶ì ‡¶∞‡ßá‡¶°‡¶ø
                          </span>
                        )}
                      </div>

                      {/* Dropzone & Live Recorder Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* 1. File Upload Dropzone */}
                        <div
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={handleAudioFileUpload}
                          className="relative p-4 rounded-xl border-2 border-dashed border-purple-400/40 hover:border-purple-400 bg-slate-900/60 flex flex-col items-center justify-center text-center transition group cursor-pointer"
                        >
                          <input
                            type="file"
                            accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.webm"
                            onChange={handleAudioFileUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                          />
                          <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-lg mb-2 group-hover:scale-110 transition">
                            <i className="fas fa-cloud-arrow-up"></i>
                          </div>
                          <p className="text-xs font-bold text-white">
                            {adminAudioUploading ? '‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶π‡¶ö‡ßç‡¶õ‡ßá...' : '‡¶Ö‡¶°‡¶ø‡¶ì ‡¶´‡¶æ‡¶á‡¶≤ ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü / ‡¶°‡ßç‡¶∞‡ßç‡¶Ø‡¶æ‡¶ó ‡¶ï‡¶∞‡ßÅ‡¶®'}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            ‡¶∏‡¶æ‡¶™‡ßã‡¶∞‡ßç‡¶ü‡ßá‡¶°: MP3, WAV, M4A, OGG (‡¶∏‡¶∞‡ßç‡¶¨‡ßã‡¶ö‡ßç‡¶ö ‡ß©MB)
                          </p>
                        </div>

                        {/* 2. Live Microphone Recorder */}
                        <div className="p-4 rounded-xl border border-white/10 bg-slate-900/60 flex flex-col items-center justify-center text-center">
                          {adminIsRecording ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
                                <span className="text-sm font-black text-red-400 font-mono">
                                  ‡¶∞‡ßá‡¶ï‡¶∞‡ßç‡¶°‡¶ø‡¶Ç ‡¶ö‡¶≤‡¶õ‡ßá... 00:{adminRecordingDuration < 10 ? `0${adminRecordingDuration}` : adminRecordingDuration}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={handleStopRecording}
                                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg active:scale-95 transition flex items-center gap-1.5 mx-auto cursor-pointer"
                              >
                                <i className="fas fa-stop"></i>
                                <span>‡¶∞‡ßá‡¶ï‡¶∞‡ßç‡¶°‡¶ø‡¶Ç ‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶® ‡¶ï‡¶∞‡ßÅ‡¶® (Stop)</span>
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-lg mx-auto">
                                <i className="fas fa-microphone"></i>
                              </div>
                              <p className="text-xs font-bold text-white">‡¶∏‡¶∞‡¶æ‡¶∏‡¶∞‡¶ø ‡¶Æ‡ßÅ‡¶ñ‡ßá ‡¶¨‡¶≤‡ßá ‡¶∞‡ßá‡¶ï‡¶∞‡ßç‡¶° ‡¶ï‡¶∞‡ßÅ‡¶®</p>
                              <button
                                type="button"
                                onClick={handleStartRecording}
                                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white font-bold text-xs shadow active:scale-95 transition flex items-center gap-1.5 mx-auto cursor-pointer"
                              >
                                <i className="fas fa-circle text-[8px] text-white animate-pulse"></i>
                                <span>‡¶≠‡¶Ø‡¶º‡ßá‡¶∏ ‡¶∞‡ßá‡¶ï‡¶∞‡ßç‡¶° ‡¶∂‡ßÅ‡¶∞‡ßÅ ‡¶ï‡¶∞‡ßÅ‡¶®</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Active Custom Audio Player Bar */}
                      {adminCustomAudioUrl && (
                        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-purple-500/40 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={handleTogglePlayCustomAudio}
                              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-base transition shadow cursor-pointer ${
                                adminAudioPlaying
                                  ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                                  : 'bg-purple-600 hover:bg-purple-500'
                              }`}
                            >
                              <i className={`fas ${adminAudioPlaying ? 'fa-pause' : 'fa-play ml-0.5'}`}></i>
                            </button>
                            <div>
                              <div className="flex items-center gap-2">
                                <h5 className="font-extrabold text-xs text-white truncate max-w-[200px] sm:max-w-[280px]">
                                  {adminAudioFileName || 'Uploaded Custom Audio Clip'}
                                </h5>
                                <span className="text-[9px] bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded font-mono">
                                  {adminAudioPlaying ? 'PLAYING' : 'AUDIO READY'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400">
                                {adminAudioPlaying ? '‡¶∏‡ßç‡¶™‡¶ø‡¶ï‡¶æ‡¶∞‡ßá ‡¶Ö‡¶°‡¶ø‡¶ì ‡¶¨‡¶æ‡¶ú‡¶õ‡ßá...' : '‡¶™‡ßç‡¶≤‡ßá ‡¶¨‡¶æ‡¶ü‡¶®‡ßá ‡¶ö‡¶æ‡¶™ ‡¶¶‡¶ø‡ßü‡ßá ‡¶™‡ßç‡¶∞‡¶ø‡¶≠‡¶ø‡¶â ‡¶∂‡ßÅ‡¶®‡ßÅ‡¶®'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleRemoveCustomAudio}
                              className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            >
                              <i className="fas fa-trash text-[10px]"></i>
                              <span>‡¶Ö‡¶°‡¶ø‡¶ì ‡¶Æ‡ßÅ‡¶õ‡ßÅ‡¶®</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Title Field */}
                  <div>
                    <label className="form-label flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold text-slate-200">
                        <i className="fas fa-heading text-cyan-400"></i>
                        <span>‡¶ì‡¶Ø‡¶º‡ßá‡¶≤‡¶ï‡¶æ‡¶Æ ‡¶ü‡¶æ‡¶á‡¶ü‡ßá‡¶≤ (Headline Title)</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡ßá‡¶∞ ‡¶¨‡ßú ‡¶π‡ßá‡¶°‡¶ø‡¶Ç</span>
                    </label>
                    <input
                      type="text"
                      className="input-modern font-bold text-sm text-cyan-300"
                      value={adminWelcomeTitle}
                      onChange={(e) => setAdminWelcomeTitle(e.target.value)}
                      placeholder="e.g. ‡¶ì‡¶Ø‡¶º‡ßá‡¶≤‡¶ï‡¶æ‡¶Æ RF SMM PANEL!"
                    />
                  </div>

                  {/* Speech & Announcement Textarea */}
                  <div>
                    <label className="form-label flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold text-slate-200">
                        <i className="fas fa-comment-dots text-amber-400"></i>
                        <span>
                          {adminAudioMode === 'custom'
                            ? '‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡ßá‡¶∞ ‡¶∏‡¶æ‡¶¨‡¶ü‡¶æ‡¶á‡¶ü‡ßá‡¶≤ ‡¶ü‡ßá‡¶ï‡ßç‡¶∏‡¶ü (Screen Subtitle Text)'
                            : '‡¶ì‡¶Ø‡¶º‡ßá‡¶≤‡¶ï‡¶æ‡¶Æ ‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ ‡¶≠‡¶Ø‡¶º‡ßá‡¶∏ ‡¶ì ‡¶Æ‡ßá‡¶∏‡ßá‡¶ú (Speech Voice & Subtitle Text)'}
                        </span>
                      </span>
                      <span className="text-[10px] text-amber-300 font-bold">
                        {adminAudioMode === 'custom' ? '‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡ßá ‡¶™‡ßç‡¶∞‡¶¶‡¶∞‡ßç‡¶∂‡¶ø‡¶§ ‡¶π‡¶¨‡ßá' : '‡¶∏‡ßç‡¶™‡¶ø‡¶ï‡¶æ‡¶∞‡ßá ‡¶†‡¶ø‡¶ï ‡¶è‡¶ü‡¶ø‡¶á ‡¶¨‡¶≤‡¶¨‡ßá'}
                      </span>
                    </label>
                    <textarea
                      rows={3}
                      className="input-modern text-sm font-medium leading-relaxed resize-none"
                      value={adminWelcomeText}
                      onChange={(e) => setAdminWelcomeText(e.target.value)}
                      placeholder="‡¶è‡¶ñ‡¶æ‡¶®‡ßá ‡¶Ø‡¶æ ‡¶≤‡¶ø‡¶ñ‡¶¨‡ßá‡¶®, ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶ï‡¶æ‡¶â‡¶®‡ßç‡¶ü‡ßá ‡¶¢‡ßã‡¶ï‡¶æ‡¶∞ ‡¶™‡¶∞ ‡ß©D ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡ßá ‡¶§‡¶æ ‡¶∏‡ßÅ‡¶®‡ßç‡¶¶‡¶∞‡¶≠‡¶æ‡¶¨‡ßá ‡¶≠‡ßá‡¶∏‡ßá ‡¶â‡¶†‡¶¨‡ßá..."
                    />
                    <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
                      <i className="fas fa-info-circle text-blue-400"></i>
                      <span>‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶ï‡¶æ‡¶â‡¶®‡ßç‡¶ü‡ßá ‡¶≤‡¶ó‡¶á‡¶® ‡¶ï‡¶∞‡¶≤‡ßá ‡¶¨‡¶æ ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶™‡ßá ‡¶¢‡ßÅ‡¶ï‡¶≤‡ßá ‡¶Æ‡¶æ‡¶§‡ßç‡¶∞ ‡ßß ‡¶¨‡¶æ‡¶∞ ‡¶è‡¶á ‡¶≠‡ßü‡ßá‡¶∏‡¶ü‡¶ø ‡¶∏‡ßç‡¶¨‡ßü‡¶Ç‡¶ï‡ßç‡¶∞‡¶ø‡ßü‡¶≠‡¶æ‡¶¨‡ßá ‡¶¨‡¶æ‡¶ú‡¶¨‡ßá‡•§</span>
                    </p>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 block mb-2">‡¶∞‡ßá‡¶°‡¶ø‡¶Æ‡ßá‡¶° ‡¶™‡ßç‡¶∞‡¶ø-‡¶∏‡ßá‡¶ü ‡¶Æ‡ßá‡¶∏‡ßá‡¶ú (Quick Templates):</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAdminWelcomeTitle('‡¶ì‡¶Ø‡¶º‡ßá‡¶≤‡¶ï‡¶æ‡¶Æ RF SMM PANEL!');
                          setAdminWelcomeText('‡¶ì‡¶Ø‡¶º‡ßá‡¶≤‡¶ï‡¶æ‡¶Æ ‡¶ü‡ßÅ ‡¶Ü‡¶∞ ‡¶è‡¶´ ‡¶è‡¶∏‡¶è‡¶Æ‡¶è‡¶Æ ‡¶™‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤‡•§ ‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ‡¶¶‡ßá‡¶∂‡ßá‡¶∞ ‡¶è‡¶ï ‡¶®‡¶Æ‡ßç‡¶¨‡¶∞ ‡¶∏‡ßã‡¶∂‡ßç‡¶Ø‡¶æ‡¶≤ ‡¶Æ‡¶ø‡¶°‡¶ø‡¶Ø‡¶º‡¶æ ‡¶Æ‡¶æ‡¶∞‡ßç‡¶ï‡ßá‡¶ü‡¶ø‡¶Ç ‡¶™‡ßç‡¶≤‡ßç‡¶Ø‡¶æ‡¶ü‡¶´‡¶∞‡ßç‡¶Æ‡ßá ‡¶Ü‡¶™‡¶®‡¶æ‡¶ï‡ßá ‡¶∏‡ßç‡¶¨‡¶æ‡¶ó‡¶§‡¶Æ‡•§');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
                      >
                        üåü ‡¶™‡ßç‡¶∞‡¶ø-‡¶∏‡ßá‡¶ü ‡ßß: ‡¶Ö‡¶´‡¶ø‡¶∏‡¶ø‡¶Ø‡¶º‡¶æ‡¶≤ ‡¶∏‡ßç‡¶¨‡¶æ‡¶ó‡¶§‡¶Æ
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAdminWelcomeTitle('RF SMM - ‡¶∏‡ßÅ‡¶™‡¶æ‡¶∞ ‡¶∏‡ßç‡¶™‡¶ø‡¶° ‡¶™‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤');
                          setAdminWelcomeText('‡¶ì‡¶Ø‡¶º‡ßá‡¶≤‡¶ï‡¶æ‡¶Æ ‡¶ü‡ßÅ ‡¶Ü‡¶∞ ‡¶è‡¶´ ‡¶è‡¶∏‡¶è‡¶Æ‡¶è‡¶Æ ‡¶™‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤‡•§ ‡¶Ö‡¶ü‡ßã‡¶Æ‡ßá‡¶ü‡¶ø‡¶ï ‡¶∏‡ßÅ‡¶™‡¶æ‡¶∞ ‡¶´‡¶æ‡¶∏‡ßç‡¶ü ‡¶°‡ßá‡¶≤‡¶ø‡¶≠‡¶æ‡¶∞‡¶ø ‡¶è‡¶¨‡¶Ç ‡ß®‡ß™ ‡¶ò‡¶®‡ßç‡¶ü‡¶æ ‡¶á‡¶®‡¶∏‡ßç‡¶ü‡ßç‡¶Ø‡¶æ‡¶®‡ßç‡¶ü ‡¶∏‡¶æ‡¶™‡ßã‡¶∞‡ßç‡¶ü‡ßá ‡¶Ü‡¶™‡¶®‡¶æ‡¶ï‡ßá ‡¶∏‡ßç‡¶¨‡¶æ‡¶ó‡¶§‡¶Æ‡•§');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
                      >
                        ‚ö° ‡¶™‡ßç‡¶∞‡¶ø-‡¶∏‡ßá‡¶ü ‡ß®: ‡¶∏‡ßÅ‡¶™‡¶æ‡¶∞ ‡¶´‡¶æ‡¶∏‡ßç‡¶ü ‡¶∏‡¶æ‡¶∞‡ßç‡¶≠‡¶ø‡¶∏
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAdminWelcomeTitle('‡¶ß‡¶æ‡¶Æ‡¶æ‡¶ï‡¶æ ‡¶Ö‡¶´‡¶æ‡¶∞ ‡¶ö‡¶≤‡¶õ‡ßá!');
                          setAdminWelcomeText('‡¶ì‡¶Ø‡¶º‡ßá‡¶≤‡¶ï‡¶æ‡¶Æ ‡¶ü‡ßÅ ‡¶Ü‡¶∞ ‡¶è‡¶´ ‡¶è‡¶∏‡¶è‡¶Æ‡¶è‡¶Æ ‡¶™‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤‡•§ ‡¶Ü‡¶Æ‡¶æ‡¶¶‡ßá‡¶∞ ‡¶™‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤‡ßá ‡¶ö‡¶≤‡¶õ‡ßá ‡¶Ö‡¶¨‡¶ø‡¶∂‡ßç‡¶¨‡¶æ‡¶∏‡ßç‡¶Ø ‡¶°‡¶ø‡¶∏‡¶ï‡¶æ‡¶â‡¶®‡ßç‡¶ü ‡¶Ö‡¶´‡¶æ‡¶∞‡•§ ‡¶è‡¶ñ‡¶®‡¶á ‡¶Ö‡¶∞‡ßç‡¶°‡¶æ‡¶∞ ‡¶ï‡¶∞‡ßÅ‡¶®!');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
                      >
                        üî• ‡¶™‡ßç‡¶∞‡¶ø-‡¶∏‡ßá‡¶ü ‡ß©: ‡¶ß‡¶æ‡¶Æ‡¶æ‡¶ï‡¶æ ‡¶Ö‡¶´‡¶æ‡¶∞
                      </button>
                    </div>
                  </div>

                  {/* Home Live Notice Ticker Text Area inside Welcome Tab */}
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="form-label mb-0 flex items-center gap-1.5 font-bold text-amber-300">
                        <i className="fas fa-bullhorn text-amber-400"></i>
                        <span>‡¶π‡ßã‡¶Æ ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶≤‡¶ø‡¶Ç ‡¶®‡ßã‡¶ü‡¶ø‡¶∂ ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶® (Home Live Notice Ticker)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleSaveNoticeText()}
                        disabled={adminSavingNotice}
                        className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-black transition cursor-pointer active:scale-95 shadow"
                      >
                        {adminSavingNotice ? '‡¶∏‡ßá‡¶≠ ‡¶π‡¶ö‡ßç‡¶õ‡ßá...' : 'üíæ ‡¶®‡ßã‡¶ü‡¶ø‡¶∂ ‡¶∏‡ßá‡¶≠'}
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      className="input-modern text-xs font-medium resize-none border-amber-500/30 focus:border-amber-400"
                      value={adminNoticeText}
                      onChange={(e) => setAdminNoticeText(e.target.value)}
                      placeholder="‡¶π‡ßã‡¶Æ ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶®‡ßá‡¶∞ ‡¶®‡ßã‡¶ü‡¶ø‡¶∂ ‡¶¨‡¶æ‡¶∞‡ßá ‡¶Ø‡¶æ ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶≤ ‡¶ï‡¶∞‡¶¨‡ßá..."
                    />
                    <p className="text-[10px] text-slate-300">
                      üí° ‡¶è‡¶ü‡¶ø ‡¶∏‡¶∞‡¶æ‡¶∏‡¶∞‡¶ø ‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶™‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤‡ßá‡¶∞ ‡¶â‡¶™‡¶∞‡ßá ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶®‡¶ø‡¶Æ‡ßá‡¶ü‡ßá‡¶° ‡¶π‡ßü‡ßá ‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶≤ ‡¶ï‡¶∞‡¶¨‡ßá‡•§
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-3 border-t border-white/10 flex flex-wrap items-center gap-3">
                    {/* Save Button */}
                    <button
                      onClick={handleSaveWelcomeConfig}
                      disabled={adminSavingWelcome}
                      className="flex-1 min-w-[180px] py-3 px-5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 text-white font-extrabold text-xs sm:text-sm shadow-lg hover:brightness-110 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {adminSavingWelcome ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i>
                          <span>‡¶∏‡ßá‡¶≠ ‡¶π‡¶ö‡ßç‡¶õ‡ßá...</span>
                        </>
                      ) : (
                        <>
                          <i className="fas fa-save text-emerald-300"></i>
                          <span>üíæ ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶® ‡¶∏‡ßá‡¶≠ ‡¶ï‡¶∞‡ßÅ‡¶® (Save Settings)</span>
                        </>
                      )}
                    </button>

                    {/* Test Voice / Audio Button */}
                    {adminAudioMode === 'custom' && adminCustomAudioUrl ? (
                      <button
                        onClick={handleTogglePlayCustomAudio}
                        className="py-3 px-4 rounded-xl bg-purple-900/80 hover:bg-purple-800 text-purple-200 border border-purple-500/40 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition active:scale-95 shadow cursor-pointer"
                      >
                        <i className={`fas ${adminAudioPlaying ? 'fa-pause' : 'fa-play'} text-amber-300`}></i>
                        <span>{adminAudioPlaying ? '‡¶Ö‡¶°‡¶ø‡¶ì ‡¶•‡¶æ‡¶Æ‡¶æ‡¶®' : 'üéµ ‡¶Ö‡¶°‡¶ø‡¶ì ‡¶´‡¶æ‡¶á‡¶≤ ‡¶∂‡ßÅ‡¶®‡ßÅ‡¶®'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleTestSpeech(adminWelcomeText)}
                        className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition active:scale-95 shadow cursor-pointer"
                      >
                        <i className="fas fa-play text-amber-300"></i>
                        <span>üîä TTS ‡¶≠‡¶Ø‡¶º‡ßá‡¶∏ ‡¶∂‡ßÅ‡¶®‡ßÅ‡¶®</span>
                      </button>
                    )}

                    {/* Fullscreen 3D Test */}
                    <button
                      onClick={() => setShowWelcomeModal(true)}
                      className="py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white border border-purple-400/30 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition active:scale-95 shadow cursor-pointer"
                    >
                      <i className="fas fa-cube text-cyan-300"></i>
                      <span>üéâ ‡ß©D ‡¶´‡ßÅ‡¶≤‡¶∏‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡¶® ‡¶™‡ßç‡¶∞‡¶ø‡¶≠‡¶ø‡¶â</span>
                    </button>
                  </div>
                </div>
              )}

              {/* SUB TAB 7: SETTINGS & BACKUP */}
                            {/* SUB TAB: TELEGRAM LIVE ORDER NOTIFICATION & CHANNELS */}
              {adminSubTab === 'telegram' && (
                <div className="space-y-4">
                  <div className="glass-card p-5 space-y-5 border border-sky-500/40 bg-gradient-to-br from-sky-950/40 via-slate-900/90 to-slate-900/90 shadow-[0_4px_30px_rgba(14,165,233,0.18)] rounded-2xl">
                    {/* Header & Main Toggle Switch */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-sky-500/30">
                          <i className="fab fa-telegram-plane"></i>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-black text-base text-white">
                              ‡¶ü‡ßá‡¶≤‡¶ø‡¶ó‡ßç‡¶∞‡¶æ‡¶Æ ‡¶ö‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤ ‡¶≤‡¶æ‡¶á‡¶≠ ‡¶Ö‡¶∞‡ßç‡¶°‡¶æ‡¶∞ ‡¶¨‡ßç‡¶∞‡¶°‡¶ï‡¶æ‡¶∏‡ßç‡¶ü
                            </h3>
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
                              adminTelegramEnabled
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-red-500/20 text-red-300 border-red-500/40'
                            }`}>
                              <span className={`w-2 h-2 rounded-full ${adminTelegramEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></span>
                              {adminTelegramEnabled ? '‡¶≤‡¶æ‡¶á‡¶≠ ‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡ßü (ON ‚ö°)' : '‡¶¨‡¶®‡ßç‡¶ß ‡¶∞‡ßü‡ßá‡¶õ‡ßá (OFF ‚õî)'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1">
                            ‡¶ì‡ßü‡ßá‡¶¨‡¶∏‡¶æ‡¶á‡¶ü‡ßá ‡¶ï‡ßã‡¶®‡ßã ‡¶ï‡¶æ‡¶∏‡ßç‡¶ü‡¶Æ‡¶æ‡¶∞ ‡¶Ö‡¶∞‡ßç‡¶°‡¶æ‡¶∞ ‡¶ï‡¶∞‡¶æ‡¶∞ ‡¶∏‡¶æ‡¶•‡ßá ‡¶∏‡¶æ‡¶•‡ßá‡¶á ‡¶Ü‡¶™‡¶®‡¶æ‡¶∞ ‡¶ü‡ßá‡¶≤‡¶ø‡¶ó‡ßç‡¶∞‡¶æ‡¶Æ ‡¶ö‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤‡ßá ‡¶∏‡¶Æ‡ßç‡¶™‡ßÇ‡¶∞‡ßç‡¶£ ‡¶Ö‡¶ü‡ßã‡¶Æ‡ßá‡¶ü‡¶ø‡¶ï ‡¶™‡ßã‡¶∏‡ßç‡¶ü ‡¶Ø‡¶æ‡¶¨‡ßá‡•§
                          </p>
                        </div>
                      </div>

                      {/* Fast Switch Toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          const nextState = !adminTelegramEnabled;
                          setAdminTelegramEnabled(nextState);
                          haptic('light');
                          showToast(nextState ? '‚ö° ‡¶ü‡ßá‡¶≤‡¶ø‡¶ó‡ßç‡¶∞‡¶æ‡¶Æ ‡¶®‡ßã‡¶ü‡¶ø‡¶´‡¶ø‡¶ï‡ßá‡¶∂‡¶® ‡¶ö‡¶æ‡¶≤‡ßÅ ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá (Save ‡¶ï‡¶∞‡ßÅ‡¶®)' : '‚õî ‡¶ü‡ßá‡¶≤‡¶ø‡¶ó‡ßç‡¶∞‡¶æ‡¶Æ ‡¶®‡ßã‡¶ü‡¶ø‡¶´‡¶ø‡¶ï‡ßá‡¶∂‡¶® ‡¶¨‡¶®‡ßç‡¶ß ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá (Save ‡¶ï‡¶∞‡ßÅ‡¶®)', nextState ? 'success' : 'warning');
                        }}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black transition active:scale-95 flex items-center gap-2 cursor-pointer ${
                          adminTelegramEnabled
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-400'
                            : 'bg-slate-800 text-slate-300 border border-white/10 hover:bg-slate-700'
                        }`}
                      >
                        <i className={`fas ${adminTelegramEnabled ? 'fa-toggle-on text-lg' : 'fa-toggle-off text-lg text-slate-500'}`}></i>
                        <span>{adminTelegramEnabled ? '‡¶®‡ßã‡¶ü‡¶ø‡¶´‡¶ø‡¶ï‡ßá‡¶∂‡¶® ‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡ßü (ON)' : '‡¶®‡ßã‡¶ü‡¶ø‡¶´‡¶ø‡¶ï‡ßá‡¶∂‡¶® ‡¶¨‡¶®‡ßç‡¶ß (OFF)'}</span>
                      </button>
                    </div>

                    {/* Channel & Bot Configuration Form */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Bot Token Input */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-extrabold text-white flex items-center gap-1.5">
                            <i className="fas fa-robot text-sky-400"></i>
                            <span>‡¶ü‡ßá‡¶≤‡¶ø‡¶ó‡ßç‡¶∞‡¶æ‡¶Æ ‡¶¨‡¶ü ‡¶ü‡ßã‡¶ï‡ßá‡¶® (Telegram Bot Token)</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setAdminTelegramBotToken('8417495766:AAEupqJEr6_IyvOcGXhhdWStj95khUdr8MU');
                              showToast('‡¶°‡¶ø‡¶´‡¶≤‡ßç‡¶ü ‡¶¨‡¶ü ‡¶ü‡ßã‡¶ï‡ßá‡¶® ‡¶∏‡ßá‡¶ü ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá', 'info');
                            }}
                            className="text-[10px] text-sky-400 hover:text-sky-300 underline font-semibold"
                          >
                            Default ‡¶∞‡¶ø‡¶∏‡ßç‡¶ü‡ßã‡¶∞
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={adminShowBotToken ? 'text' : 'password'}
                            value={adminTelegramBotToken}
                            onChange={(e) => setAdminTelegramBotToken(e.target.value)}
                            placeholder="e.g. 8417495766:AAEupqJEr6_IyvOcGXhhdWStj95khUdr8MU"
                            className="input-modern font-mono text-xs pr-10 w-full"
                          />
                          <button
                            type="button"
                            onClick={() => setAdminShowBotToken(!adminShowBotToken)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                            title={adminShowBotToken ? '‡¶π‡¶æ‡¶á‡¶° ‡¶ï‡¶∞‡ßÅ‡¶®' : '‡¶¶‡ßá‡¶ñ‡¶æ‡¶®'}
                          >
                            <i className={`fas ${adminShowBotToken ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          ‡¶ü‡ßá‡¶≤‡¶ø‡¶ó‡ßç‡¶∞‡¶æ‡¶Æ‡ßá‡¶∞ <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-sky-400 underline font-bold">@BotFather</a> ‡¶•‡ßá‡¶ï‡ßá ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶¨‡¶ü‡ßá‡¶∞ HTTP API Token ‡¶¶‡¶ø‡¶®‡•§
                        </p>
                      </div>

                      {/* Channels Input */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-extrabold text-white flex items-center gap-1.5">
                          <i className="fas fa-bullhorn text-sky-400"></i>
                          <span>‡¶ü‡¶æ‡¶∞‡ßç‡¶ó‡ßá‡¶ü ‡¶ö‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤‡¶∏‡¶Æ‡ßÇ‡¶π (Channels List)</span>
                        </label>
                        <input
                          type="text"
                          value={adminTelegramChannels}
                          onChange={(e) => setAdminTelegramChannels(e.target.value)}
                          placeholder="@RF2_SMM, @FARJU_SMM_PANAL, @YourNewChannel"
                          className="input-modern font-mono text-xs w-full"
                        />
                        <p className="text-[10px] text-slate-400">
                          ‡¶è‡¶ï‡¶æ‡¶ß‡¶ø‡¶ï ‡¶ö‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤ ‡¶ï‡¶Æ‡¶æ (,) ‡¶¶‡¶ø‡ßü‡ßá ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶®‡•§ ‡¶Ø‡ßá‡¶Æ‡¶®: <code className="text-sky-300 font-mono">@RF2_SMM, @FARJU_SMM_PANAL</code>
                        </p>
                      </div>
                    </div>

                    {/* Banner Image URL */}
                    {/* Custom Banner Image / Direct Photo Upload */}
                    <div className="space-y-2 p-3 rounded-xl bg-slate-950/60 border border-white/5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs font-extrabold text-white flex items-center gap-1.5">
                          <i className="fas fa-image text-sky-400"></i>
                          <span>‡¶ü‡ßá‡¶≤‡¶ø‡¶ó‡ßç‡¶∞‡¶æ‡¶Æ ‡¶®‡ßã‡¶ü‡¶ø‡¶´‡¶ø‡¶ï‡ßá‡¶∂‡¶® ‡¶¨‡ßç‡¶Ø‡¶æ‡¶®‡¶æ‡¶∞ / ‡¶≤‡ßã‡¶ó‡ßã ‡¶õ‡¶¨‡¶ø (Banner Photo)</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="direct-tg-photo-input-settings"
                            className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-[11px] font-bold cursor-pointer flex items-center gap-1 transition active:scale-95"
                          >
                            <i className="fas fa-upload text-xs"></i>
                            <span>‡¶ó‡ßç‡¶Ø‡¶æ‡¶≤‡¶æ‡¶∞‡¶ø ‡¶•‡ßá‡¶ï‡ßá ‡¶∏‡¶∞‡¶æ‡¶∏‡¶∞‡¶ø ‡¶Ü‡¶™‡¶≤‡ßã‡¶°</span>
                          </label>
                          <input
                            type="file"
                            id="direct-tg-photo-input-settings"
                            accept="image/*"
                            className="hidden"
                            onChange={handleTelegramPhotoUpload}
                          />
                          {adminTelegramPhotoUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                setAdminTelegramPhotoUrl('');
                                setUploadedTelegramPhotoInfo(null);
                                showToast('‡¶ü‡ßá‡¶≤‡¶ø‡¶ó‡ßç‡¶∞‡¶æ‡¶Æ ‡¶ï‡¶æ‡¶∏‡ßç‡¶ü‡¶Æ ‡¶¨‡ßç‡¶Ø‡¶æ‡¶®‡¶æ‡¶∞ ‡¶ï‡ßç‡¶≤‡¶ø‡ßü‡¶æ‡¶∞ ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá', 'info');
                              }}
                              className="text-[10px] text-red-400 hover:text-red-300 underline font-semibold"
                            >
                              ‡¶ï‡ßç‡¶≤‡¶ø‡ßü‡¶æ‡¶∞
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 items-center">
                        {adminTelegramPhotoUrl && (
                          <div className="w-16 h-16 rounded-xl bg-slate-900 border border-sky-400/40 p-1 flex items-center justify-center overflow-hidden flex-shrink-0">
                            <img
                              src={adminTelegramPhotoUrl}
                              alt="Telegram Banner Preview"
                              className="w-full h-full object-cover rounded-lg"
                            />
                          </div>
                        )}
                        <div className="flex-1 w-full space-y-1">
                          <input
                            type="text"
                            value={adminTelegramPhotoUrl}
                            onChange={(e) => setAdminTelegramPhotoUrl(e.target.value)}
                            placeholder="‡¶õ‡¶¨‡¶ø‡¶∞ ‡¶°‡¶æ‡¶á‡¶∞‡ßá‡¶ï‡ßç‡¶ü ‡¶≤‡¶ø‡¶ô‡ßç‡¶ï ‡¶Ö‡¶•‡¶¨‡¶æ ‡¶â‡¶™‡¶∞‡ßá‡¶∞ ‡¶¨‡¶æ‡¶ü‡¶® ‡¶¶‡¶ø‡ßü‡ßá ‡¶ó‡ßç‡¶Ø‡¶æ‡¶≤‡¶æ‡¶∞‡¶ø ‡¶•‡ßá‡¶ï‡ßá ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶ï‡¶∞‡ßÅ‡¶®"
                            className="input-modern text-xs w-full font-mono"
                          />
                          {uploadedTelegramPhotoInfo && (
                            <div className="text-[10px] text-emerald-300 font-mono">
                              ‚úÖ ‡¶Ü‡¶™‡¶≤‡ßã‡¶°‡¶ï‡ßÉ‡¶§ ‡¶õ‡¶¨‡¶ø: {uploadedTelegramPhotoInfo.name} ({uploadedTelegramPhotoInfo.size})
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Live Channel Badges */}
                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                          <i className="fas fa-satellite-dish text-sky-400"></i>
                          <span>‡¶¨‡¶∞‡ßç‡¶§‡¶Æ‡¶æ‡¶® ‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡¶Ø‡¶º ‡¶ü‡¶æ‡¶∞‡ßç‡¶ó‡ßá‡¶ü ‡¶ö‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤ ({
                            adminTelegramChannels.split(",").filter(c => c.trim().length > 0).length
                          } ‡¶ü‡¶ø):</span>
                        </span>
                        <span className="text-[10px] text-amber-400 font-semibold">
                          ‚ö†Ô∏è ‡¶¨‡¶ü‡¶ï‡ßá ‡¶Ö‡¶¨‡¶∂‡ßç‡¶Ø‡¶á ‡¶ö‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤‡ßá‡¶∞ ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶°‡¶Æ‡¶ø‡¶® (Post MessaxúÏ}ys«ïÁˇ˚)R∞,4ltçÉÜ†íÄõ0 (Ì,Õ ›tâ›]=U’aco»\á¬£ù±9ﬁï¡—Er)ÍXNÑñäÿ∞æ
C_`Ù6_UôUyUwÉ¢,√I‘ôï˘Ú›Ô˜ˆ¸x=ªˇËŸ˝??ªˇ≈≥˚ü=ªˇı≥˚_>ªˇΩO~y¯üêÊÁÃT‹Û∫g5ÁœL5ÉõgˇìÓ,>âm/é◊ºéø8∂€ˆo!¯£∫y=¥Áı™3c∫G#tË5;Aw€o˚{ë◊9ﬂÚ∫]øk/G®˜⁄ARõõ0]’ÒzïZ<ãµ$
:ï	„’ªA;Ò#~C€ÔÓ%-tM[_Qi¥&Q–º5wÆF®v„ÌÜQ«KøyæÖQ£Uã/J‚∑Ç§Um|˝ÍW˘£U|ÙU|-†ÎØΩ|ÿh]ˇá7ÒFß‡o_öüÀì⁄A˜~J˙¿W—ıVíÙ‚Ö©©§÷Òß^>_˘Ω∂◊·Èìh||‚Ë:¯¯è∆Õoä¸§uQ≈x•6À%›Ò¢YØÃ”mê¯ù∏⁄ªòÈ÷kÛ®w@ˇ∫UùEQÿÔ6˝fµΩávˆ™ÒçÉÍ¸ÙÙT}ÌÑQﬂCˇJOÃN£ƒøïêﬂgßŸ/∑bº ›§⁄	ª!˝◊NÿnéY´ﬂBÈ‹“˜x;h◊´&lg±qt∆Œûô
Ïœ:€∂&‰›jE˛Ó‚!– ¬4∂Á'ãc◊v⁄^˜∆^›ˆ‚X7ƒW¯Q‰Gc‚@[·M?ZÄiçÕ>“,ÑÅáH!úL$»#3wÀ›ûõ√ÊœúuΩv>ÆÍµ:ôWN˜n]uúO‡¢û˝≤	ºUú¶{Øú∞Ì
∆Óçœ0ÌÂ#√‘‹^`È9NLY∑»ê˘ø—4zÂ„tëiîÔ?ÚwÑ˜ÒﬁîA‚aB;˚Ï˛ùgﬁ≈rˇâÖÊ˚œ¸˛Ÿ˝œâ@≈án?ªˇ¡Ô~M.ƒÁÓ!¯H€?#~ÕÌgﬂ≥-ÖvÇSo¬áS?AkaÏ/	¬.⁄J0©Ó°W–≈‡¶è6"ˇf‡Ô£üL©_ú·xÙøzPùC=¸gy∑⁄ÑÂµΩƒØûûüû:9≠az3”(nyÕpø‡Âç¥W©9HˇÌ~åøÍ†∫„'˚æﬂ5∞Ä3mo«o´ñö2X,ën–Uﬂo·WËòLmﬁ»fî‹°ÁÜ®∑2fèÈ  Ë&¶ÙˆÏ˛]¢£}B˛ºCHâ)oO	≠›%t»à¯øè»ïÚ√QE"ÅÌñﬂÒ	!¯6z<3EfœpÅr]©Oc( ¡ôú∏KÖœ*JßÒ_ú§v˚Ì∂VrWBf$‰3	KøÙ∆±ÃˇˆÓ?˝zsu-ﬂÚ˝oÉqÃ[uw·£A«k≥;ˇpùo˚¯ã/Ò√XÅ˘Ê˝è–˘É<“ûé§—◊ÛπajÿÕthxﬂ∆~Ç∂xIi˜oq+ÌEA¡’Fÿé´uw≤_g©Vn$vÖ4}Ü∑„˜ÔÙì$Ï,9Ë·q—ÀL™Nÿ=èôÒç≈√
U©ûÅ•¬™U»:O¸jyΩ$hT∆€¡^+ÅG&ÒñÕ–·ıû†Õ›J©êêo€ﬂ≈">Ú∫q@ˆ÷^<2ç~áQµÑeºlV¯M$jë¡òUÍ%g-"'c¨+§Ï_È]”∂∑,–∑PééÔ8¡9:}Ù‘<€Õ‰x-U’§kfåo9∫Æ_#k,+Pg«™"∏X∆ûRa°5DæfUEïr¢Ö˚]˙ØÉ˘àìåÄiöø–A4sN¨P©ﬂÚ7™ç j‡ÀE)«ßé~âiÛYı 3=ùà»ƒ
ÊÕM¨ﬁTÿÙñ≈xvˇ∑œÓ? J€C*[âóDÍ nπ†%rdÎrﬂÙ;,t'xR®R»Ò#r˛)‚⁄‚GL”≥O“wP˘¸)óœ1«Ã«˜åS‘3Ii =µÇÉ2mIrÿz±¯6ó¥ﬂSﬁÕáˇW˛˝}‰ﬂX%éºvspæÎ{Iœ]Í‡OtÂÂ“Ó<>^ûÍ≥Å¸¸a…øÁ\úË‘ øãO?&ºûrÒªî◊ﬂ%ø<L/v˝	πÌizÏ¬Æ?"W>&ˇ¶¨úòe«œ¥âa±ÊcÜıb±ÎÏ˚ ¨È‡ˇ ™øè¨∫◊èzmpNçàâ¬kKOsÊ“íù|löË_"ì˛äÍΩU`†¿RA#æÀT``π4<ôi›T[~*3ı˜S’ö)—èÈ(˚˛ÇÀzÒ›ëpi„,6ÁÒ	;Ë<Iòr^A+a$Ω⁄Ìıìxdéõ≤GfQ/1Ó@ù?◊ºk5.‘+ı:PCngt1å◊ñºñyAÔà/-!¢ôÂÑË]ÊéØ∞˘ﬁ7g˙∂‚7ûŒ¸<0äg˜ˇ;è|@Õ:˚¨ÆT`W@∆QR)„1GozÌ>±{°SbÚ`ÈﬂÚ∫{¯÷äO‰^˙”áT¸‰’»ã,ë#ıma
Ò£≈1æ£?!™,ÈÍ⁄Ú[h}Û¬Ú&⁄ÿ\?øºµµ|éõ?SX.2w’Nà_“ME…>u$ç±2az⁄îâyÂ_ Æ˙Ñ(»w”]ıò9C§h◊Ô˘˛U/€ˆˆ˛∫≈»Ó†2‰£Ò#QèÕ¥uÈ⁄XZ[æàæ˘áˇÖ•Púx›≠xqÇ.¯m¨aG/˛ñ≥K›MﬂkW∑Ééè¯¨¢K~{{>∫6nÙ{÷–gq[w∞Ö∏Áï’OŒ‘gvÆÊ‚UW~4≥3?sÚ‘’©˘4Ï9Éo·‹a6õ#ë˙gåzmyùº∑Éï6§•iq+Œôf∂eÅ-±Kıî˝ÍI‘¬ˇ…ÒøΩ*^πfÄ[M¬j°›(Ïp€
·C;xgTOπ"˚U0÷Ò_∫<V{bs≈¢Ò[Û#ŒXØPÃ∞,
r1pNKX_YY=ø∫t—5cd€Ñ⁄N∆ñ√|gK-SÊ®LQgn<·⁄„ßbÄ˙ËÒüø#¨Úgòû–Z∏Ô≤»V” zÅ)¨.Õ)ÛP@⁄≈âiLœÖ“QÙS‘Õê¶öYàÂ‚ÍõÀX)[~su˘-„GŸr	LLõ≤ÌçVòÑ(ÿEΩ(º¿ËMNØ√ä$|…Õó£6$Jí[x_\˜B8∞Ô∑a«?vwÉΩZÃŒLXÛÑ
|äp¶éw´⁄™ŒùB‡ãŸmcŒﬁ
öMÃm≈,@iﬁ)«≠ì#<gjŒÊø8tˆ,ƒGçú2¿$ÿ“æºv≤8ñä—çÔ&<môâ≈âk—ø¬ù∑˝FÇMW<}ÊáTÎ>¬:ìë⁄VxíVn•Övº
ª(&˛£€5GDòˆÎ'fÍWQ/ó™†áyT–˘IÓß¨§Çﬁ¬c#7S=¢˘4ù:&π UØ›,=FHt1Áû±rdãã/ÕÇ"˘4ÎdV~t˙‘\}Ü±¬oO¡sÀc*bFëπˆWÁS>vvÎÚy∞#›ÑŸ·ÿ/∫ﬂ¸Ò◊C˛ˇ›1€n"ﬂ∂svÀèn·Ã‘ŒY¨~7¸ù0ºÅ6@A]	€ò£¯Qå~ÖﬁˆZh´Á„E«∆0“ı€ƒx†œWãì4gÅßlÔ≤a‘0ìòävkqßSwwÉF‡µŸ,ñ¡ﬂˆ±i$tı…iºBøÇœ¸˚¸|mzéóy‡˘6®Ç| ¢∑˚àÿMe±ïxI?¶èÿà¬∂	 ≤Ï‹b√Ç>„∞ã∆ºO+µ$º6º∂g∑í?∑2Ów´ó∑∆'—!jÖ˝hçœTõ¡^ê‡Cx‰˝ƒA~¨”(«û•®Ü¶√‘*ﬁ®Ã`ñ£Çgå©ôK˝$ƒ,SÛ÷Aåï÷1ß‰‰3F!0a»ﬁcnÙcgib¶„¬Í÷∆“ˆ˘7òKKbo/
'∫≤µº˘ÊÍ˘Â´@“Æ,»yœ^Ÿ^⁄|}y˚™Nô√8£f@Wñ.≠_^#Ôﬁ9KœÂnêƒdÀV8˚ôp{÷˘ã´À‰YeYŒï≠Ì•ÌÀ[¯N âå€8NﬂÍ%º2¯ÁÀbD
)¡clﬁ≠±úcÊ(4ê|ª ã/~∑…{ÓX¸Ò‹xŒ∑w˚GÿîTÎ[ΩÄêFCë#ÔRÓ∏¨ÂI¨’â∂â⁄ô©`(√1p¡oÔæ˜ˇ„È{D{¡[x/å¯Î“w±qƒé¸«œ3ı!ÌØä˜Ì›?J:û0áÑﬂñò†˛Ó⁄àËR*≠&~{˜üÓezbˆ¨“∫"ﬁP©Æhõb—˛»JˆŒ  eIÚ|á+ô®rÓ¬˙´™…UM≈xÅ‰Ä©Œ√ÓÌZÌí≤∆s$√ ÊÅâ2˛Ü\R Õò±eü£(d•°¬8ë/ÈJO=ô}Ô¿äÃ±¯˘ˆÓˇL*ÊÓﬂ£ôŸ¯ówx2ã˜ì⁄:r~(/Îã;ˇ¸Ω’Úíx©◊K”\ë¨r:wˇnó»ö·îÚPÛ·>ZM–[at#FØ˜É¶ﬁuVòxM1!8™ÁÚsŒ=g<é6£äbô≤√Œ¥Ê
äæ3Údï:ÿnn)C"Aw7dK‡#ãŒ?¯^#¯ŸÉ€¥åÄ$∏@¬£¥æÙ1Õ`}’VW÷ö”û•$®®6˝8˘%Ë∆∞òiVÉDÎö\0Ê©4÷eg”|g˘èº¸ô‰o›∆ìëDawÔÏkÁ¬dÖ§W„Ø§á˜øá‡|#…‚Eg!§Vö¬“s'LŒL¡egÁø–π˝-¡«x(d>∞åa(J_B¸./√|HWﬂ˘µƒìH°o€¥ ‰€Û/’ŒÖ∫‰òéáBØÏ%ìN+ü∆öeí‡’à≥iì.#^·»K¬HQì™N˘πWÕù¬≥≥Ò~îNN∂§$ä¿"Ú±¯d#Lâ„ƒ™'ãéÚ6)ﬂ˘êøÖû˛UH˝ˆmÚ⁄á6bzÌÔ∞Ü≈&Œ3™òïﬂëO¯"}ﬂˇ`.kÔë)˚M:%cf
H∑?§ﬁ–2#zËSâˆ∆ƒ…|ÃÚ…g"ûüU"ï&Ÿ˜»à‡ã√Œ2Ê-eÀtâˇï.èqºÔSπ«	ÄÔ¡˜”ƒ—ÏL{Ñ
Œl|,áî%±ôI≥NÕ3qf*‘$Ÿ‰#SÛ–ñw”GØ†mﬂPÇe¡Œ1f|§ô†z9e+p+h±∑”ˆõ,âø3ÆóÎïÿ¥¬¿ã∫T±"‰)˘ï$Í˚Fºâ€.»;X4–ê(∂ÆºÖ4càCãñg ‰w…4‰‹–ÀÙË§Âf,î∂√~7w˜9vX0l∆OÕ’OŒùû?y‚ƒ¬““rø˜˜?[éN\[=∏πﬁx˝?∑ZÕ∑∂í∑Oœﬂh]nFß.]∑Ωπ¡@6roN±7Ñ7ø∂π2sUìËµï•Õü]Ü_√÷“E˚[H˛3KÁﬁ≈ãÔ≤?
N¬.qÛ´\ˇn#¢~¥‹˝ísÕÌ9‘˛Ã=G2Jmœ!åı¸‚Ï\JOàÛ#,mÆ–•ÿ\øvn}˚U·‰ızãßÊNûû;1Í‰iÀtô¡óº}/H`^ï&¸∑3â∆c¶W åá∫÷ €e|bRﬁO‡êË¯—^*ÿ∞Ë»,Öü-o¿äÙ8À›º)Ó7¿˝bC±ä[·˛vË≈Ie¸õﬂ±Ë`v4é¢Ä¶9ò*E>€"Ê+^ãÚË%òWß/8¬õ!i¥P≈èÄª/l˚5|}U∆ó·/æäR@(∫íx¯2˜,~Ÿ=˙¡˜x1Õ.˛zç£ü¬≥1.êÌcw°nßmcÍq±Îµc≥º–ã,CIõË≥N∫’ﬁ®^tê&.B6÷u*ÃÂ2¡⁄‘ò˘2∑\&$KÑ“! 2Åú◊iÖòtIV8∆/úÁ	yb§P¡&ÁZËî |üºñ@¨%h¢4≠„Å‚ˇt»+‰&vF¨_â `≠Vs…47dYÇCÉ|•òSY‚G`O†
QWπ%ÈêÁoú=æï•ˆX4VP¡èWeÕΩ¡Æ≥J¸‘Ë)⁄]y;G2¥(tYû‘A“Äw Ãy]È»è{X_¶J√Æè%Se| ÎS\¥LQ^® VaSç¸§b≈z|c}k€™∂àˆÜıŸC4é5Ü∏Â6¶ãq¸ ¨µ÷‘€qÿGGvÕºy∞Ä~∂µæVãIåèπb1¶¯ƒUÙˆÚ÷vD›%/i’v€!πıi¯·«"Ø€A±˚	:MNXïE¨íıÇıÙ$¯iù†Gc¶ÇÔrs:<∏¡¢ö‚Sy@”·ˆøÁ9b&∆·uaú, ⁄ØL∆ÖL_6Ö>F⁄«SHßÀÊì÷e|‡’Ê(Ω∂w gàv.ƒ∫‹ÒÇvÓ©>#œ€ÖÁΩ∂ø√¿]ñö¶∏·=#Ö ]÷2Ú!7k	œ∞k\›ZgAFÚ‰Y≈KØD^≤õ5ËjA;|æì=lNÍ fÔ≤ÉÜ3gGg–éŒ§˝éçZÄ5[ΩNË∆Õ$f Ÿj 7*ñ;É]Ti&5fΩŸÃ±“+ªú”&'ºè≤ﬂNbò—+WSƒ‘
7±Œ•#£ ’“)∂&joc≥£™Åu4ô∫r]4†ÛSÖÕy£xΩ|òˇj†r√c≠˚w¸Ë∫´1&~™o]3∫ÿbΩ‡'ò/kf??ø◊_>Lß¯æ&¢V8\_I◊PG÷Np%W≥˝&¿dÛ¡∫ÃíåÛ˛øBÚQQ3|ÃÁäFì?¶yE¯$<(¸IÈ ”¡∏ôÍ&[ZÙZ8˘,Ñ"˛
Ê>8^ÁA^q>ﬁÉÿ«¥’ˇA∂ÉÊÄŒ)ÑÕ¨˛¨rPç™:óÀH†≠≤bP/@n2èﬂPn73ò,¶œ9–Ûzx!±⁄ı˝Óa∏6™l˘›&	gøw@}Vì≥¢9°<\¨c¨˛Œ∂∑C´	R∑∑∫jPñ≠√ëîôıKÀhcÈıeÙ
⁄Z›^F◊__GÁﬂXZ{}yù_⁄º†	$`ÿÃDOæD~#Aó{Ì–k‚Gù≥2uŸhQH%ÉV^ÑπN5ÀÆ…˜/†y…åc‰‹í;Ã/IØÅíTÃAnûÄnuöx*•ﬂôøÒ Ùµπﬁ≠k≥”¯èho«´ÃÃÕO÷ÁOM÷Îì”µ˙¸ƒ’4EhÊñÆ∆ma”¸á∫\ænH)r*äü-Qÿø_≠◊Q˛æZWü.
LÓÅÊ<˘Õ≠*>ng"¶]¨å¸¬XÄ∏’ôP,±m9Pv¥„{[≥≈º˙Â=Óÿ—ﬁ≠Ë©ô√QxÿwâõÓ]ƒSoÛLêÑêfÕ<ë bÒzÛ«\!ªG¯*€◊dè”Õ=4Ã
&†lgÊsµ™˙qªƒTKlı§§òù˘C§Ik∂4Üô"oÕäZF°~ãP˚Ïç'<üËkñ≈"£QYÁcN4»‹∫O”G|ŒœgM'$Ú˙ÄBQ¢ ∆⁄ÎìËg¯è≠7Òo˘;
*ì}D‹4Çc¸πÓ3ƒ!å?dti““PÊÔâ5qóÓdÿ	pDïæòôui"Ia¢ÌxÚY…∂ì∫dºíì¥KëÔ9g€:Mø≠NS∑Á%^§•J2<qdÁ¬[®2á‡QP∏ﬁiNî¡µi.‡´∞◊∞ôëâL|–(<ƒ¨]&ú(≤A!MZîRNtäÖ3R»Ü5 uBf	eBŸ»•˜{X…nx±®§çê„∫4e™œ∂¢b*õ¯ÂA·πhí0M$ﬁ° 8qa¥∂+wÎ|√Ç≥◊ä∑aï^ j	Ê.úîÿhŸ)≤Ü¨y3à˚^≠Dp(S*≤_ùù¡
%˛#∑gØÄBÈµS≈≤Çı«†˚◊º‰%·…k7Ω®R≠&˚ôˆ'a/û¿J9Öd‚È˙Çv?üŸŒ»|`éÈ6Â‘qn]l|]õæ6É≠Ézj"LOíˇ’N·qêX8b˛ﬁûCA∫Çs:G¡÷bÚ2∞-NÔth…Ã¡Ú‡, g#!€» -›ƒ∫®ÖΩjf¨M_´œ§¶⁄|}≤~∫>9{/∆Iºr3˘'¥#£Q•^¶™◊™ıÈ˘!–_™pµÊ†M∂Â˘Æe.mm=fÒVpdi;M7,çîJç®u#…•1ÜÏÂVˇÎàÃ»P¥ÚËÇ{t´™≥ÿpC2…ï†Ì£’ÓnàŒyÕ=Ç2}¢≤Ÿ •¯UtK‚˚Éá*î}â»]¢¥ 	¥z^qOb’I®ëÇZ5*Ï\aº®f Qö¬g÷∫xÙG®R<øÙèú‹zC!1mívVS§	Bƒ2Â]†øÜ‘6Ï®˘Ó∏˘E‰|õ‡iäl¥ïqáÿNÓÚ›é7^Œ≠m•ãI’zcÀÎ6€>‰Äπè”ÿ  -rﬁyQàZ¿!ÿ+BPK§ûOüƒë◊ •Ä…ü”FÒ3Ä é_∑†H)M]PŒø`hÁ‘VÆy-5ú©5ŒLzßÌiÜ1∑wû4X¢≤Q|K8Ù_¬.î∏@V6iÂ‘l”S»ÏQœF¥N2*P}ÅèçÑº911L·!z–ìå‘¶B&5Ï¬É÷1°¶PæÊ=Ô◊zX5√tz¡ﬂı˙ÌƒñKÄ7ÌjÔÿ√bùl=k˙†qÎ—_ÙÒfÊL™¯
Ë¥=&Ï•ﬂL9‹≥L©†b~Çÿ$’”¡˚!ô&9„°â∑ñﬂ¬^.©ŒÂ|X-◊M$êf ¬8°{HŒÍ…y_ßÂBWÍµÈ˙Uó>!ÍånIÉ∏Ÿ—Ÿ\œêt<«“4ƒ`{ãYûÕ≈±&ŸøUH	´∂Ò§W…„Õ˜yçÜﬂ√â5L˝ƒŒöéVœ¿ªUdo¢˘)ÉŒ™ˇÄµ^/XÎ˝»Väc∏ ®Ö&ºW› N´F;Ï7´Tè$Õ∞<Äïƒ´∑Éø£aO^∑©˜. Yﬂ¶ÿ$ùˆJFbE%F€OX–d≤8Kæº£6nòﬂh≥‡æΩ˚áˇS*N15dàBR[ÙÒãhÏwè·†N^?˜ﬁ{PÜÕ”ƒåe—}‰„4¶√„.<cÇ=‡ΩÙ_ê$ÚÏ¡áÙVµé*T·:Ωø!Já97—Ïp› Ü 8Õ ˚⁄là1œ}W
Ì]\π≈∏%.‘Beå2≠Ñb¶‡‰˘P∏$æ⁄iÊ∑Ø°a’@Üá}∑´[íˆ’∞ÁªîAe»'"∑x :‹…QÎlG∏πw\∂µ‚<eóSß¶ﬁxóœÆ´«!Exå™w(é››è∏õˇkÇ˛@ß‚CÃ«l€tHüàã#ã23hîtyÛ"™–É^€dGÈ≥ëjJ#•∫Eº¨úXI√P≥1x–K‚’
ôıÔ‡¯Eä«Ò?…ÍﬂAïlÇS∆=±0öû3πï‡èu~¨ö4◊•˚QªgU∂m…≤8xÙ4™÷Oÿû*µù·9¸˛-,È⁄>©≥÷_Îu˜lõÈHŒ-[ÏC€MGvëïj¶cå:§âÅíÎ—÷ts6¬èª√~rNG≠É–6èÖx;qÿÓcÂ5Çñ~ƒRNBºßßfPïà4≤˘»ew b£€óÿ89mêŸÊÿÍÁÇ„dåÄkìäY'vÕŸBn8Nµ¬”k°%˛ã=`YåóÙ†V¯JÈyêX*(z¯zÓƒZ_ﬁÑ√åQNOùQßßŒBzjN√+x™Lñπ™Ípﬂt~=¨1k¿‚ë’ﬂìGç†ü<«¬™Ì!‚¡øºÿÁhá§IUj>æΩ˚œ≈%õß?†\nO°Tü⁄ôKΩ^˚Ä‰8Âå:L•ôi⁄¯ÓêYz⁄ä3¿ÇóÒÆoB∏˜-ZZäﬁ_¯t…ãaømü…‚AwDÈÚs9wZ„¿ÎöΩi#ÌËfJQW§EÁP/9ÑÊ†©— mrkø⁄Ô1'<Là]´ßbˆP<q^˝?Öp'E∞¯T8Òt2Õj˝]⁄¶•›øÊXr<ˆ!¶Q\öwÒì≠ ö⁄DcõT÷©h§≤§2ŒäüM*ö…ˇE&TüfÇNàó:EIÀw	i‹ç¯‡7<Ö˝ﬂ®_å∆/Ô“ôß‡áO‹<	JjÚ¢c¢ñ¢,G≈HLN≈C s¿H˛∂èó≠wß÷ww◊Ä‚öﬂK˙QÜ›<`åeOçıD©Ëë€˜ˆ⁄>˚ò xﬂ«pÎ∆'—KTç:—Ë·ı1]é,U€ﬂM8{t“ç8√+•+Ÿ(‘ HW»)U‰ﬁÃ3MÕÒ∫Ú`H]êÚz“#<ö%7Ë¶è√ì1m/rëvﬂ·uÿ~/&&P‰Ò§n9;–¡6‰8˛k–GÈùNêv¶yæÔÿâ∞‹hƒ¥pj!d)· ∂ãé}˛‘ì∫æF¶r}ee‹î
gYœR…ôπ¯9æ¬4≥Ôgë˝Wﬁ2<o·í}?ËÇù˘qFq‚·X∆#Ú[~ôÖLÑ°ÏPf/P˝*”EÑÉﬂé!ŸÅ_§c∆,“CúSpïˇá»&˝ùQ1áØ[‡MEà≠ôêŸÇHi¡La-LÇÜøMí9%∆ û¯1qÿBJ Se ±Û"èÿÈ∑€≠0≤;£›¯ÑX˝e $æ¯ûrë‹FŒ%Û†uèhüZHEÄ*≤*=ö/ﬂwu¶ô[4∑Â)…≤ºÀFã4ü∞ƒÛœ¿ãΩ»˜¥SÖ˚Ò‚·åì3Oâ«pKø⁄ªÜ¸X1^Œ‘Aæ¡V'ÓvèíKqˇ‚∆·ÑòÄ‘˙§V´ÈæKÇ8>
 22≠Ã›‰˜.ÙÚ‘&ÑπU!πZŸÙÓ•Õ£<ê,'ﬁ¶Ü÷:ß¯t¡~ÉÚÃØBP(Aåá∞mccÜfÚm:%h¡nÿË«Öz∑˝…8Ó`€3ªy‡›ô-|nïøN”V?ßIãMˇ°†çﬁˇ1’éx76“p.ÚT∑ÃÚﬁ·fı”®Lo`˜◊††_ΩP®2@®Fª˜n∫ı£SL ®¶¯=Q*î(Ûydô/5»Û„ñù∂òs…∞%@±£Í@%/[›‚s:G⁄U≤ÃíÀ—Ωc! @Æ.¥õvÍO®V™b∆¥EÌ	≈”m/_\~}sÈEñ¢ù∞◊÷∑WWVœ/mØÆØ!⁄ãj◊◊VV_øºIèO¿“‘ „¡Pí57.^}n≤~b~rfvpÒN9·‚∞AMR Ç.¢Ü5⁄⁄ âı€êÌ§9ﬂ<=∂ê∞$;X‘íî2∑‚*1Á—å£«â•$äﬁ)3f@™ÙÛò·Ù‹¨Ùå*liÕ%‡˘jyL-N§<)k˜&Vx˝{˛ÃœP%¨%jÔπ(ÙöÿOlÖfL∫¢ΩpxΩh˚Él∞°ÒÈÚ:,e¨HŸßŒrã&ûUD¥P∏lµ≠yG‘åÏv {•lÑà≥Âç≈%ÿ'B∑%Uë…~˘P5]πÈÄ\R^ÈÿÎ∑c\¯$(µ•QpóD<ÌÎëJ{®ÇEÿ7Ô4¡¥≠«<˛ üYYAﬂ|«	ÉWáLƒ∞e,£.–Sˆ˚~ƒ*Ù∏∫qáoÛ/“ˇ«i•bˆã∂#Ë;ºëÔgÇ~z•KØ≠Úz»€N‡‘mFü∫°Ê,A¬Åñ˜L÷[3“è≈ôo‚Eº˝Ê≠d+¡DÇô7?G¸∆~I)^ªtK%}®.Åw_hCBô÷$C°œ∆ã7%ﬁ})d°ö˜YaÓÉ_gtùÔ}¿2{EÎànyº¡á{ª¿1 Ω}I”¿,¿†ˆΩ®ãE”t:!‚^'f2±ûÚ!ö\πµ∂Ã“µ¡û=TSF\RŸ‡ÿ±ØT#æy∑Ê~p.oÿ>ôSÀvW◊Ö‰ ì#èiìŒ‚Ù`¬ÿ™a7ÀøÁh¸‘ÓÆ:7>ï…éﬁ•@vﬂ€XRs)Ìæ%AàOÁ±Â∑R'X?"ù—–
‡Ùç—ñ¶∂Íëzà’ŒıÎs!H©ÿj§ÂtÓ AiY´Q±(ùd?Lël.´ﬁîM?`ïlÓÑ…pΩ‘“‚1’\®nD©Ú!™§´„Ñ4eØá}P◊Ú]¬*eªkóÈ√£ÑLTŒµàì≠«n-@aÀ*ÔQâ≈úºùLÖ-ˆ;	gﬁe&KÜÖ%bü˝ûœ FB™‰h¿≤lWx£,ﬁŒ	Ã$=¸÷},\-∆ôE ¨˘Nm<©@˜•*£•»í_€´°rª∆ãI
“eµÈúœBq˙4´T7=”X”v¨|(≠ÚH†ÚRÅ*,Û≠Ø…û=ÊäÏ$H⁄:2&—jÀ`?L¡πOxÉÿ1íx	Ÿ'◊ ‰FD—“·£„◊ Òß⁄É°˘à ˝1≠BŒ5å¬‹Î¸g<‘ä¸›fÅ¥Jƒì∞‚%-?Ct/é]√vD˜∆ `/éuC|èEpA~îúÀ+Ä5«Œæñ>˘Ãîw6èE@˝Åty¯3ìelúoloo†•çU¶œ•`&à¡bwq§Jd⁄òt»Á¶ı9§∏™}ô“GÅøÄÆ˛îj*ˇ´Ê˚ﬁ‰®íNÈ≈¿°ªóU˜≥JO n·M‹I%˘HÕ¿ï°»RF(J"ÒµÕïË]:â^[Y⁄¸Ÿe⁄«timÈ">Úwa?bo0}ùª¥…?ÉÙ”zè'⁄=H=®
ö‚HsòUT&'8K‡M`§‰0⁄ûÜ∂ø¡7<\@g¯Ûïº+-z•PP˙π?3œ0—≠ç˝NÈ-k“KùÛ>Öö‚Ä¥§2áÃu5∏S‰R“AÜ Hä›W®˚FœrÜÚK¬ø[¶I @ÂòC8U≈-@√Sy»ƒ¥Ö#B#`±£H™∂#˝Âq˛íΩj>¿ÊO˘õa )=∑˜ê‹É¥–óîg•s&†Õ¬(vJ RsCÔ{~†·,5UÀ›=9⁄d6ÏN	Æs4>ùcÅ˝-CUœıWnjÔ˝´?)´1ÙâQ€°OíúX0±íû¥¢/çﬁ•!Å‘í@zÄ{oÇúèÕƒ±ùT\Z¬Ç}pW8:î+ŒÍå3ª„‹õ"∏∏„ÏXk Y∞dÿq◊Ï=]å'K+/Ä	w»ø£püÂ£9ı◊tW*íŒN@J…	µ≤¶]¨;H k YæÁ˘÷∏›U;zwâ6U˘âpÍHïEwòÜS∫/ÉáÀ˜£¬_-hCtê≤w≠—ﬁ© ;ºbl¿éX´Æ2”f´-b∑µ≤⁄ƒ)S‹Qú^’ˆ∆ïYspÆøc}ry≈JV™õ7(›‘"=d˘`NjŸ(”ÅÉæN::(9Ú46°ráSÜÊQπô#Û˘_ü›øóô4Ü°:MØ†-ß,‚fË˛a•O⁄Ã˝%b# ¡c)£–~,∆FLRÌ]˝Å>/k‡gùMÜ»´¢ÍMmmç-ZSæí@´J¸‡f∑≥Ú≈é€¸õ%ãERPÈÄJ¯P1yõMïœ±ÜI$H*cìc5l$·ô©4Ä7XW»Z€ÔÓ%-tMÛ^rD«˚µ¬⁄zﬁß}ésíT5Õˇ7ÔˇÎ<}èG8O~á¸˛%üQz(õﬁè»—ñ
aú†K~ck/ûHC_KæÉ°Ö-µf0’3Î≥‡¨br20Ãô@!¶´:^O¶„’2©	4f{E•—öƒ∂˙-[ë¶yBÌ≠ó$~Û|-¢F´c}"âﬂ
íVe¸µq“ˆ4w¥:ÌV-¥ÄÆøˆÚa£ut›lh—7ÒFõ≤¯5¬KÛÔsyÅ£_Ã¯*∫.Öﬂ^>_˘DÌÅßc√p|‚Ë:Ñ"4n~S‰'}¨?XajÕÕ»Ëœˇ`Ò/J)¥o}	Z⁄dRêF≤{ÆÆ´Å ˚Ëä8ÛY∞—2XõVb)íqÑ‡=Ÿ∂‰ù,{4rT*˙ÍàœiU«ÿ@hí¢@àñÑ¡‹Ì ÷„∑(∫^õÙc mú¡6•'OyˆÀ\öá¸J+ˆΩUùƒœ06›3ºAÕÂˆhqqM[=:D…ë$&t@Õ∏C¥¯á4$°›}N¨"™›ì|aé¿«˜lKaÎ.i8eT∏√.G`]†®˚)äÛ+¯ü›&Çz^ÇW∞4häÎ1ñ:ö‡˚”æ r¬Ìs™…Pñ≤s¢4¢Pè∞t»ÓN≥û§ÿ€V&—Åì—ı˜È¸]o!M˝†«∞†∂˘¨ÂÇ2•“rÛK8 ›ÕÛêÑÓÌesImon0∂±†1Ñ7Î£‡ˆ∑êÄ5˜˜‰ﬁ≈ãÔ≤?—#≠ä∂íÉ∂ü{9Ê6"Z∏úªüd£q{ŒJ&ÖÁ–Ééœ¡˜KΩ^qv.•'ƒ˘ëT≈Õ∫õÎ◊Œ≠oøJîQØ◊[<5wÚÙ‹â˘S'O[¶Û»¨Fz˚^ê¿º6*M¯o+°1„á†êrÖËZÉlóÒâIy?M¢C‘Ò±≥Ä`√b±fmO+o¿äÙ8À›ºÙäWŸ^ñEz®jà¯ºî‚)KŒ`V¥WÑ•(Ä^Çyu˙Ç#º†“æÇ’AL<›É	Ü∂˝æ>å*„Àä	_E|%]…<
|ô˚øÏ˝‡{ˇ◊t~∞˘Ç~
œ∆LLm¸πd@∂è›∞ˆÿ∂1uç∏†-àç/–ûs™,”#≥Ä—Sõ•PHÊ^˜ïÎS£/Ê*U ¶≈$≤9"‰5∞Añû)#Í3ä.1¶∂&6€cêØª¬å®(G…Æäx9¨Lìk¿Nµ:iÏHPöìõWªøE∆qºönÓvU◊-eÅ≤c	UGQaN}ûˇ ∂wU8LN)
Æ˙w‰«=¨fS]c◊«≠2>ÂıÇ).ë¶®®KÄﬂmS»;~“
±>>æ±æµm’'[DÈ√j!áﬁ=¿d∑1]å„`]™ÕàmÍÌ8Ïé£#ªBﬂ<X@?€Z_´≈XmÎÓ·1[\˜C>qΩΩºµ]	y…KZµ›và%u}~¯±»Î6C–ÇNìVkrΩ`=}≈ilJÃX'Ë1∫4|‡E¯ÆØ·ÔÑ·¥˘è+!Ù;√á~ÖﬁˆZÆö ·`<•˛^àO›¢/ãnˇ˚æ◊MÇﬂ„∫0N–¸|Õ·ZpN-djˆ.i<Ì÷‚NßÓbxmáëˆÒ“È√"=¬§uxµ÷§±;8Cî˙/zªè»ﬁw|Ër«⁄πß˙på<oû˜⁄¸wYÍƒK˙1Ïô(≈4B«µå|ºöÕ%<√XUGXK˜+µ$\›Zﬂ"¿n·◊≥ÓÄ>Jjê	ˆEƒΩZ,ú±ëÆÜ∑√Á;ô—ˆÁ§^`ˆìhj
Í¶êg€˙µoèŒ*ù]¸[∆‡Å5õŒN¡ûfíä6ês5ê"Àù¡.™4ì3m6]i´óç]û&,í∑‚Qˆ€I3zÂjÍHÆp˚k0Q:2≥ìN±Ì0Q{€.PJ‘4_≠L#±B‰fyÁ-ÎÙÚa˛´År»èµÿ>„G◊]-r0SÒS}Îö—%¿fÔ?¡\Z3˚˘˘Ω˛Úa:≈G55Â·˙J∫.Å˚Á§dq?€oB‘êØ◊• Ã”†z^OLS]iÚ¬«‘¨ØüÑÖ?)`:7{ﬂdêãÆ'«áAƒÈ¡|«ÎÅ»´Òœ«°
-ÔÅê‚¨Öj_mqD°¨bfxîQ•’u¸æÑA°0Ïßœ√–Ûzx!	Ú„p ÉqmTIk«ÔbPü5#ƒ*N8ˆn’uh=ÓŒ©j«õl’˜˝ı}Î*”ı≈ ∂˚∞ÿ!eÿRº—¥`∑R’æ” ≤?cy›ÔíÅ¸‹?∞·ºõ¢]í°ùãg.$
HÚ&I©;1w˙Ù‹Ï‹â¸„˚ûWüûù>Ÿ‹ùùôØüòô95kwEi.xéΩ∆Œ¬¸ü¨Àõøáã¿ÕÖŒı{ÿ‰¸N7gû˜Hy∫I÷â9q7nÕï„'ù`SCÀ∑zaî†Wj6nÙ{xœŒi_Sü>ô>v8§ÛTsqjz?"(Ûf∏ﬂÖår'¸ÚÎo≠]\_∫ÄV._ºà6ñ÷ñ/¢sKÁ~yU¿hl£ïO √X6ÊéêíÀÁ–ˆ“9tjˇµısÄ3ﬂ:øπºº∂ı∆˙6¬Ù˙ ñ¬≈Œ<§ﬂ4I#Oº¯F<ÆN&“Uù´3¥I&<m√39 8+˘qÉWÔau◊Ä Õbh4Õò%¿z˙ÅnMó>'√ßÁî^πìGŸºûÅ˚∂õ! µb”P+6ùÀ˚WÙ˚R∂˝r√'œrµSTƒ≤›	ÌX:nõïLß:8ê⁄à¬pó$|5"ºhÿ|ƒFyÖc”‡ÿ'¨ÔÑ™
Ètí¬è}J˛¸›Ñ≈€üAgy/Ã)“õÍ6)_˙êg®ﬂOãò>d∞¸XÜ®sW(XΩÉt_√˙«DßvÀ˚ËŸÉOtΩ[ÙúÜoßg˛ê÷~R4fä˜!D@éF√{æ çí´?…»^hòF[rÙ$»Ô[mÌ&õ1àt".6∞aŒ¯MRÁ[J/‘©öÃhˆΩæ”î¿ÑÙÄlÀk⁄mÿ<X&tÇ8∆ñAú∫cZX£a*/ÿóçÛdTΩÂf≤/ÍÏ±Â”<œ˙ ∂;Œ¶€Q÷piVä≠è•¥⁄óu˛√5n‡˘ØÓz‹#Y=—IßØ¢"∂ÃVE‘OC¿
°)û£[íã|¢T)› B
õ4E(f–Ÿ÷0mÇ ïq¸È‡¯ÊÙçˇπ‘ÎE·M“ß||”áäc¸Ô´À>‚féﬁ]≤IåÆ|RÆ±k-–U·
¬Ç—Ÿ≈cq$à⁄*¿ï<1f–'éΩ$“—~±kçÂzôÛõúZFXê≠]"ÁÕé¥√] Å|‡[ñ‡Ôd\J;F¬ƒ»”‰≠læ¢Z>˛Y$tAπÎ'rÂ	zWØ—	wäuª≤¡2(RÄîaW’[/b∫‚Ï-©M(§€QC⁄l 5ª¢:!¿£≠aù8j,p‘]ÿX‹“≠ ˇF&™6òvdr W˚U#_u˝õ{ƒ≥aÕ†r™{s®z#Lø∞Ax‡G‰Ñ˝Õ•N‡Ÿb„Á™G∫¿XåA•4Yo§ÏPa”•,¨ﬁ∫C‡ä˘a§≠‘8ƒ§“Y«7èÁ˙ÙÿÔ3Û`{Èü–◊í‹
ˇZø”43õáNg3V8wÌäÍú”≥T~ÑS®ÖˇS°ú“∑v(Î>P´ØÆ%ãJ4¨ù“ÙŸÜ÷¬ΩlíáVVKÿ_x%-mÑ}Às–H‘u[ÛÂ≥
êô∆§Ç3èçÈ#%‚[ºW∞6ùø°À´P˙)´–&#˚•cM÷ØLO¢S ◊∆◊¶ñ, Ë¬áï)i5x≈sW∫¯qfã»‰AÓoLˆë±Éì8.'24£◊ç Í1}ñÆn4ÔÅÀ2⁄ 5Ü´O#≤£ƒ}rïnkˆ”g˛ùíX‰ÔcÒÌBAÓ‘C&¬i≈˛}ß3‰2a™9 ‡@ôeœÊ√Aª†?√w˙co„7ßn„Á¶–ü¢RB«)yøs{RÂ›ó{ïØÆ˝†0Ój˝±)7Ù«çË≥˘%Ω;q$7~™q0{JÙô´z';(f‰{pπ¡
qEFV$ÕpìRoØ3IíËLëÇ[:5FŒi-Å›◊π˜v⁄°—y+ΩYYÉv:;kB$$ß∑u"¯&–ØÚ´µ& Pç¯hjœ†éPä¸Igº˘Tè˝6Ä˝a”ãI€î4‹§≠e£¨˘‚Å‚JØ„˘—zz_U.˜P¢yÒä	Gƒ·L¿K*Ω‘dãy@\ñMßù')wmùf'•'≈Î(ÉéP≈Q8¬Mh˙”Èº⁄ :ó*eòÃl`F0ÂUàÔ1Ò˝2;àB<íÅ9d¿±∞Î¨æîül
hf¬ÊrìPÑò”ÅíÍÊ'ùäqŒ[˙d?k! æ1≤Úíƒ√ˆüΩ±≥&Ì.cÓl78≤ŸØÛ•Ïs.ªÖÂ#.≤†≥∑5&Ò«Ô≠2-ó°Ú·:´6äºƒ’÷R∂?ˆõŸ¶epÆÏC¨ ;Ÿè4—aøáxÁ-‰≈=`˙7±aŒŸÔÒﬂ˜Ω»ó@E⁄Õ£‡í?XŒ≥xˆ|ÆÜõF Ä‹Ìf4^Òá Û“âwüw
À{x=[BlwP @?Eu7uïˇ∏°Ùíı≠“YßìWüû'∂…SAlπŒ™7U˛…oÌ¥çV–≈T]ïB¨É…>*ú≠+%kﬁMñ~[	Øâ.ÿ˜¢F´⁄k˜%èìêπ„(yŸ;\ΩeÏÚºÃLßn'Lí∞F-iEVœÊÔπp*UR2e/≥‹î^&±˚Tâô˚ëH¬%Ê¢îWÕ}ÊÙ1ºËä\Ê¢ƒ¶Q"Rˆâ^aY{EÀöOﬂ5¥Á‹ê.;è
Œ7∑DllZ∑ÁX¶p2«dÃ_Jàõu”áA∑2W´]I”y7‹ÃVÕ\“I‚‚ùÖ˝™◊OÏ†ÃÏâNÌ ¯ONæ”`ÊKícä$îÁ∫ØäÄËÄ?ËbûËµQ÷—€îr¬î2ØJaûyµÔ^–¨Çﬁ-áú˝N3‰ÃoFÄ,"<çPı“∆∆Ê˙õÀx„üﬂ\æ∞∫ç*œ¸ªËFu∂e»3>WOú4ßHõµ†9yÚ‘?Bá‡ÿ;ëÎ5ƒèÕ*}ÅEó`ﬁœ#⁄–ˆË+	:~<8}m.ˇl˘¸ˆq—–àÊPó B5uË aπ•=Œ,†Ûµo‹K^¸¨±Õ∑wÀz‘$;Ë+ﬁæ´TEu≈#VÄañÒ=1æ◊l¢5mƒx4˝±B“†Ô1‹§b≤ıÁ¥Qõî›ldèÜDHão°.˚f™…K∆"0ÚÈ$`	êˇÊ˜hF:ÌÑÙŸƒÛÍÂiißa∫µÿå˙Ô¬˛v'm¬ Jo‹àÇc«1÷;•ÎÔoß]√Â™Ü)k¬ΩÓ}R¥VÏ0ıF
ÿ$í-u∞dJÄtâ˛˛}d–Ì√fÇ‹Z©â¡®ì…ãæi$Vùﬁ|ºÀ~<U°Ñ!\à{=?êzÚÿà‚kGKCëx˝ËAÿO0 ’£¯-jÿ˙Ò Ñìeë”	‹ËJ"œµ2ò–¿ÿ$¡%¬j∆j7N¢>ıÿñ≈√˙âvN¢p?^<úq™(U.x‰CC†j7Ï∏xq…uhÊOækæ2äv§z,ïA=NÔ˙-9{ájÔ–ø“ÎÀ≠q˛˙9CSœ◊uÂ€Re›”]is ÖèëF	.$PoÖÃjDW¨ê∞N»+Åﬂ¥≤Ë»ï™Iï	èÂZ$Â˝YíFkœ}Tm¡Á€˝ÿ=ZKµf’BÈÖÔeú6kS˜÷îh{¯V«ú‡È0mç\≈®◊ö⁄ì‘µ‘∆÷≈3◊∏”÷≈l≤n˙¸P∫^¶9∞W†X
P4gÂï0§ÛªK˙c>–b|4i>ZˆLgèF“ƒ·±Êï∞rç+›Ç^cñûìœõ”∞MÇô∆l¿œ|è˛§úòò9æÃ,Iïée5ÛßJÒæ˙¥òƒı.+;G≥íΩ—‡2'(Xª‘Å÷4mΩ¥⁄$ãã4Ω∏Â7ÀØ•,…˘ÃÉôî1_d.ÓÌVÉÂ`˘π7˚.’µ;ﬂÜ;-Ñ$€¬ﬁáªdﬂoÛ6÷V¢©§.€!m»ø™ªâ`á24ÜÇ µk&b9Sa≠[ﬂ’‹À9´jÏlÖixt°w(c≈Ü≠ëÉT˙aG4öMF^ú»°nÿîÊtÑ¶È2 ¸Â{≈îS⁄ëö©´V◊È˘ÕÂ•màm\>wquÎ:cvÉ±·Ö6©Ç7Z•∆˙aÊ“¨&à\üviÅ⁄öwımß	ïcgœSf>|:Ó !–%ø	%Û≠yW„¬>\<k‚KHÍŸ-÷˙sxI˛ÇÀ°8“5˝Ôî.˝œ⁄-÷©‡dtÂoÏÀ¨Jg˙f∑$+¢fèvâ.íƒ*rKbÛÛü2)vŸ`^r
v⁄`Ö§-É*ù”Ùy\ˆ§5eÀ-W”VÌHªSÍ™FÊú2∏Jî2J\ñ—L+Vÿ=ÉK?r®∫f≠€'…·]≠E®%u|oÏ¨H‹ò¡ù2}›PJ&dÅQœ˙Ñ#Ë˚Y¶Ç[êŸ=‘kæ∆)wAô≥pohAc`€ÿûØ —∑l•Q˙Êiı\¬Ç™x…ŸxsﬂÕÑ«ËÁYhæ√∫RJ€.¬ñ¥u¡µu»$∞ê√0ÿŒ' C˝-†ÕÂïÂÕÕ•ãê∏≥~È“Í÷÷Í˙∫¥¥∂Ù˙Ú•Âµm'º?⁄Ü÷kèÛoì=Òπ ˛ùon ¿ø¨√÷ÛÉ˛´ÉåÆ?OËø¨Å“.∫≤ÏöwÊs +ÕX‚$|.Ïbªàô$j; Ï?Û?aà{õ¬ÎH˛Õ‡ıﬂÂ~Óß‘Ü¶ûª<∏ÉO?qAÀ6‘ñ¢›¥Hùàpdú°Ùz÷ñb{»˘k‡¬†‰£Û€´o.ì˛3PE{aukÈ‹≈Â∆∫~ª°?2ÏE√(tÎ¸Ñ7Zª√√o§-Ö¢≤ÎHœﬂŒµT~ƒ„Äüë´˛MKC¥„˙¢€Ñö>ÂQ…ªÈûr∏«ªtÑY†éΩ+Û+∂$æ·G∞E@;≠O˝òæı32	Èû`XúÂqVDyú/çÚhÿ,4&ògú;)ﬁ”Ü4{,h¿6‹F–ÑΩv{3]‹tX7nˆ~•‚5ì®A¥P¸OhÛ—Ä|vK˝¡0=1	Õ≈ìp%∏Â7+3˝Á0Yónh‚Öx6±Z?l.cy‹Œ\ö£Úb∞G#N–@≠  Á>¶é…6π˜xÖI*÷Ú·O¸ràÑGX‡z-SﬂÚw†·M4‚ÓÏÌ+jäô£Í¥Ë9ı≠<I«áˆ©äô	lÑÅˇΩv∏√BçØ["Ó_X5ﬁ5¿†Ò∂MèyvÕmﬁaD÷gœ¸&/Xáè˝€Ω9ÏZd¯˛ºƒ‹ß¿:⁄Ì]¨*◊⁄!Ì0Y£`/ËÍïn™I76Î7.eQ$ŒÛóÌ”4£|2‘«\aπùFÇ≤lç;BËË.ÌD˚QZ>#w›¶f	"(ÍT–HÜkLxòƒ$Ω®vºÄtyòxˆqA’JÎ†¿·â∏-Ko¶√Ñ)@ga”/ÃzJAcg_≈ƒ± V]|˙Ã\~ñNŸùÙÂ¥}ˆ£˙Ì$D»>æß•Ω&•ÂKSÊEUQ∏oÁBnY∫˝»êY"+S`:à¬\º"fÓñ›eiÍõqÔéçëBBúµaÿ¶Ù≤J•˘7i8Ê’j5¯ueCX@rN:ö07 uÿ≈MôsQé˛3’´g˚\©·≥—√ÓáBÌ(Òõ/πµ26Lüki}•X£òuO#áNr∑
˝u&˘ãFäæZ»Õ@q∫!h#˙Òñ÷Q«-/¿:%‡©4@B|9∞¸7H:kvç;i∫vﬂvÈXù5˜£≠ÌsÙlm‘?¥ıc£Ì{]`&ã®b·4¨À©Ì¡¥Õ(‡Ö∞Qi¬;–∑íŸE@È¸E◊‰M–ä—á˜•<@{ÁVqÛµ‹tÑáÇ∞È∫Á”∏÷˛™ró ﬂ)†a∆ﬁMø…[ùBbƒŸÚŒ≠RKˆV-Ÿñ≤ÿòÌÿÍQÈﬁ•“B ˆfïñù¶ìºã÷"ã*(0zéõ’àgÒπƒ∂¨áMfH…∂ï±–{DÏU?)Ë’¢ëP‡8`Ì+Å”3-0ÛKm˛„}!‚∂m¡Ô§ëπ«dÑòYÛà¸u.ç∫JSÍ.ò©qO¢ÿ
Ó˝"Ú	,ΩÍ¨‡Ó”ó8$Y-y«4˛úˇ¿!@°öìÚAÉÛﬁ‡ÑO˚+§Å‰Ï‹—¿·Çeˆœ4^¿∏˙ÊÉ?3∞yúÕj:F¨~¢ûám>(¨“6ˇ.î9TÒ5PUÜ À»ÔÖòª è‡hxm‰ˇw®Qù¶ÎÔ≥M∂à^RØ◊˜Gáa^»æÍ4òÇEPﬁ*éƒnˇHm’SÕ(¶õˇÂ√ÏIxˇ∞ÁìΩ√%Û¯—K%öûzRø◊ÙÄ&ÖÃTYTÉÅöY∆m÷h[JÉÃ;f•¨«4]ñ≥zØY¶ÙU->Ò¨ìdNëdá.^∞¬Cﬂ(^-æ’=⁄Ñ=Ál›^ÖÈeÉÙ!›≥1K'€á‰C{„¯›næq√É7à†»Ö[»[à¯é¸Ikõ£ˆfP´fkBò±Ë/$À˛¿ı*ı§T~¨HÂ¯ä∫wŒ›»5Ãê3y:ÀXÅ¥ƒp˝—èü£Ó£LbPg,ºCŒˇöƒﬁ%^˝á©o˝˝Kõ«¿ºÚ_âŒs}.¬≥èÔU)Ì	ÿëèE7˙€> ˘ûo=3÷ùôç°'õ¡ØÃO¢˙4˛ˇ=3}ïÊÎ˜âæ´[¢)…Ë«¥Âê∫⁄›SLEwÚ˝äD∫Äò@’)”ÇI’ÿ≤Ω'!*wM&í›€'òÚa Eﬂ˙c€∫B]ûk;.s% ƒÀ;œXSÈ è{è%†∂õI◊!ˇ÷D∂<l=\‚hÍÌ5uÇÓ‚°a¥„›¬◊LO;!ZÇi⁄¸&öŒd∞:4&I„˝%c‹∞ƒØ≈&eœãb•zIQÇ‰ç∆ÿíºÿjkÖ—’mª[Ïn6˚±€ô€(7Û÷\CÎ∞«%´Yä)ê˜√Tb¡êU´rñsi€y Îπh?h/õ-fÀVP:‰Az1\Ú6©E\‰&ô5$&¿5!ä3ﬁ„BF∆ÇïÚF'!f√Ω·í$gïÊö.√ÃûòÎj{k¶eŸ“ÖõÕR¿8πÙ∏ÍıÂ£MéÀ5_ë_xRÿMê-‰‘f€0.7ÎŒ)Nó^Ã™õ1Øo`“—˘WrÖïÁÃo-›[XÃUss∆›Z®
ƒ®ÓÌ˘MtÄ’üÚ¨ƒT´«¬¬JhµU=5ùaÊ q‘ãå÷´nà	ﬂ‰TrndÀƒxÖGY{ıé§TΩ8Ω‡hπ∫væ"”ïÏ£kÂ®F¬/`ÜºFóÅ“¨]f©çŒ›FK∞ù±≥æu°øCv~æŒ J≥‰ß∏u¿À-œPΩ
.–0!-k&CgÅCZõq∞pTVT'–7ˇø«ëC√Tz;¡FJºNÔ’ZBÀ'˜Ü|+ª≥e"C®˚ﬂJ",è+˙˛ﬂŸœÇÿZa¯UpπDµLÔ æïÙw
∆∏≤™√™ˇ4]Ì|1éC	N6ví∂Œ”qBõ ŒùÁê;+D/≠¢W–E(:‹∫º±±æπçV◊Œ≠ˇgß:ËÎñaîË™†Iä’≈‡¶øEØ€∫æ*Œÿ,ùaÒpﬂo„uıôçô?è^¬/'YZ™y
ª€XKh˚K¸Æ‘¿"L7∂rﬂ_≠q’Ê¥¿’zèâ…-!9#¥î§ÙR∞â úz}D?ÍIRÜ.xVt∂9œ™L†#”C%/ÉÊ:≠eùôÊ⁄7ÿ∫Ø"íô/j∏?ü|»à?ß•4|Ú)ê>Ø[xƒåbH¥[8˙‰ŸÉ_ß≈§&ˆ´À¯ Ç,ïıµ	ìª≥Ïo>¯„àGˆòﬂÚ¿8≤ïT≈ˆAwMAπE<1Æ_K!˛ ›1$Eº‹¬fNö(≤∏iÁ±„hXã÷ñ<M´h>¢'D$T:!3gNπ∫sT4™t›§#[<Lˇ©∫é0E–í∞*NÛª·ó‚ïo(Ê—X Q?ÖxN∞ ^Møê137uCaõù#ûóøvÊ†y÷≠ÚÀZJ k	œ–“*{«•∞Èµ’	·‹ﬂ◊ÚΩõ˘% -É®≠Ç@Á}“f¶ËÊdF“û@ø¨R¨R-8ÿ‘ã9⁄)Ô|n»¿eÒuÏÆYŸ%	/¥Òöÿ(ô6ú¢`W¶ØùË›∫63èˇàˆvº Ã‹¸d}˛‘dΩ>â-ôâ´ƒ Ñ√X∏≠K´ÅøY¿ôÙ2ò©|«⁄4R∆¶íÕ6PÛÏf<è¶û=¯‘ëYUr§:!>Vﬁ: €Ç*®tAE!¶ç,¸Ø<ÈªÔU«µé™º˘ﬁ>YÀ˘SN∫…Ÿ∆≤ñ,z⁄.o÷4Y˛Œ¢∂V‘ïπõ.Å!Âí7∆ŒÍ¶[˘∫¸≥≈VÅ3Y]ˇL—”,¥€&˙∫Ù°˘1Å˛X|ø +\‰nÁ»∂Œò‹öw3ÿ£%’Áº<ŒôÆwSÀ¶Q€ﬂÖ&ît-ßS¶pÂG”'ßõıÊUR„å?±·Eﬂi˜£¨xHÅ~òeŒÎ]µô‚%à‘πEΩC¿öÿå%$±á1¸œM´#a÷Ú2(a ;k„ò°b^Øyú·∂aFä$üî˛•Gﬁ%b∞Aë2‡Ò—Q[Åå0Õí‚˙ú1e)“ôãïÒ_©,Øå‰ÚNFcÈ¸ioNiˇçjXU[]âﬁ9íÂ&Ñ™óΩ8Œ∆¯¬,9÷‚z¿òÒäÔçhÈ◊…'>Ô≈ﬂ≈l≈∏ˆJÌÍπÆ=b∫ÙºÚ9¨|Ï4ñÂßQµìAŒ.*ãIA[L’√ú÷gM\Nœ¯ø$ çº¬ó
'Ö€KI»˚X≈Û-Íé )‰F’á0s∞>o*ÔE!‡øÿ<éÚÖar`Âèàπm–o+±ÓáAºƒ≠aïKPóÛ„PJ/—FnàNñÄÍ¸ê“`aíJo¿	®@BŸËÌîÒëì•75≈tEG.”à¬˝Æµ9∫+1∫P˚€’π#í˚ÃV˚œÊáÿô∑AƒıêwÖƒ: Ë"ç*BÆeÄ•ïùD
÷
 0PÎ‰ i¸s53√
÷Ißió6ùg÷˚/C,¿ ëÇ¢A/eì¸-˙∆ÃåE◊TÜ9s–wÅ≈ØúûæŸ∫*ÖêïÒ„πÉTæ˘Lf!uPV4NÄ≈µã´Ù’A+Ã◊¬]ÅxT!j{gön‚·IeÛpjÊ!ã™©»Ö‘g@⁄íÕá&…‹'J-mÊRÔZJñß§ˆ5í≈√≠T™°ã4Âçy†… $∞≤mltâj*øL˛P—uA3z—¡>˛0˚iÖ˚ÙB∏é^¢d<FNQüûæÍ∆ƒe+pŒW(∫◊K&t8qS6Å_∆´´Û¨`Ê!qmnö{Fß'…ˇjß&V“πˇËº3êdUÓ^È$;∞ ∏v4†√√∂\∞°ÓÁ·äÎ∆©/	W\+±Ä¶6ïœî∏i ˜îâ•‰Ä|˛‚ÿŸ¸.´b¶ß™^ªFÏc~ÙÖ_‘£‡ñ)ËzHû˝ÛøF}CR6”«¥KÍêmˇ”4ÿ%6“‘kïÖL7'ﬁ;bZ±ÄOé©YpSMŸÀQT◊g\K◊n—`§˛zMÊµˆü'∑JÄÚâûÇ¶]≤Éõπ	ÄfIÀ∑f”ß_Î≤D©„ΩyÄV¬®„ƒH”úg5Ü}C\[}˜»bjÈLGXj«†.≈ûÕıdêÚücø?FŸ§?Âº˚∑±UúA‘h˚Ÿ€¿å[Q–ΩQuAèïß»òOß›º≈Êπ…gõe∏Õã W°[è„b4Z~„∆óÅM÷(óB/ıL}£”èÅäÿB≥,ÕÁp49Q.ä"èB§•ç:Ô–XˇÏ®Mopibﬁcﬂ‡‘»‹Î'≠*y*Íµ´ß€X/™c)»˛BVÔ«n‡ìº
Ø-◊˙º‚	CˆÖ÷Ïè˛Jm9
ù%&]}jUâ("Du@T6üm€At=}%¬s‹k˛æ¥’≠jZTÚà„ˇˇ_⁄Ö¸1≠…Á«ÓÒ√€,]<ßqÖ›=˜˝ÇÔbØ¨ÂÓ>û}FÕv£êå0¨Û∏a∏Ù%˘˝}ÚÔ{í≠ÚC⁄'õ~’O∑äªL°Kê'ˆíbE˝◊˝πp!‹Ô¶Oık AHTÇ0 í◊Õ∫µ¶Jº©2¢ç∑´çDØ˚7§Ê∞“hZ	CXoöt©∆>qwA˘›&ÀÈÎ%Y@∏êà§vBÏx;Z…_™•/Åù∫¬KœÊÕñ<ºÙ f¸yØ€¿,z
qo–=¬+üî2ﬂG∂Ã™]¨ûÃ†V4îv:):∞.Ä¢IÛ≠*MëUU∞ÎÏBÁiVé“T€j©Iv¡ó5?·,ÖØ≠’j∂2‰ TK÷f¨[;ÉÃ∆~ôÇdä¡TÍê¸¥D7sÌß©Îö,Œ+ÎAáHMZi˛
öˇ1ÎPßç÷ãè;V3Y¢r»f^≤—≈rÌ)P$
ìFeryO;4Ì)ãÚ@í|ˆæ‚ è¶gßO÷gÆj£sY hˆ¯dA]¡qöÖÅ§rÆ¥˙áı…∑íVÙÓTf•â%%““Ú·ï,?Mù©VŒ9gÈ`˘"Eµ|¢lœ–§Ú¡'¥≥_÷ÁÀ<∞°ìX–e·œ≤≈íCV>knáŸÕå≤Ç^å$¸ıà˜H§ÍÃ]⁄úGiH£^iô»'Ø6È}ƒgUÖQ¯EªòÆ+1¶È:ò‰._J}à…-ÑdàAΩ–°•ãa=FÎx‹$Ÿ ÖoÁ∞ÔgQm¶¬)êÖÓH•ùs„.Å	≥CÊ≈ÛÆ∫´ñ1‡†|§‡Iz≥‹!JàÓB
(i™…)Ÿ‡04…’}‹átª~∆⁄ç	o˝õÙ[Ù˚≤êø}ˆ‡.™ Î2˜rd%Ù¿6ÄU‰∏ÏE](¯°FΩ§+˛À[EÒ»◊1SÕÃ(ƒ ‰7oÜ"d)Bpäá%ˆ(¸=œ)ô“Îl‚˘©âE:ìûo9q|âNÃHã`ŸBOR{˜u[Q.Ë†mE∏ù“ö©:p3À»ΩéÈ¿!‹]lDiÎÚhéÜAØÖŒ(›0Íxm‡wR §„∏ìbX?¢
¶ãÁ¡b‹úìz_k¿ŸOa⁄ﬁNG¶¿ıÁ¡\ÈB6Å◊ªÌÕi_–"⁄nk⁄; ^„zÙ3ª±˘$ Rô˙≈‘O_ûöÑûmGS§øÁÀ"¬´5ﬁÓìµêºnxÂºR”ºrògÎÇ2;"äuœ#i¬^Às˙¨3aÿO∆îÕÆœs^iZ:„´óR„ 3£‚:∑ú§–¡Ñ[,˛`]ﬂ⁄•ÂaTk¥ÉﬁNËEÕ⁄~Ñøe/d¶…Ä˝ökµÁ‘%7«∑@H›ˇób¥∏6„sÜ»’– é¬ûÍ#ûMGE¥ŸŒÑŸ`’√™S¡¬ﬁÅÿƒÌ<˛]#±±#Ñ¨Ä€Ùµ˙Ã@æG.Rfuz±J¢d~¸‚WÚ›Ë0UA5˛zÊ—\è¸3òs-C;5Ï√µ©%“äÖ<…/´3Ôm√~À≥â{ë˜{Æ§∞P2®é|j¥’m[∂cÂY#39Ë÷VZ)[a#ÄÆA-,‡KEÒsÆ©ìk S~IÑÿ·uﬁò›Îµ˝ñóƒ^Ø(ÜS±ﬂmæ
´Å%ùﬂÖ¶Ëó7Wœáù÷+∫Zà¥Îﬂﬁ˝„«hsm]∫Ñ6ñ÷ñ/í§6Íè˘˜¿R»±/ÖnÌ‰_¨€<Ω>ÕÍyÃM»{Ù w˘	j6>A‹W@‹æ$AÒ|Sö'tGDÚB‹k¸Dx»]≤üË’üΩÙãÆ‡*æ3â»…'fû~«“d§˜eg2KIzòÇe|A)ã¬¢ÅX¶˜êÛ¯Ë«˜~—˝ˆÓ?˛öˆœ˘Úî€Ù⁄Ö˛w¢›¸/ƒ˙xífHΩG¶È7"$åªÕÔ7√ÁdÚ˛$0øË¨¸P¥5SSüò–u]°πNãc◊∞@ÌﬁPs®»o/éa[ìÅÛ™/r‡ía(6Ω#C3ÛfOú∏*ï5fG≤>;5'ôê‘Ê‡'ÏY(0œÈXÉGv∞„FFh	v?Ïo¡K¯¬NMñπßN{tbîI≠„O≈Ü©~‘~ˇWäAñﬂQœ}?œnö8zE/M∆ápüù±ÁôÎÁÑﬁI•ÀW‘/;˛˝ÿ‡3ßó/ú.lpvTµ¡Ÿ)ıß'üÁO¸∂øyË‘ÿıù∑˘6ªÕiõÍï±7∞·∏ö†∑¬ËFå^ÔMu/E£œX„ñõG"–Ω‰,6Rπ÷™Œâ9’ôπáJ∂Ÿ–˚~ïä3†∞≤ 'Îrë˝ıºQ‡cZŒ`à∑?¶JÀ´¶ÖUwÃ8”ó¸È|Ü!∑AúßÃÙ3Ì@≥GcÃ[ΩXﬁ˙›ØŒ°ñÚ)ã(pÃ√\OIç§äŒSﬂ6Ø=CùÑ6'xˆ‡Å%c@œ<≠H˘òrÈ"¨0Ì˘ôdôfh¡ÑÒf»√T≈˝Ä˙Ÿ	ÉÁö∂§¨í^ë¶x@[GäAÀiÀvdÀ)Õ5*.o∂êÈ*PsÂüü—Â∞X ∑Ssç^ıÂyÀüÚNB‡÷◊&qÛH”
y˙˙”ˆ$•ﬁå¥gËù˛∑Ë˙ªf:O¢Ç˝î˙äR€V≤`©“î“◊)Ú+~aﬁª≥é	kÙb˙à/xµœÙy¬•y∑S√WAúZ#òéÛc0å"©Û“ duf™ØÛô4çK∆N`e
‡›“ëõZ{Yõ7U†Åó ¡>•ÜCs.ÛzÎ:sç∂/óî]£jÀï&6J€Ü<Ìˇ  ˇˇ‘]Õn1æÛÓ)©Ñ
ÍFB™UiS âÜSUÖm∫MVJ≤Q6©T¢/¿	∏ —;œ‘'¡ø˚c{∆ﬁm+ ∑]€€;è«3Ûô}v¯PÿÆˇw tô!¸àxQA/
Æ6ê∫ÜÂã…Ov|S)Ì0~Ëmπuå£3ﬁÌ/Lm—!∞K J—,'§†ÓˆÛYùL•[ﬁv¯∏PÙ?§âxÕùﬁ[≠jXb ∑¯Bâ9Äƒ|aƒY#ré{Å¬à°WcÍhvˆ≤∆…Û.4Ø≤ÉJé -ã€eÿC„F0ÂoP«∫U˙ŸºÁ5ÒöÍ¡jY;˚X[u∂‹ZÏ—bkèpÈœZÚsw·æQ¿ßÛÅ⁄Ä›¨∞Z∫U+§„†cn lÀjq Ûéò»Ùı.PWπh<òˇáPkà´sœ:∏ -Ü`ƒ∞Ù4^uÎÖ”È4 tŒWpP]∆U«hñ+i]ç”˛"ö∑-‘Ù±2ÔÅ$ç¥»†∆⁄Q0≥£Ä>lO>ß,»∑Ω)<ÿÍqo|ë+æΩ—^Ëı„Ù°∞–‚¥w®rÒ>ZLØ3jñ«ú.âπôÌª0ufÊy¨Ω¶≠πB-¿⁄+=ç ·ÿBe*œpÜï®n§3üSŸ1¢¬„UY‚TYtm\ ⁄∑*æÏ√áÁUy»⁄H≤ÕÄc˜hLƒ}†Ï HØOﬂÈ’√ıEú–±ƒ≥si—sÊ¨√ä?,ßz≥r©ﬁ6eX≈2£UËﬁ&„§-¡Â#õ1çà,Ò%≈OcQ†âÔ¢¶ÔèÏã·Ñ,áÏ LqSi•]2ò–ıI9CƒüË)\®Aó◊≠®≠•ﬂ∂%ÃıJπ˚!⁄ï≤Óz]€RkˇóÅ””JóªœY´r∫‹¸í¥äIm¥>GÔÈÍC;Ô&”Y)u.◊”Ëä:†l=HU|¡¿Ü∂*—¿áìÑäFrù¨ó‰rΩZ/©è»(ú_—i∏ä”u8˝´±ºEÒ‡ Îäªeπ˚Û?{ÎÁ¥¨¥M≥œ≥€≥,Pis˙Ë›—∞¸≤˜Ídõ–˛&À(3zz∂-¨O+ˆÙ&∫F,P∏£/7>)*–“€ò~˜B/Ûﬁ¡Ó∂Ã›fz≤Jñ·8⁄°Õ{T24Èl6.Üº}„)Ò†„¿§Q?ß›ÕG›sAJ3ë¥!∫\9!Fƒoïœ∑(´Q G‘}“∞ã“".	ú3b◊@íˇˆ8qe‘∑#D"y
yﬂ!Z3π§∏gé¬ELık™} ÊÇMiçú™˘=€ﬂQ6@ı*Ûkô81œ@Yo›WåbB≥ÀÀc8/∆¬êŸc˚¢Dbõ…x.&Ò(≠b¯ÏŒm3r¯J:4ÅZÕ@N˚lπçu˜q)oª{»5—˝≤ãxØ9Ìiì≠8∫Ú8Ñ§]ÎÂµö¨%(≤P	)A£)SK;+'“rÇ/±ü3Àïê*é©|°ôÛK	ÿaIYò/) ÌXRÇ©4‰ªÖ4‰Å°®´Z-@êŸ≈ò}—l¥.ˆè…›∑üº?Ë˚Ó˚WÎZ|úÃZ÷2˘>{G?ÌÕì?   ˇˇ õRsP