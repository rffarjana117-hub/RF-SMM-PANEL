import React, { useState, useEffect, useRef } from 'react';
import {
  db,
  doc,
  collection,
  onSnapshot,
  setDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from '../firebase';
const haptic = (type: "light" | "heavy" | "success" | "error" = "light") => {
  const tg = (window as any).Telegram?.WebApp;
  if (!tg?.HapticFeedback) return;
  try {
    if (type === "success") tg.HapticFeedback.notificationOccurred("success");
    else if (type === "error") tg.HapticFeedback.notificationOccurred("error");
    else if (type === "heavy") tg.HapticFeedback.impactOccurred("heavy");
    else tg.HapticFeedback.impactOccurred("light");
  } catch (_) {}
};

export interface SupportThread {
  id: string;
  uid: string;
  name?: string;
  userName?: string;
  username?: string;
  userUsername?: string;
  email?: string;
  userEmail?: string;
  balance?: number;
  userBalance?: number;
  totalOrders?: number;
  userTotalOrders?: number;
  lastMessage?: string;
  lastMessageTime?: any;
  lastMessageCreatedAt?: string;
  unreadByAdmin?: boolean;
  unreadForAdmin?: boolean;
  hasMedia?: boolean;
  status?: 'active' | 'pending' | 'resolved';
  updatedAt?: any;
}

export interface SupportMessage {
  id: string;
  sender: 'user' | 'ai' | 'admin';
  text: string;
  timestamp?: string;
  createdAt?: any;
  imageUrl?: string;
  videoUrl?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'none';
  fileName?: string;
  source?: string;
  adminName?: string;
}

interface AdminLiveSupportPanelProps {
  aiSupportEnabled: boolean;
  onToggleAiSupport: (enabled: boolean) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  adminUser?: {
    name?: string;
    email?: string;
  } | null;
}

const QUICK_ADMIN_REPLIES = [
  '✅ আপনার ডিপোজিট চেক করে ব্যালেন্সে যোগ করে দেওয়া হয়েছে। দয়া করে ব্যালেন্স রিফ্রেশ করুন।',
  '🚀 আপনার অর্ডারটি বর্তমানে প্রসেসিংয়ে রয়েছে, খুব দ্রুত ডেলিভারি শুরু হবে।',
  '⚠️ অনুগ্রহ করে সঠিক Transaction ID (TrxID) এবং যে নাম্বার থেকে টাকা পাঠিয়েছেন তা উল্লেখ করুন।',
  '🔒 আপনার একাউন্ট ও ব্যালেন্স সম্পূর্ণ নিরাপদ। যেকোনো প্রয়োজনে আমরা পাশে আছি।',
  '📞 বিস্তারিত তথ্যের জন্য সরাসরি আমাদের হোয়াটসঅ্যাপ (+8801342163841) নাম্বারে যোগাযোগ করতে পারেন।',
  '👍 আপনার সমস্যার সমাধান সফলভাবে সম্পন্ন হয়েছে। আর কোনো প্রশ্ন থাকলে জানান।',
];

export const AdminLiveSupportPanel: React.FC<AdminLiveSupportPanelProps> = ({
  aiSupportEnabled,
  onToggleAiSupport,
  showToast,
  adminUser,
}) => {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [adminReplyText, setAdminReplyText] = useState('');
  
  // Media attachments for Admin
  const [adminMedia, setAdminMedia] = useState<{
    dataUrl: string;
    type: 'image' | 'video';
    name: string;
  } | null>(null);

  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unread' | 'media' | 'resolved'>('all');
  const [viewingMedia, setViewingMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [isTogglingAi, setIsTogglingAi] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Listen to all support threads in real-time without composite index requirements
  useEffect(() => {
    try {
      const threadsCollection = collection(db, 'support_threads');
      const unsubscribe = onSnapshot(
        threadsCollection,
        (snapshot) => {
          const fetched: SupportThread[] = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              uid: data.uid || d.id,
              name: data.userName || data.name || 'User',
              username: data.userUsername || data.username || '',
              email: data.userEmail || data.email || '',
              balance: typeof data.userBalance === 'number' ? data.userBalance : (data.balance || 0),
              totalOrders: typeof data.userTotalOrders === 'number' ? data.userTotalOrders : (data.totalOrders || 0),
              lastMessage: data.lastMessage || '',
              lastMessageTime: data.lastMessageTime || data.updatedAt,
              lastMessageCreatedAt: data.lastMessageCreatedAt || '',
              unreadByAdmin: Boolean(data.unreadByAdmin || data.unreadForAdmin),
              hasMedia: Boolean(data.hasMedia),
              status: data.status || 'active',
              updatedAt: data.updatedAt,
            };
          });

          // Sort client-side: Unread first, then latest update
          fetched.sort((a, b) => {
            if (a.unreadByAdmin && !b.unreadByAdmin) return -1;
            if (!a.unreadByAdmin && b.unreadByAdmin) return 1;
            const timeA = a.updatedAt?.seconds || 0;
            const timeB = b.updatedAt?.seconds || 0;
            return timeB - timeA;
          });

          setThreads(fetched);

          // Auto select first thread if none selected
          if (!selectedThreadId && fetched.length > 0) {
            setSelectedThreadId(fetched[0].id);
          }
        },
        (err) => {
          console.warn('Error fetching support threads:', err);
        }
      );

      return () => unsubscribe();
    } catch (e) {
      console.warn('Firestore support listener exception:', e);
    }
  }, [selectedThreadId]);

  // 2. Listen to messages of selected thread in real-time
  useEffect(() => {
    if (!selectedThreadId) {
      setMessages([]);
      return;
    }

    try {
      const msgsCollection = collection(db, 'support_threads', selectedThreadId, 'messages');
      const unsubscribe = onSnapshot(
        msgsCollection,
        (snapshot) => {
          const msgs: SupportMessage[] = snapshot.docs.map((d) => {
            const data = d.data();
            let timeStr = data.createdAt || data.timestamp || '';
            if (typeof timeStr === 'object' && timeStr?.toDate) {
              timeStr = timeStr.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else if (typeof timeStr !== 'string') {
              timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            const mediaUrl = data.mediaUrl || data.imageUrl || data.videoUrl || '';
            let mediaType: 'image' | 'video' | 'none' = data.mediaType || 'none';
            if (mediaType === 'none' && mediaUrl) {
              mediaType = (data.videoUrl || mediaUrl.startsWith('data:video/')) ? 'video' : 'image';
            }

            return {
              id: d.id,
              sender: data.sender || 'user',
              text: data.text || '',
              timestamp: timeStr,
              createdAt: data.createdAt || data.timestamp,
              imageUrl: data.imageUrl || (mediaType === 'image' ? mediaUrl : undefined),
              videoUrl: data.videoUrl || (mediaType === 'video' ? mediaUrl : undefined),
              mediaUrl: mediaUrl,
              mediaType: mediaType,
              fileName: data.fileName || '',
              source: data.source,
              adminName: data.adminName,
            };
          });

          // Sort messages client-side by creation order / timestamp
          msgs.sort((a, b) => {
            const tA = a.createdAt?.seconds || (typeof a.createdAt === 'number' ? a.createdAt : 0);
            const tB = b.createdAt?.seconds || (typeof b.createdAt === 'number' ? b.createdAt : 0);
            if (tA && tB) return tA - tB;
            return (a.id || '').localeCompare(b.id || '');
          });

          setMessages(msgs);

          // Mark as read by admin when opened
          setDoc(
            doc(db, 'support_threads', selectedThreadId),
            { unreadByAdmin: false, unreadForAdmin: false },
            { merge: true }
          ).catch(() => {});
        },
        (err) => {
          console.warn('Error fetching thread messages:', err);
        }
      );

      return () => unsubscribe();
    } catch (e) {
      console.warn('Thread messages listener exception:', e);
    }
  }, [selectedThreadId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, adminMedia]);

  // Handle Admin Media Upload (Image or Video)
  const handleAdminFileSelect = (e: React.ChangeEvent<HTMLInputElement>, preferredType?: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      showToast('ফাইলের সাইজ সর্বোচ্চ 15MB হতে পারবে।', 'error');
      return;
    }

    const isVideo = file.type.startsWith('video/') || preferredType === 'video';
    const reader = new FileReader();
    reader.onload = () => {
      setAdminMedia({
        dataUrl: reader.result as string,
        type: isVideo ? 'video' : 'image',
        name: file.name,
      });
      showToast(isVideo ? '🎥 ভিডিও সংযুক্ত হয়েছে' : '📷 ছবি সংযুক্ত হয়েছে', 'info');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Send Admin Reply
  const handleSendAdminReply = async (textOverride?: string) => {
    const textToSend = (textOverride !== undefined ? textOverride : adminReplyText).trim();
    if (!textToSend && !adminMedia) return;
    if (!selectedThreadId || isSending) return;

    const currentMedia = adminMedia;
    setAdminMedia(null);
    if (!textOverride) setAdminReplyText('');
    setIsSending(true);

    const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
      const msgsCollection = collection(db, 'support_threads', selectedThreadId, 'messages');
      await addDoc(msgsCollection, {
        sender: 'admin',
        text: textToSend,
        mediaUrl: currentMedia?.dataUrl || '',
        mediaType: currentMedia ? currentMedia.type : 'none',
        imageUrl: currentMedia?.type === 'image' ? currentMedia.dataUrl : '',
        videoUrl: currentMedia?.type === 'video' ? currentMedia.dataUrl : '',
        fileName: currentMedia?.name || '',
        adminName: adminUser?.name || 'এডমিন',
        createdAt: nowTimeStr,
        timestamp: serverTimestamp(),
        source: 'admin_panel',
      });

      // Update thread state in Firestore
      await setDoc(
        doc(db, 'support_threads', selectedThreadId),
        {
          lastMessage: textToSend || (currentMedia ? `[Admin sent ${currentMedia.type}]` : ''),
          lastMessageCreatedAt: nowTimeStr,
          lastMessageTime: serverTimestamp(),
          lastSender: 'admin',
          unreadByAdmin: false,
          unreadForAdmin: false,
          unreadForUser: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      haptic('success');
      showToast('মেসেজ সফলভাবে ইউজারের কাছে পাঠানো হয়েছে! ✅', 'success');
    } catch (err) {
      console.error('Error sending admin reply:', err);
      showToast('মেসেজ পাঠাতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Toggle Support / AI Feature Globally
  const handleToggleAi = async () => {
    if (isTogglingAi) return;
    setIsTogglingAi(true);
    haptic('heavy');
    try {
      const nextState = !aiSupportEnabled;
      await onToggleAiSupport(nextState);
      showToast(
        nextState ? '⚡ লাইভ এআই সাপোর্ট চালু করা হয়েছে (ইউজার একাউন্টে দৃশ্যমান)' : '⛔ লাইভ এআই সাপোর্ট বন্ধ করা হয়েছে (ইউজার একাউন্টে আর দেখাবে না)',
        nextState ? 'success' : 'info'
      );
    } catch (e) {
      showToast('সেটিংস আপডেট ব্যর্থ হয়েছে', 'error');
    } finally {
      setIsTogglingAi(false);
    }
  };

  // Delete Thread
  const handleDeleteThread = async (tId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('আপনি কি এই ইউজারের চ্যাট হিস্টোরি মুছে ফেলতে চান?')) return;
    try {
      await deleteDoc(doc(db, 'support_threads', tId));
      if (selectedThreadId === tId) {
        setSelectedThreadId(null);
      }
      showToast('চ্যাট মুছে ফেলা হয়েছে', 'info');
    } catch (err) {
      console.error('Error deleting thread:', err);
      showToast('চ্যাট মুছতে ব্যর্থ হয়েছে', 'error');
    }
  };

  // Mark Thread as Resolved
  const handleToggleResolved = async (tId: string, currentStatus?: string) => {
    const nextStatus = currentStatus === 'resolved' ? 'active' : 'resolved';
    try {
      await setDoc(
        doc(db, 'support_threads', tId),
        { status: nextStatus, updatedAt: serverTimestamp() },
        { merge: true }
      );
      showToast(nextStatus === 'resolved' ? 'টিকেট সম্পন্ন (Resolved) করা হয়েছে' : 'টিকেট রি-ওপেন করা হয়েছে', 'success');
    } catch (e) {
      showToast('আপডেট ব্যর্থ হয়েছে', 'error');
    }
  };

  // Filtered threads list
  const filteredThreads = threads.filter((t) => {
    if (filterStatus === 'unread' && !t.unreadByAdmin) return false;
    if (filterStatus === 'media' && !t.hasMedia) return false;
    if (filterStatus === 'resolved' && t.status !== 'resolved') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (t.name || '').toLowerCase().includes(q);
      const matchUsername = (t.username || '').toLowerCase().includes(q);
      const matchEmail = (t.email || '').toLowerCase().includes(q);
      const matchLastMsg = (t.lastMessage || '').toLowerCase().includes(q);
      return matchName || matchUsername || matchEmail || matchLastMsg;
    }
    return true;
  });

  const selectedThread = threads.find((t) => t.id === selectedThreadId);
  const totalUnread = threads.filter((t) => t.unreadByAdmin).length;

  return (
    <div className="space-y-4">
      {/* 1. MASTER HEADER & ON/OFF SWITCH */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-amber-500/30 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-black flex items-center justify-center text-xl font-black shadow-lg shadow-amber-500/20">
            <i className="fas fa-headset"></i>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                Live Support & Media Center
              </h3>
              <span
                className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold border ${
                  aiSupportEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-red-500/20 text-red-300 border-red-500/40'
                }`}
              >
                {aiSupportEnabled ? '● SUPPORT ACTIVE (ইউজারে চালু)' : '○ SUPPORT OFF (ইউজারে বন্ধ)'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              ইউজারদের পাঠানো মেসেজ, ছবি ও ভিডিও দেখুন এবং সরাসরি এডমিন প্যানেল থেকে রিপ্লাই দিন।
            </p>
          </div>
        </div>

        {/* Global ON / OFF Toggle Controls */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-2.5 bg-slate-950/80 px-4 py-2 rounded-2xl border border-white/10">
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-300 block">লাইভ সাপোর্ট সুইচ</span>
              <span className="text-[9px] text-slate-400">
                {aiSupportEnabled ? 'ইউজার একাউন্টে দৃশ্যমান' : 'ইউজার একাউন্ট থেকে সম্পূর্ণ লুকানো'}
              </span>
            </div>
            <button
              onClick={handleToggleAi}
              disabled={isTogglingAi}
              className={`px-3.5 py-1.5 rounded-xl font-black text-xs transition shadow-md flex items-center gap-1.5 ${
                aiSupportEnabled
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-black hover:opacity-90'
                  : 'bg-red-500/30 text-red-300 border border-red-500/50 hover:bg-red-500/40'
              }`}
            >
              <i className={`fas ${aiSupportEnabled ? 'fa-toggle-on text-sm' : 'fa-toggle-off text-sm'}`}></i>
              <span>{aiSupportEnabled ? 'ON (চালু)' : 'OFF (বন্ধ)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. CHAT INBOX & CONVERSATION GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[650px] bg-slate-900/60 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        
        {/* LEFT COLUMN: User Threads List */}
        <div className="lg:col-span-5 bg-slate-950/80 border-r border-white/10 flex flex-col h-full overflow-hidden">
          
          {/* Header & Search */}
          <div className="p-3.5 border-b border-white/10 space-y-2.5 bg-slate-900/90">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-xs text-white uppercase tracking-wider">
                  ইউজার ইনবক্স ({threads.length})
                </h4>
                {totalUnread > 0 && (
                  <span className="bg-red-500 text-white font-mono font-black text-[10px] px-2 py-0.2 rounded-full animate-pulse">
                    {totalUnread} নতুন
                  </span>
                )}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ইউজারনেম বা মেসেজ দিয়ে সার্চ..."
                className="w-full bg-slate-950 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 pt-1 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition shrink-0 ${
                  filterStatus === 'all'
                    ? 'bg-amber-500 text-black'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                সব ({threads.length})
              </button>
              <button
                onClick={() => setFilterStatus('unread')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition shrink-0 flex items-center gap-1 ${
                  filterStatus === 'unread'
                    ? 'bg-red-500 text-white'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                <i className="fas fa-envelope"></i> নতুন ({totalUnread})
              </button>
              <button
                onClick={() => setFilterStatus('media')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition shrink-0 flex items-center gap-1 ${
                  filterStatus === 'media'
                    ? 'bg-purple-500 text-white'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                <i className="fas fa-photo-video"></i> ছবি ও ভিডিও
              </button>
              <button
                onClick={() => setFilterStatus('resolved')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition shrink-0 flex items-center gap-1 ${
                  filterStatus === 'resolved'
                    ? 'bg-emerald-500 text-black'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                <i className="fas fa-check-circle"></i> সমাধানকৃত
              </button>
            </div>
          </div>

          {/* Threads List */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/5 scrollbar-thin">
            {filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                <i className="fas fa-inbox text-3xl mb-2 text-slate-600 block"></i>
                কোনো সাপোর্ট মেসেজ নেই।
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isSelected = selectedThreadId === thread.id;
                return (
                  <div
                    key={thread.id}
                    onClick={() => {
                      setSelectedThreadId(thread.id);
                      haptic('light');
                    }}
                    className={`p-3.5 transition cursor-pointer flex items-start gap-3 relative ${
                      isSelected
                        ? 'bg-amber-500/15 border-l-4 border-amber-400'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    {/* User Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center font-black text-amber-300 text-sm">
                        {thread.name ? thread.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      {thread.unreadByAdmin && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 border-2 border-slate-950 rounded-full animate-ping"></span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h5 className="font-extrabold text-xs text-white truncate flex items-center gap-1.5">
                          <span>{thread.name}</span>
                          {thread.hasMedia && (
                            <span className="text-purple-400 text-[10px]" title="Media Attached">
                              <i className="fas fa-paperclip"></i>
                            </span>
                          )}
                          {thread.status === 'resolved' && (
                            <span className="text-emerald-400 text-[9px]" title="Resolved">
                              <i className="fas fa-check-circle"></i>
                            </span>
                          )}
                        </h5>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {thread.lastMessageCreatedAt || ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                        <span>@{thread.username || 'user'}</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-mono font-bold">
                          ৳{(thread.balance || 0).toFixed(0)}
                        </span>
                        <span>•</span>
                        <span className="text-blue-400 font-mono">
                          {thread.totalOrders || 0} ord
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-300 truncate mt-1">
                        {thread.lastMessage || 'মেসেজ দেখতে ক্লিক করুন...'}
                      </p>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDeleteThread(thread.id, e)}
                      className="text-slate-500 hover:text-red-400 p-1 text-xs transition shrink-0"
                      title="Delete chat thread"
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Chat Messages & Admin Reply Box */}
        <div className="lg:col-span-7 bg-slate-900/90 flex flex-col h-full overflow-hidden">
          {selectedThread ? (
            <>
              {/* Active User Header */}
              <div className="p-3.5 bg-slate-950/90 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-black text-sm">
                    {selectedThread.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs sm:text-sm text-white flex items-center gap-2">
                      <span>{selectedThread.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        (@{selectedThread.username || selectedThread.uid})
                      </span>
                    </h4>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-0.5">
                      <span>
                        ব্যালেন্স: <strong className="text-emerald-400 font-mono">৳{(selectedThread.balance || 0).toFixed(2)}</strong>
                      </span>
                      <span>
                        অর্ডার: <strong className="text-blue-400 font-mono">{selectedThread.totalOrders || 0}টি</strong>
                      </span>
                      {selectedThread.status === 'resolved' ? (
                        <span className="text-emerald-400 font-bold">● Resolved</span>
                      ) : (
                        <span className="text-amber-400 font-bold">● Active</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleResolved(selectedThread.id, selectedThread.status)}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition ${
                      selectedThread.status === 'resolved'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    {selectedThread.status === 'resolved' ? 'Re-open' : '✓ Resolve'}
                  </button>
                  <a
                    href={`https://wa.me/?text=Hello%20${selectedThread.name}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-8 h-8 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xs transition"
                    title="Direct WhatsApp"
                  >
                    <i className="fab fa-whatsapp"></i>
                  </a>
                </div>
              </div>

              {/* Messages Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
                {messages.map((msg, idx) => {
                  const isUser = msg.sender === 'user';
                  const isAdmin = msg.sender === 'admin';
                  const isAI = msg.sender === 'ai';

                  return (
                    <div
                      key={msg.id || idx}
                      className={`flex items-start gap-2.5 ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {/* Avatar */}
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0 ${
                          isAdmin
                            ? 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white font-black shadow-md border border-amber-300'
                            : isUser
                            ? 'bg-blue-600/80 text-white font-black'
                            : 'bg-emerald-600/80 text-white border border-emerald-400/40'
                        }`}
                      >
                        <i className={isAdmin ? 'fas fa-crown' : isUser ? 'fas fa-user' : 'fas fa-robot'}></i>
                      </div>

                      {/* Bubble */}
                      <div
                        className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                          isAdmin
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-medium rounded-tr-xs shadow-md'
                            : isUser
                            ? 'bg-slate-800 border border-white/10 text-white rounded-tl-xs shadow-md'
                            : 'bg-slate-850 border border-emerald-500/30 text-slate-200 rounded-tl-xs'
                        }`}
                      >
                        {/* Sender Label */}
                        <div
                          className={`text-[9px] font-extrabold mb-1 flex items-center justify-between gap-2 pb-1 border-b ${
                            isAdmin
                              ? 'text-slate-900 border-black/10'
                              : isUser
                              ? 'text-blue-300 border-white/10'
                              : 'text-emerald-300 border-emerald-500/20'
                          }`}
                        >
                          <span>{isAdmin ? '👑 আপনি (এডমিন)' : isUser ? '👤 ইউজার' : '🤖 AI সহকারী'}</span>
                          <span className="font-mono font-normal opacity-80">{msg.timestamp}</span>
                        </div>

                        {/* Text */}
                        {msg.text && <div className="whitespace-pre-wrap">{msg.text}</div>}

                        {/* Attached Image */}
                        {(msg.mediaType === 'image' || msg.imageUrl) && (
                          <div className="mt-2 rounded-xl overflow-hidden border border-white/15 bg-black/40 relative group cursor-pointer">
                            <img
                              src={msg.imageUrl || msg.mediaUrl}
                              alt="Attachment"
                              className="max-h-60 w-full object-cover rounded-xl transition group-hover:scale-105"
                              onClick={() => setViewingMedia({ url: (msg.imageUrl || msg.mediaUrl)!, type: 'image' })}
                            />
                            <button
                              onClick={() => setViewingMedia({ url: (msg.imageUrl || msg.mediaUrl)!, type: 'image' })}
                              className="absolute bottom-2 right-2 bg-black/70 hover:bg-black text-white px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1"
                            >
                              <i className="fas fa-expand"></i> বড় করুন
                            </button>
                          </div>
                        )}

                        {/* Attached Video */}
                        {(msg.mediaType === 'video' || msg.videoUrl) && (
                          <div className="mt-2 rounded-xl overflow-hidden border border-white/15 bg-black/60 relative">
                            <video
                              src={msg.videoUrl || msg.mediaUrl}
                              controls
                              className="max-h-64 w-full rounded-xl"
                              preload="metadata"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Canned Replies Bar */}
              <div className="px-3 py-1.5 bg-slate-950/80 border-t border-white/5 overflow-x-auto whitespace-nowrap flex items-center gap-1.5 scrollbar-none">
                <span className="text-[9px] text-slate-400 font-bold shrink-0">দ্রুত উত্তর:</span>
                {QUICK_ADMIN_REPLIES.map((txt, i) => (
                  <button
                    key={i}
                    disabled={isSending}
                    onClick={() => handleSendAdminReply(txt)}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-white/10 text-[10px] transition shrink-0 active:scale-95 disabled:opacity-50"
                  >
                    {txt}
                  </button>
                ))}
              </div>

              {/* Admin Media Attachment Preview */}
              {adminMedia && (
                <div className="p-2 bg-slate-950 border-t border-amber-500/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {adminMedia.type === 'image' ? (
                      <img
                        src={adminMedia.dataUrl}
                        alt="Preview"
                        className="w-10 h-10 object-cover rounded-xl border border-amber-400"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400 flex items-center justify-center text-purple-300">
                        <i className="fas fa-video"></i>
                      </div>
                    )}
                    <span className="text-xs text-white truncate max-w-xs">{adminMedia.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdminMedia(null)}
                    className="w-7 h-7 rounded-lg bg-red-500/20 text-red-300 flex items-center justify-center text-xs"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              )}

              {/* Admin Reply Input */}
              <div className="p-3 bg-slate-950 border-t border-white/10">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => handleAdminFileSelect(e)}
                  className="hidden"
                  accept="image/*,video/*"
                />

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendAdminReply();
                  }}
                  className="flex items-center gap-2"
                >
                  {/* Photo picker */}
                  <button
                    type="button"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = 'image/*';
                        fileInputRef.current.click();
                      }
                    }}
                    className="w-9 h-9 rounded-xl bg-white/5 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-white/10 flex items-center justify-center text-sm transition shrink-0"
                    title="ছবি পাঠান"
                  >
                    <i className="fas fa-image"></i>
                  </button>

                  {/* Video picker */}
                  <button
                    type="button"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = 'video/*';
                        fileInputRef.current.click();
                      }
                    }}
                    className="w-9 h-9 rounded-xl bg-white/5 hover:bg-purple-500/20 text-slate-300 hover:text-purple-300 border border-white/10 flex items-center justify-center text-sm transition shrink-0"
                    title="ভিডিও পাঠান"
                  >
                    <i className="fas fa-video"></i>
                  </button>

                  {/* Text Input */}
                  <input
                    type="text"
                    value={adminReplyText}
                    onChange={(e) => setAdminReplyText(e.target.value)}
                    placeholder="ইউজারকে মেসেজ লিখুন..."
                    disabled={isSending}
                    className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
                  />

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={isSending || (!adminReplyText.trim() && !adminMedia)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-extrabold text-xs transition shadow-lg shadow-amber-500/20 disabled:opacity-40 flex items-center gap-1.5 active:scale-95"
                  >
                    <i className="fas fa-paper-plane"></i>
                    <span>পাঠান</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <i className="fas fa-comments text-4xl mb-3 text-slate-600"></i>
              <h4 className="font-extrabold text-sm text-slate-300">কোনো চ্যাট নির্বাচিত হয়নি</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                বাম পাশের তালিকা থেকে যেকোনো ইউজারের নামের উপর ক্লিক করে চ্যাট হিস্টোরি, ছবি ও ভিডিও দেখুন এবং সরাসরি উত্তর দিন।
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Media Zoom Modal */}
      {viewingMedia && (
        <div
          onClick={() => setViewingMedia(null)}
          className="fixed inset-0 z-[10001] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="relative max-w-5xl max-h-[90vh] bg-slate-900 border border-white/20 rounded-2xl overflow-hidden shadow-2xl p-2">
            {viewingMedia.type === 'image' ? (
              <img
                src={viewingMedia.url}
                alt="Full Preview"
                className="w-full h-full object-contain max-h-[85vh] rounded-xl"
              />
            ) : (
              <video
                src={viewingMedia.url}
                controls
                autoPlay
                className="w-full h-full max-h-[85vh] rounded-xl"
              />
            )}
            <button
              onClick={() => setViewingMedia(null)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/70 text-white flex items-center justify-center text-sm border border-white/20"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
