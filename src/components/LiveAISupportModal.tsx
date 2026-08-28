import React, { useState, useEffect, useRef } from 'react';
import {
  db,
  doc,
  collection,
  onSnapshot,
  setDoc,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
} from '../firebase';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai' | 'admin';
  text: string;
  timestamp: string;
  createdAt?: any;
  imageUrl?: string;
  videoUrl?: string;
  source?: 'gemini' | 'smart_engine' | 'admin';
  adminName?: string;
}

interface LiveAISupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: {
    uid?: string;
    name?: string;
    username?: string;
    email?: string;
  } | null;
  userBalance?: number;
  userTotalOrders?: number;
  aiSupportEnabled?: boolean;
  onNavigateToDeposit?: () => void;
  onNavigateToOrders?: () => void;
  onNavigateToReferral?: () => void;
}

const QUICK_PROMPTS = [
  { label: '💳 ডিপোজিট কীভাবে করব?', prompt: 'বিকাশ/নগদ/রকেটে কীভাবে ডিপোজিট করতে হয় এবং কতক্ষণ লাগে?' },
  { label: '🚀 অর্ডার কতক্ষণে স্টার্ট হবে?', prompt: 'অর্ডার করার পর সার্ভিস ডেলিভারি পেতে কত সময় লাগে?' },
  { label: '🎁 ৫% রেফারেল বোনাস কীভাবে পাব?', prompt: 'রেফারেল বোনাস কীভাবে কাজ করে এবং কত শতাংশ বোনাস পাওয়া যায়?' },
  { label: '🏆 ফ্রিতে টাকা ইনকাম (Tasks)', prompt: 'ডেইলি টাস্ক কমপ্লিট করে কীভাবে ফ্রিতে ব্যালেন্স ইনকাম করব?' },
  { label: '👨‍💼 সরাসরি এডমিন সাপোর্ট', prompt: 'জরুরি প্রয়োজনে সরাসরি এডমিনের সাথে কথা বলার উপায় কি?' },
];

export const LiveAISupportModal: React.FC<LiveAISupportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  userBalance = 0,
  userTotalOrders = 0,
  aiSupportEnabled = true,
  onNavigateToDeposit,
  onNavigateToOrders,
  onNavigateToReferral,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [videoLinkInput, setVideoLinkInput] = useState('');
  const [showVideoInputModal, setShowVideoInputModal] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  const userUid = currentUser?.uid || 'guest_user';

  // 1. Real-time sync with Firestore support thread
  useEffect(() => {
    if (!isOpen) return;

    if (currentUser?.uid) {
      const q = query(
        collection(db, 'support_threads', currentUser.uid, 'messages'),
        orderBy('createdAt', 'asc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const fetched: ChatMessage[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            let timeStr = '';
            if (data.createdAt?.toDate) {
              timeStr = data.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else if (data.timestamp) {
              timeStr = data.timestamp;
            } else {
              timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            return {
              id: docSnap.id,
              sender: data.sender || 'ai',
              text: data.text || '',
              timestamp: timeStr,
              createdAt: data.createdAt,
              imageUrl: data.imageUrl || undefined,
              videoUrl: data.videoUrl || undefined,
              source: data.source || undefined,
              adminName: data.adminName || undefined,
            };
          });

          setMessages(fetched);
        } else {
          // Initialize initial welcome message
          const welcomeMsg: ChatMessage = {
            id: 'welcome-1',
            sender: 'ai',
            text: `👋 স্বাগতম **${currentUser?.name || 'প্রিয় গ্রাহক'}**! আমি **RF SMM AI লাইভ সাপোর্ট সহকারী**।\n\nসোশ্যাল মিডিয়া সার্ভিস, ইনস্ট্যান্ট বিকাশ/নগদ ডিপোজিট, ৫% রেফারেল বোনাস বা অর্ডার সংক্রান্ত যেকোনো প্রশ্ন বা সমস্যা আমাকে জানান। আপনি ছবি ও স্ক্রিনশট বা ভিডিও যুক্ত করেও সাহায্য চাইতে পারেন! ⚡`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            source: 'smart_engine',
          };
          setMessages([welcomeMsg]);
        }
      });

      return () => unsubscribe();
    } else {
      // Fallback local storage for guest
      const saved = localStorage.getItem('rf_ai_chat_history');
      if (saved) {
        try {
          setMessages(JSON.parse(saved));
        } catch (e) {
          // fallback
        }
      } else {
        setMessages([
          {
            id: 'welcome-guest',
            sender: 'ai',
            text: `👋 স্বাগতম! আমি **RF SMM AI লাইভ সাপোর্ট সহকারী**। সোশ্যাল মিডিয়া মার্কেটিং এবং ডিপোজিট সংক্রান্ত যেকোনো বিষয়ে আমি সাহায্য করতে পারি।`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            source: 'smart_engine',
          },
        ]);
      }
    }
  }, [isOpen, currentUser?.uid]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen, selectedImage, selectedVideo]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Image Selection and Base64 Compression
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      alert('ছবির সাইজ সর্বোচ্চ 8MB হতে পারবে।');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        setSelectedImage(compressedBase64);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Handle Video Upload
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('ভিডিওর সাইজ সর্বোচ্চ 15MB হতে পারবে। বড় ভিডিও হলে লিংক শেয়ার করুন।');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedVideo(event.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Send Message function
  const handleSendMessage = async (textToSend?: string) => {
    const queryText = (textToSend || inputVal).trim();
    const imageToSend = selectedImage;
    const videoToSend = selectedVideo || (videoLinkInput.trim() ? videoLinkInput.trim() : null);

    if (!queryText && !imageToSend && !videoToSend) return;
    if (isLoading) return;

    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: queryText || (imageToSend ? '📷 [ছবি / স্ক্রিনশট সংযুক্ত করা হয়েছে]' : '🎥 [ভিডিও সংযুক্ত করা হয়েছে]'),
      timestamp: timeString,
      imageUrl: imageToSend || undefined,
      videoUrl: videoToSend || undefined,
    };

    // Optimistic update
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputVal('');
    setSelectedImage(null);
    setSelectedVideo(null);
    setVideoLinkInput('');
    setShowVideoInputModal(false);
    setIsLoading(true);

    // Save user message to Firestore if logged in
    if (currentUser?.uid) {
      try {
        await addDoc(collection(db, 'support_threads', currentUser.uid, 'messages'), {
          sender: 'user',
          text: userMsg.text,
          imageUrl: userMsg.imageUrl || '',
          videoUrl: userMsg.videoUrl || '',
          timestamp: timeString,
          createdAt: serverTimestamp(),
        });

        // Update thread summary for Admin Inbox
        await setDoc(
          doc(db, 'support_threads', currentUser.uid),
          {
            uid: currentUser.uid,
            name: currentUser.name || 'User',
            username: currentUser.username || '',
            email: currentUser.email || '',
            balance: userBalance,
            totalOrders: userTotalOrders,
            lastMessage: userMsg.text,
            lastMessageTime: serverTimestamp(),
            unreadByAdmin: true,
            status: 'active',
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (dbErr) {
        console.warn('Firestore write notice:', dbErr);
      }
    }

    try {
      // Build history for context
      const chatHistory = messages.slice(-5).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        text: m.text,
      }));

      const res = await fetch('/api/ai-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: queryText,
          image: imageToSend,
          videoUrl: videoToSend,
          history: chatHistory,
          userContext: {
            name: currentUser?.name || 'Customer',
            username: currentUser?.username || '',
            uid: currentUser?.uid || '',
            balance: userBalance,
            totalOrders: userTotalOrders,
          },
        }),
      });

      if (!res.ok) {
        throw new Error('API response failed');
      }

      const data = await res.json();
      const aiReply = data.reply || 'দুঃখিত, কোনো ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন অথবা সরাসরি এডমিনের সাথে যোগাযোগ করুন।';

      const aiMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        sender: 'ai',
        text: aiReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: data.source || 'gemini',
      };

      // Save AI reply to Firestore if logged in
      if (currentUser?.uid) {
        try {
          await addDoc(collection(db, 'support_threads', currentUser.uid, 'messages'), {
            sender: 'ai',
            text: aiReply,
            source: data.source || 'gemini',
            timestamp: aiMsg.timestamp,
            createdAt: serverTimestamp(),
          });

          await setDoc(
            doc(db, 'support_threads', currentUser.uid),
            {
              lastMessage: aiReply.substring(0, 120),
              lastMessageTime: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (saveAiErr) {
          console.warn('Firestore save AI reply err:', saveAiErr);
        }
      } else {
        setMessages((prev) => [...prev, aiMsg]);
        localStorage.setItem('rf_ai_chat_history', JSON.stringify([...messages, userMsg, aiMsg].slice(-25)));
      }
    } catch (err: any) {
      console.error('Chat AI error:', err);
      const fallbackMsg: ChatMessage = {
        id: 'msg-err-' + Date.now(),
        sender: 'ai',
        text: `সাপোর্টে সাময়িক সমস্যা হয়েছে। আপনি সরাসরি আমাদের **হোয়াটসঅ্যাপ (+8801342163841)** বা **টেলিগ্রাম (@RF2_SMM)** এডমিন সাপোর্টে যোগাযোগ করতে পারেন।`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: 'smart_engine',
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Text-To-Speech (Voice Output)
  const handleSpeakText = (text: string) => {
    if (!('speechSynthesis' in window)) {
      alert('আপনার ব্রাউজারে স্পিচ সিন্থেসিস সাপোর্ট নেই।');
      return;
    }
    window.speechSynthesis.cancel();

    if (isSpeaking) {
      setIsSpeaking(false);
      return;
    }

    const cleanText = text.replace(/[*#_`]/g, '').replace(/https?:\/\/[^\s]+/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'bn-BD';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  // Speech Recognition (Voice Input)
  const handleToggleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('আপনার ব্রাউজারে ভয়েস ইনপুট সাপোর্ট নেই। অনুগ্রহ করে টাইপ করুন।');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'bn-BD';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputVal((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm('আপনি কি এই চ্যাট ক্লিয়ার করতে চান?')) {
      const initial: ChatMessage = {
        id: 'welcome-reset',
        sender: 'ai',
        text: `👋 চ্যাট হিস্টোরি ক্লিয়ার করা হয়েছে। আমি **RF SMM AI অ্যাসিস্ট্যান্ট**, বলুন আপনাকে কীভাবে সাহায্য করতে পারি?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: 'smart_engine',
      };
      setMessages([initial]);
      localStorage.removeItem('rf_ai_chat_history');
    }
  };

  // Helper to render bold markdown and clickable links
  const renderFormattedText = (txt: string) => {
    const parts = txt.split('\n');
    return parts.map((line, lIdx) => {
      const boldRegex = /\*\*(.*?)\*\*/g;
      const elements = [];
      let lastIdx = 0;
      let match;

      while ((match = boldRegex.exec(line)) !== null) {
        if (match.index > lastIdx) {
          elements.push(line.substring(lastIdx, match.index));
        }
        elements.push(
          <strong key={`b-${lIdx}-${match.index}`} className="font-extrabold text-amber-300">
            {match[1]}
          </strong>
        );
        lastIdx = match.index + match[0].length;
      }
      if (lastIdx < line.length) {
        elements.push(line.substring(lastIdx));
      }

      return (
        <span key={`line-${lIdx}`} className="block min-h-[1.1rem]">
          {elements.length > 0 ? elements : line}
        </span>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#0a1124] border border-amber-500/40 rounded-3xl shadow-[0_10px_50px_rgba(0,0,0,0.8)] flex flex-col h-[90vh] max-h-[700px] overflow-hidden relative text-white">
        
        {/* Hidden File Inputs */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
        <input
          type="file"
          ref={videoFileInputRef}
          accept="video/*"
          className="hidden"
          onChange={handleVideoUpload}
        />

        {/* Glow Decorators */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Modal Header */}
        <div className="p-4 bg-slate-900/90 border-b border-white/10 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-black flex items-center justify-center font-black text-lg shadow-lg shadow-amber-500/30">
                <i className="fas fa-robot"></i>
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-slate-900 rounded-full ${aiSupportEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-white flex items-center gap-1.5">
                  <span>RF SMM AI Live Support</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    24/7 AI & ADMIN
                  </span>
                </h3>
              </div>
              <p className={`text-[10px] font-medium flex items-center gap-1 ${aiSupportEnabled ? 'text-emerald-400' : 'text-amber-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${aiSupportEnabled ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                {aiSupportEnabled ? 'অনলাইন আছেন • ইনস্ট্যান্ট রিপ্লাই ও ইমেজ ভিশন' : 'এডমিন সাপোর্ট সক্রিয়'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleClearHistory}
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-300 flex items-center justify-center text-xs transition border border-white/5"
              title="Clear Chat History (হিস্টোরি মুছুন)"
            >
              <i className="fas fa-trash-alt"></i>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white flex items-center justify-center text-sm transition border border-white/5 cursor-pointer"
              title="Close"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {/* User Context Bar */}
        <div className="px-4 py-2 bg-slate-950/60 border-b border-white/5 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-3">
            <span className="text-slate-400">
              ব্যালেন্স: <strong className="text-emerald-400 font-mono font-bold">৳{userBalance.toFixed(2)}</strong>
            </span>
            <span className="text-slate-400">
              মোট অর্ডার: <strong className="text-blue-400 font-mono font-bold">{userTotalOrders}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onNavigateToDeposit && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToDeposit();
                }}
                className="text-[10px] text-amber-400 hover:underline font-bold cursor-pointer"
              >
                + ডিপোজিট
              </button>
            )}
            {onNavigateToOrders && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToOrders();
                }}
                className="text-[10px] text-blue-400 hover:underline font-bold cursor-pointer"
              >
                অর্ডার
              </button>
            )}
          </div>
        </div>

        {/* Chat Messages List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const isAdmin = msg.sender === 'admin';

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0 ${
                    isUser
                      ? 'bg-amber-500 text-black font-extrabold shadow-sm'
                      : isAdmin
                      ? 'bg-gradient-to-tr from-amber-500 to-orange-600 text-white font-extrabold shadow-lg shadow-amber-500/40 border border-amber-300'
                      : 'bg-blue-600/80 text-white border border-blue-400/40 shadow-sm'
                  }`}
                >
                  <i className={isUser ? 'fas fa-user' : isAdmin ? 'fas fa-crown text-amber-200' : 'fas fa-robot'}></i>
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[84%] rounded-2xl p-3 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-medium rounded-tr-xs shadow-md'
                      : isAdmin
                      ? 'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-2 border-amber-400/70 text-white rounded-tl-xs shadow-[0_4px_20px_rgba(245,158,11,0.25)]'
                      : 'bg-slate-800/90 border border-white/10 text-slate-200 rounded-tl-xs shadow-lg'
                  }`}
                >
                  {/* Admin Header Badge */}
                  {isAdmin && (
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-amber-500/30">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase text-amber-300 flex items-center gap-1">
                          <i className="fas fa-shield-halved"></i>
                          <span>{msg.adminName || 'এডমিন সাপোর্ট (Admin Reply)'}</span>
                        </span>
                      </div>
                      <span className="text-[9px] bg-amber-500 text-black font-extrabold px-1.5 py-0.2 rounded-full">
                        OFFICIAL
                      </span>
                    </div>
                  )}

                  {/* Attached Image Preview */}
                  {msg.imageUrl && (
                    <div className="mb-2 rounded-xl overflow-hidden border border-white/20 relative group cursor-pointer bg-black/40">
                      <img
                        src={msg.imageUrl}
                        alt="Attached Proof"
                        className="max-h-52 w-full object-cover group-hover:scale-105 transition duration-200"
                        onClick={() => setViewingImage(msg.imageUrl || null)}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1">
                        <i className="fas fa-search-plus"></i> বড় করে দেখুন
                      </div>
                    </div>
                  )}

                  {/* Attached Video Preview */}
                  {msg.videoUrl && (
                    <div className="mb-2 rounded-xl overflow-hidden border border-white/20 bg-black p-1">
                      {msg.videoUrl.startsWith('data:video') || msg.videoUrl.endsWith('.mp4') || msg.videoUrl.endsWith('.webm') ? (
                        <video
                          src={msg.videoUrl}
                          controls
                          className="w-full max-h-52 rounded-lg"
                        />
                      ) : (
                        <div className="p-2.5 bg-slate-900 rounded-lg flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <i className="fas fa-video text-amber-400"></i>
                            <span className="text-[11px] truncate text-sky-300 font-mono underline">
                              {msg.videoUrl}
                            </span>
                          </div>
                          <a
                            href={msg.videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 rounded bg-amber-500 text-black text-[10px] font-bold shrink-0"
                          >
                            ভিডিও দেখুন
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Text */}
                  <div className="whitespace-pre-wrap">{renderFormattedText(msg.text)}</div>

                  {/* Actions & Timestamp */}
                  <div
                    className={`mt-2 pt-1 border-t flex items-center justify-between text-[9px] ${
                      isUser ? 'border-black/10 text-slate-900' : 'border-white/5 text-slate-400'
                    }`}
                  >
                    <span>{msg.timestamp}</span>
                    <div className="flex items-center gap-2">
                      {!isUser && (
                        <button
                          onClick={() => handleSpeakText(msg.text)}
                          className="hover:text-amber-400 transition"
                          title="ভয়েসে শুনুন (Voice Playback)"
                        >
                          <i className={`fas ${isSpeaking ? 'fa-volume-slash text-amber-400' : 'fa-volume-up'}`}></i>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msg.text);
                        }}
                        className="hover:text-amber-400 transition"
                        title="কপি করুন"
                      >
                        <i className="fas fa-copy"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* AI Typing Animation */}
          {isLoading && (
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-blue-600/80 text-white border border-blue-400/40 flex items-center justify-center text-xs shrink-0">
                <i className="fas fa-robot"></i>
              </div>
              <div className="bg-slate-800/90 border border-white/10 rounded-2xl rounded-tl-xs p-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:0.4s]"></span>
                <span className="text-[10px] text-slate-400 ml-1.5">AI রেসপন্স তৈরি করছে...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Selected Media Attachments Preview Bar */}
        {(selectedImage || selectedVideo) && (
          <div className="px-4 py-2 bg-slate-950 border-t border-white/10 flex items-center gap-3">
            {selectedImage && (
              <div className="relative rounded-xl overflow-hidden border border-amber-400/50 w-16 h-16 bg-black shrink-0">
                <img src={selectedImage} alt="Attachment Preview" className="w-full h-full object-cover" />
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-600 text-white rounded-full flex items-center justify-center text-[9px]"
                  title="Remove Image"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            )}
            {selectedVideo && (
              <div className="relative rounded-xl overflow-hidden border border-cyan-400/50 p-2 bg-slate-900 flex items-center gap-2 flex-1">
                <i className="fas fa-video text-cyan-400 text-lg"></i>
                <div className="text-[10px] text-slate-300 truncate flex-1">
                  {selectedVideo.startsWith('data:video') ? 'ভিডিও ফাইল সংযুক্ত করা হয়েছে' : selectedVideo}
                </div>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px]"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Quick Suggestion Chips */}
        <div className="px-3 py-2 bg-slate-950/70 border-t border-white/5 overflow-x-auto whitespace-nowrap flex items-center gap-1.5 scrollbar-none">
          <span className="text-[10px] text-slate-400 font-bold shrink-0">
            <i className="fas fa-bolt text-amber-400 mr-1"></i>দ্রুত প্রশ্ন:
          </span>
          {QUICK_PROMPTS.map((qp, idx) => (
            <button
              key={idx}
              disabled={isLoading}
              onClick={() => handleSendMessage(qp.prompt)}
              className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-white/10 text-[11px] transition shrink-0 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {qp.label}
            </button>
          ))}
        </div>

        {/* Input & Send Controls */}
        <div className="p-3 bg-slate-900 border-t border-white/10">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-1.5 sm:gap-2"
          >
            {/* Attach Image Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/5 hover:bg-amber-500/20 hover:text-amber-300 text-slate-300 border border-white/10 flex items-center justify-center text-sm transition shrink-0 cursor-pointer"
              title="ছবি / স্ক্রিনশট পাঠান (Attach Image)"
            >
              <i className="fas fa-image"></i>
            </button>

            {/* Attach Video Button */}
            <button
              type="button"
              onClick={() => setShowVideoInputModal(true)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/5 hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300 border border-white/10 flex items-center justify-center text-sm transition shrink-0 cursor-pointer"
              title="ভিডিও লিংক বা ফাইল দিন (Attach Video)"
            >
              <i className="fas fa-video"></i>
            </button>

            {/* Voice Input Button */}
            <button
              type="button"
              onClick={handleToggleVoiceInput}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-sm transition border shrink-0 cursor-pointer ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse border-red-400'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
              }`}
              title="কথা বলে লিখুন (Voice Input)"
            >
              <i className={`fas ${isListening ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
            </button>

            {/* Text Input */}
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={selectedImage || selectedVideo ? "মিডিয়ার সাথে বার্তা লিখুন..." : "এখানে আপনার প্রশ্ন লিখুন..."}
              disabled={isLoading}
              className="flex-1 min-w-0 bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/80 transition"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={isLoading || (!inputVal.trim() && !selectedImage && !selectedVideo)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-extrabold flex items-center justify-center text-sm transition shadow-lg shadow-amber-500/20 disabled:opacity-40 shrink-0 active:scale-95 cursor-pointer"
              title="মেসেজ পাঠান"
            >
              <i className="fas fa-paper-plane"></i>
            </button>
          </form>

          {/* Direct Admin Links Footer */}
          <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
            <span className="text-slate-400">সরাসরি কথা বলুন:</span>
            <div className="flex items-center gap-2.5">
              <a
                href="https://t.me/RF2_SMM"
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:underline flex items-center gap-1 font-bold"
              >
                <i className="fab fa-telegram"></i> Telegram
              </a>
              <span className="text-slate-600">•</span>
              <a
                href="https://wa.me/8801342163841"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:underline flex items-center gap-1 font-bold"
              >
                <i className="fab fa-whatsapp"></i> WhatsApp
              </a>
            </div>
          </div>
        </div>

      </div>

      {/* Video Attachment Modal */}
      {showVideoInputModal && (
        <div className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl p-5 w-full max-w-sm text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <h4 className="font-extrabold text-sm flex items-center gap-2">
                <i className="fas fa-video text-cyan-400"></i>
                <span>ভিডিও লিংক বা ফাইল সংযুক্ত করুন</span>
              </h4>
              <button
                onClick={() => setShowVideoInputModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-300 font-bold block mb-1">
                  ভিডিও লিংক দিন (YouTube / Drive / Reel Link):
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={videoLinkInput}
                  onChange={(e) => setVideoLinkInput(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                — অথবা —
              </div>

              <button
                type="button"
                onClick={() => {
                  videoFileInputRef.current?.click();
                  setShowVideoInputModal(false);
                }}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition"
              >
                <i className="fas fa-file-video text-cyan-400"></i>
                <span>গ্যালারি বা ডিভাইস থেকে ভিডিও আপলোড (Max 15MB)</span>
              </button>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowVideoInputModal(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 text-slate-400 text-xs font-bold"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={() => {
                  if (videoLinkInput.trim()) {
                    setSelectedVideo(videoLinkInput.trim());
                  }
                  setShowVideoInputModal(false);
                }}
                className="flex-1 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-extrabold"
              >
                সংযুক্ত করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Preview Zoom Modal */}
      {viewingImage && (
        <div
          onClick={() => setViewingImage(null)}
          className="fixed inset-0 z-[10001] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-white/20 rounded-2xl overflow-hidden shadow-2xl p-2">
            <img
              src={viewingImage}
              alt="Screenshot Preview"
              className="w-full h-full object-contain max-h-[85vh] rounded-xl"
            />
            <button
              onClick={() => setViewingImage(null)}
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
