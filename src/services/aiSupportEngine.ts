import { GoogleGenAI } from "@google/genai";

export interface AIResponseResult {
  reply: string;
  source: 'gemini' | 'smart_engine';
}

export interface UserChatContext {
  name?: string;
  username?: string;
  uid?: string;
  balance?: number;
  totalOrders?: number;
  email?: string;
}

export async function generateAISupportResponse(
  userMessage: string,
  chatHistory: { role: 'user' | 'model'; text: string }[] = [],
  userContext?: UserChatContext
): Promise<AIResponseResult> {
  const msg = (userMessage || '').trim();
  const lower = msg.toLowerCase();

  // 1. Try Gemini API if available via server proxy or client environment
  try {
    const res = await fetch('/api/ai-support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        history: chatHistory.slice(-6),
        userContext: userContext || {}
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.reply && typeof data.reply === 'string' && data.reply.trim().length > 0) {
        return {
          reply: data.reply.trim(),
          source: data.source || 'gemini'
        };
      }
    }
  } catch (e) {
    // Fall back to intelligent client-side NLP engine
  }

  // 2. Intelligent Real-time Context-Aware Knowledge Engine (Bangla & English)
  let reply = '';

  // Greetings & Identity
  if (
    lower === 'hi' ||
    lower === 'hello' ||
    lower === 'hey' ||
    lower === 'হাই' ||
    lower === 'হ্যালো' ||
    lower.includes('কেমন আছ') ||
    lower.includes('সালাম') ||
    lower.includes('assalamu') ||
    lower.includes('salam')
  ) {
    const uName = userContext?.name || 'গ্রাহক';
    reply = `👋 আসসালামু আলাইকুম **${uName}**! আমি **RF SMM AI লাইভ সাপোর্ট সহকারী**।
আমি আপনাকে সার্বক্ষণিক ডিপোজিট, সোশ্যাল মিডিয়া অর্ডার, ৫% লাইফটাইম রেফারেল বোনাস এবং অ্যাকাউন্ট সংক্রান্ত যেকোনো বিষয়ে সাহায্য করতে পারি। 

💡 **আজ আপনাকে কীভাবে সহায়তা করতে পারি?**
• ডিপোজিট করার নিয়ম জানতে লিখুন: **ডিপোজিট**
• অর্ডারের গতি ও সময় জানতে লিখুন: **অর্ডার**
• ৫% বোনাস ও রেফার জানতে লিখুন: **রেফারেল**
• সরাসরি এডমিনের সাথে কথা বলতে লিখুন: **এডমিন**`;
  }
  // Deposit & Payment methods
  else if (
    lower.includes('ডিপোজিট') ||
    lower.includes('টাকা') ||
    lower.includes('ব্যালেন্স') ||
    lower.includes('বিকাশ') ||
    lower.includes('নগদ') ||
    lower.includes('রকেট') ||
    lower.includes('deposit') ||
    lower.includes('payment') ||
    lower.includes('bkash') ||
    lower.includes('nagad') ||
    lower.includes('rocket') ||
    lower.includes('টাকা কাটছে') ||
    lower.includes('এড ফান্ড') ||
    lower.includes('add fund')
  ) {
    reply = `💳 **ইনস্ট্যান্ট ডিপোজিট (Add Funds) করার নিয়ম:**
১. নিচের মেনু থেকে **"Deposit / Add Funds"** ট্যাবে যান।
২. আপনার পছন্দের মেথড (**বিকাশ / নগদ / রকেট**) সিলেক্ট করুন।
৩. সেখানে প্রদর্শিত নম্বরে আপনার পার্সোনাল অ্যাপ থেকে **Send Money (সেন্ড মানি)** করুন (মিনিমাম ২০ টাকা)।
৪. টাকা পাঠানোর পর যে নাম্বার থেকে পাঠিয়েছেন সেই **Sender Number** এবং **TrxID (ট্রানজেকশন আইডি)** ফর্মে লিখে **"পেমেন্ট নিশ্চিত করুন"** বাটনে চাপুন।
⚡ সাধারণত **১ থেকে ৩ মিনিটের** মধ্যে আপনার একাউন্টে স্বয়ংক্রিয়ভাবে ব্যালেন্স যোগ হয়ে যাবে!

💡 আপনার বর্তমান ব্যালেন্স: **৳${(userContext?.balance || 0).toFixed(2)}**`;
  }
  // Order status, delivery, speed
  else if (
    lower.includes('অর্ডার') ||
    lower.includes('order') ||
    lower.includes('দেরি') ||
    lower.includes('পেন্ডিং') ||
    lower.includes('pending') ||
    lower.includes('processing') ||
    lower.includes('কখন আসবে') ||
    lower.includes('start') ||
    lower.includes('ডেলিভারি') ||
    lower.includes('delivery') ||
    lower.includes('speed') ||
    lower.includes('কতক্ষণ')
  ) {
    reply = `🚀 **অর্ডার সংক্রান্ত তথ্য ও ট্র্যাকিং গাইড:**
• **অর্ডার কীভাবে দিবেন?** 
  হোমে গিয়ে Category (যেমন: Facebook/YouTube/Instagram) সিলেক্ট করুন ➔ সার্ভিস পছন্দ করুন ➔ পাবলিক প্রোফাইল/ভিডিও লিংক দিন ➔ Quantity বসিয়ে কনফার্ম করুন।
• **অর্ডার শুরু হতে কতক্ষণ লাগে?** 
  আমাদের ৯৫% সার্ভিস **১ থেকে ৫ মিনিটের মধ্যে** ইনস্ট্যান্ট স্টার্ট হয়ে যায়।
• **লাইভ প্রগ্রেস দেখতে:** 
  নিচের **"Orders"** ট্যাবে যান। সেখানে আপনার মোট **${userContext?.totalOrders || 0}টি** অর্ডারের লাইভ স্ট্যাটাস দেখতে পাবেন।
• কোনো অর্ডার আটকে থাকলে সাথে সাথে স্ক্রিনশট পাঠিয়ে এখানে মেসেজ দিন অথবা এডমিনকে জানান।`;
  }
  // Facebook Services
  else if (
    lower.includes('ফেসবুক') ||
    lower.includes('facebook') ||
    lower.includes('fb') ||
    lower.includes('ফলোয়ার') ||
    lower.includes('follower') ||
    lower.includes('লাইক') ||
    lower.includes('like') ||
    lower.includes('ভিউ') ||
    lower.includes('view') ||
    lower.includes('ওয়াচটাইম') ||
    lower.includes('watchtime')
  ) {
    reply = `📱 **ফেসবুক (Facebook) সার্ভিস ও প্যাকেজ:**
• **Facebook Profile/Page Followers:** ৳৮৫ - ৳১৫০ / ১০০০ (নন-ড্রপ ও ফাস্ট ডেলিভারি)
• **Facebook Post Likes & Reactions:** ৳৩৫ - ৳৬০ / ১০০০ (লাভ, ওয়াও, কেয়ার রিঅ্যাকশন)
• **Facebook Video/Reels Views:** ৳১৮ - ৳৩০ / ১০০০ (ইনস্ট্যান্ট ভাইরাল স্পিড)
• **Facebook 60k/600k Watch Time:** সম্পূর্ণ মনিটাইজেশন প্যাকেজ উপলব্ধ।

হোমপেজে গিয়ে **"Facebook Services"** ক্যাটাগরি সিলেক্ট করে এখনই অর্ডার করতে পারেন!`;
  }
  // YouTube Services
  else if (
    lower.includes('ইউটিউব') ||
    lower.includes('youtube') ||
    lower.includes('yt') ||
    lower.includes('সাবস্ক্রাইব') ||
    lower.includes('subscriber') ||
    lower.includes('মনিটাইজ') ||
    lower.includes('monetiz')
  ) {
    reply = `🔴 **ইউটিউব (YouTube) সার্ভিস ও মনিটাইজেশন প্যাকেজ:**
• **YouTube Subscribers:** ৳৫৪০ - ৳৭২০ / ১০০০ (১০০% নন-ড্রপ ও লাইফটাইম গ্যারান্টি)
• **YouTube High Retention Views:** ৳১০৮ / ১০০০ (লাইভ মনিটাইজেশন কাউন্টিং)
• **YouTube Shorts Views:** ৳৬০ / ১০০০ (সুপার ফাস্ট স্পিড)
• **YouTube 4000 Hours Watch Time:** সম্পূর্ণ রিয়েল ওয়াচটাইম প্যাক।

লিংক দেওয়ার সময় অবশ্যই চ্যানেলের পাবলিক লিংক অথবা ভিডিও লিংক প্রদান করুন।`;
  }
  // Instagram / TikTok Services
  else if (
    lower.includes('ইনস্টাগ্রাম') ||
    lower.includes('instagram') ||
    lower.includes('টিকটক') ||
    lower.includes('tiktok') ||
    lower.includes('ig') ||
    lower.includes('রিল') ||
    lower.includes('reels')
  ) {
    reply = `📸 **ইনস্টাগ্রাম ও টিকটক স্পেশাল সার্ভিস:**
• **Instagram Followers:** ৳৮০ - ৳১১০ / ১০০০
• **Instagram Reels Views & Likes:** ৳২৪ / ১০০০
• **TikTok Followers (Real HQ):** ৳২১৬ / ১০০০
• **TikTok Video Views (Viral Booster):** মাত্র ৳১৮ / ১০০০
• **TikTok Likes & Shares:** ৳৩৬ - ৳৪৮ / ১০০০

আপনার অ্যাকাউন্টটি অবশ্যই পাবলিক (Public) মোডে থাকতে হবে।`;
  }
  // Referral & 5% Bonus
  else if (
    lower.includes('রেফার') ||
    lower.includes('refer') ||
    lower.includes('বোনাস') ||
    lower.includes('bonus') ||
    lower.includes('কমিশন') ||
    lower.includes('commission') ||
    lower.includes('ইনভাইট') ||
    lower.includes('invite')
  ) {
    reply = `🎁 **৫% রেফারেল লাইফটাইম ক্যাশ বোনাস:**
• প্রোফাইল থেকে **"রেফারেল ও ৫% বোনাস"** অপশনে যান।
• আপনার পার্সোনাল রেফারেল লিংক কপি করে বন্ধুদের সাথে শেয়ার করুন।
• আপনার রেফারে জয়েন করা বন্ধু যতবার যত টাকাই ডিপোজিট করবে, সাথে সাথে সেই ডিপোজিটের **৫% ইনস্ট্যান্ট ক্যাশ কমিশন** আপনার মূল ব্যালেন্সে যুক্ত হবে!
• এই রেফারেল ব্যালেন্স দিয়ে আপনি যেকোনো অর্ডার দিতে পারবেন।`;
  }
  // Free Daily Tasks
  else if (
    lower.includes('টাস্ক') ||
    lower.includes('task') ||
    lower.includes('ফ্রি') ||
    lower.includes('free') ||
    lower.includes('ইনকাম') ||
    lower.includes('রিওয়ার্ড') ||
    lower.includes('earn')
  ) {
    reply = `🏆 **ডেইলি ফ্রি টাস্ক ও রিওয়ার্ডস:**
• হোমপেজের **"টাস্ক বোনাস"** বাটনে ক্লিক করুন।
• ফেসবুক পেজ লাইক, ইউটিউব সাবস্ক্রাইব বা টেলিগ্রামে জয়েন করার মতো ফ্রি টাস্ক সম্পন্ন করুন।
• কাজের স্ক্রিনশট ও ইউজারনেম জমা দিলেই এডমিন ভেরিফাই করে আপনার ব্যালেন্সে ফ্রি বোনাস টাকা যোগ করে দেবে!`;
  }
  // Media / Photo / Video upload help
  else if (
    lower.includes('ছবি') ||
    lower.includes('ভিডিও') ||
    lower.includes('photo') ||
    lower.includes('image') ||
    lower.includes('video') ||
    lower.includes('screenshot') ||
    lower.includes('প্রুফ')
  ) {
    reply = `📷 **ছবি ও ভিডিও পাঠানোর নিয়ম:**
• চ্যাট বক্সের নিচে **ক্যামেরা (ছবি)** বা **ভিডিও** আইকনে ক্লিক করে আপনার গ্যালারি/ফাইল থেকে সরাসরি স্ক্রিনশট বা ভিডিও যুক্ত করতে পারেন।
• আপনার কোনো পেমেন্ট সমস্যা বা অর্ডার প্রুফ থাকলে তা ছবি/ভিডিও আকারে পাঠালে আমাদের এডমিন টিম দ্রুত সমাধান দিতে পারবে।`;
  }
  // Direct Human / Admin contact
  else if (
    lower.includes('এডমিন') ||
    lower.includes('admin') ||
    lower.includes('মানুষ') ||
    lower.includes('human') ||
    lower.includes('মালিক') ||
    lower.includes('help') ||
    lower.includes('যোগাযোগ') ||
    lower.includes('whatsapp') ||
    lower.includes('telegram') ||
    lower.includes('নম্বর') ||
    lower.includes('call')
  ) {
    reply = `👨‍💼 **অফিসিয়াল এডমিন ও সাপোর্ট টিম:**
• 📱 **WhatsApp Support:** +8801342163841 (সরাসরি চ্যাট করুন)
• ✈️ **Telegram Support:** @RF2_SMM (https://t.me/RF2_SMM)
• এছাড়াও আপনি এই চ্যাটে আপনার সমস্যা বা ছবি/ভিডিও পাঠিয়ে রাখতে পারেন, এডমিন প্যানেল থেকে আপনার মেসেজের সরাসরি উত্তর দেওয়া হবে!`;
  }
  // Password & Profile
  else if (
    lower.includes('পাসওয়ার্ড') ||
    lower.includes('password') ||
    lower.includes('নাম') ||
    lower.includes('username') ||
    lower.includes('লগইন') ||
    lower.includes('login')
  ) {
    reply = `🔑 **অ্যাকাউন্ট ও পাসওয়ার্ড সেটিংস:**
• প্রোফাইল ট্যাবে গিয়ে **"পাসওয়ার্ড পরিবর্তন"** বাটনে ক্লিক করে যেকোনো সময় আপনার সিকিউরিটি পাসওয়ার্ড আপডেট করে নিতে পারেন।
• ইউজারনেম পরিবর্তন করতে চাইলে প্রোফাইলের ইউজারনেম অপশন ব্যবহার করুন।`;
  }
  // General Fallback
  else {
    reply = `✨ **RF SMM AI লাইভ সাপোর্ট:**
আপনার প্রশ্নের প্রেক্ষিতে আমি সার্বক্ষণিক সাহায্য করতে প্রস্তুত। আপনি নিচের যেকোনো একটি অপশন টাইপ করতে পারেন:

১. 💳 **ডিপোজিট নিয়ম** (বিকাশ, নগদ, রকেটে কিভাবে টাকা জমা করবেন)
২. 🚀 **অর্ডার ট্র্যাকিং ও স্পিড** (সার্ভিস ডেলিভারি সময় ও প্রগ্রেস)
৩. 🎁 **৫% রেফারেল কমিশন** (ফ্রেন্ড ইনভাইট করে লাইফটাইম ইনকাম)
৪. 🏆 **ফ্রি টাস্ক বোনাস** (ফ্রিতে সোশ্যাল টাস্ক করে ব্যালেন্স ইনকাম)
৫. 📷 **ছবি/ভিডিও সংযুক্তি** (পেমেন্ট বা অর্ডারের স্ক্রিনশট পাঠান)
৬. 👨‍💼 **সরাসরি এডমিন সাপোর্ট** (WhatsApp: +8801342163841 | Telegram: @RF2_SMM)`;
  }

  return {
    reply,
    source: 'smart_engine'
  };
}
