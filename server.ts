import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // AI Support API endpoint
  app.post("/api/ai-support", async (req, res) => {
    try {
      const { message, image, videoUrl, history, userContext } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey.trim().length > 10) {
        // List of candidate models for automatic failover / high-demand recovery
        const candidateModels = ['gemini-3.7-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
        
        const ai = new GoogleGenAI({
          apiKey: apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });

        const systemInstruction = `You are "RF SMM AI Live Support Assistant" (আরএফ এসএমএম লাইভ এআই সাপোর্ট অ্যাসিস্ট্যান্ট) for "RF SMM PANEL BD", Bangladesh's #1 Social Media Marketing (SMM) service platform.
Always reply helpfully, courteously, and clearly in fluent Bengali (বাংলা) or English (if the user asks in English).

Platform Knowledge & Details:
1. Platform Name: RF SMM PANEL BD (বাংলাদেশের বিশ্বস্ত ও ১ নম্বর সোশ্যাল মিডিয়া মার্কেটিং প্যানেল)।
2. Deposit / Add Funds:
   - Payment Methods: bKash (বিকাশ), Nagad (নগদ), Rocket (রকেট)।
   - Minimum Deposit: ৳20 (বা এডমিন নির্ধারিত পরিমাণ)।
   - Process: Go to "Add Funds" (ডিপোজিট), choose payment method, copy the given number, Send Money (সেন্ড মানি) from personal bKash/Nagad/Rocket, then submit sender number and Transaction ID (TrxID).
   - Approval: 1-5 minutes automatic / verified instantly.
3. Orders & Services:
   - Categories: Facebook (Followers, Likes, Views, Watchtime), Instagram (Followers, Likes, Views), YouTube (Subscribers, Views, Watchtime), TikTok, Telegram, Twitter/X, Spotify, Discord, Website Traffic.
   - Process: Go to "New Order", select Category & Service, paste valid public link, enter quantity, click Confirm.
   - Speed: Super fast, automated 24/7.
4. Referral Program (৫% লাইফটাইম ক্যাশ বোনাস):
   - Every user gets a unique Referral Link / Code.
   - When a referred friend deposits money, the referrer instantly receives 5% cash commission deposited directly to their main balance.
5. Daily Tasks & Screenshot Rewards:
   - Users can complete free social tasks and submit screenshot proof to earn free balance.
6. Multimodal Inspection (Screenshots & Videos):
   - If the user provides a screenshot (bKash/Nagad receipt, order error, transaction slip), inspect the transaction ID, amount, and number carefully, explain what is seen, and guide them clearly.
   - If user shares a video link or attachment, acknowledge and provide helpful advice.
7. Human / Direct Admin Contact:
   - Telegram Support: https://t.me/RF2_SMM
   - WhatsApp Support: https://wa.me/8801342163841

User Context:
${userContext ? JSON.stringify(userContext) : 'Standard SMM User'}

Guidelines:
- Give well-formatted, friendly, accurate responses with emojis, bullet points, and actionable steps.
- Always provide immediate clarity. If checking personal payment records or manual adjustments is required, advise them kindly and offer the WhatsApp / Telegram admin links.`;

        // Build contents
        const contents: any[] = [];
        if (Array.isArray(history)) {
          for (const item of history.slice(-6)) {
            contents.push({
              role: item.role === 'user' ? 'user' : 'model',
              parts: [{ text: item.text }]
            });
          }
        }

        const userParts: any[] = [];
        if (message && message.trim()) {
          userParts.push({ text: message });
        } else if (image) {
          userParts.push({ text: 'অনুগ্রহ করে এই স্ক্রিনশট / ছবিটি দেখে আমাকে সাহায্য করুন।' });
        }

        if (videoUrl) {
          userParts.push({ text: `[User attached video link: ${videoUrl}]` });
        }

        // Multimodal image processing
        if (image) {
          try {
            if (typeof image === 'string' && image.startsWith('data:')) {
              const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
              if (matches && matches.length === 3) {
                userParts.push({
                  inlineData: {
                    mimeType: matches[1],
                    data: matches[2]
                  }
                });
              }
            } else if (image.mimeType && image.data) {
              userParts.push({
                inlineData: {
                  mimeType: image.mimeType,
                  data: image.data
                }
              });
            }
          } catch (imgErr) {
            console.warn('Image parse warning:', imgErr);
          }
        }

        if (userParts.length === 0) {
          userParts.push({ text: 'Hello, need help' });
        }

        contents.push({
          role: 'user',
          parts: userParts
        });

        // Try candidate models with automatic failover
        for (const modelName of candidateModels) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: contents,
              config: {
                systemInstruction: systemInstruction,
                temperature: 0.7,
              }
            });

            if (response && response.text && response.text.trim()) {
              return res.json({
                reply: response.text,
                source: 'gemini',
                model: modelName
              });
            }
          } catch (modelErr: any) {
            console.warn(`Model ${modelName} attempt notice:`, modelErr.message || modelErr);
            // Continue to next model
          }
        }
      }

      // Smart Bengali NLP Support Engine Fallback
      const lower = (message || '').toLowerCase();
      let reply = '';

      if (
        lower.includes('ডিপোজিট') ||
        lower.includes('টাকা') ||
        lower.includes('ব্যালেন্স') ||
        lower.includes('বিকাশ') ||
        lower.includes('নগদ') ||
        lower.includes('রকেট') ||
        lower.includes('deposit') ||
        lower.includes('payment') ||
        lower.includes('bkash') ||
        lower.includes('nagad')
      ) {
        reply = `💳 **ডিপোজিট করার সহজ নিয়ম:**
১. নিচের মেনু থেকে **"Add Funds" (ডিপোজিট)** অপশনে যান।
২. আপনার পছন্দের মেথড (**বিকাশ / নগদ / রকেট**) সিলেক্ট করুন।
৩. স্ক্রিনে দেওয়া পার্সোনাল নাম্বারে **Send Money (সেন্ড মানি)** করুন (মিনিমাম ২০ টাকা)।
৪. যে নাম্বার থেকে টাকা পাঠিয়েছেন সেই নাম্বার এবং **TrxID (ট্রানজেকশন আইডি)** লিখে **"পেমেন্ট নিশ্চিত করুন"** বাটনে চাপুন।
⚡ ১-৩ মিনিটের মধ্যে আপনার একাউন্টে ব্যালেন্স স্বয়ংক্রিয়ভাবে যোগ হয়ে যাবে!`;
      } else if (
        lower.includes('অর্ডার') ||
        lower.includes('order') ||
        lower.includes('দেরি') ||
        lower.includes('পেন্ডিং') ||
        lower.includes('pending') ||
        lower.includes('status') ||
        lower.includes('সার্ভিস') ||
        lower.includes('service')
      ) {
        reply = `🚀 **অর্ডার সংক্রান্ত তথ্য ও গাইড:**
• **নতুন অর্ডার দিতে:** হোমপেজে গিয়ে Category ও Service সিলেক্ট করুন, লিংক দিন এবং Quantity বসিয়ে অর্ডার কনফার্ম করুন।
• **অর্ডার স্ট্যাটাস দেখতে:** নিচের **"Orders"** ট্যাবে যান। সেখানে আপনার সমস্ত অর্ডারের লাইভ প্রগ্রেস দেখতে পাবেন।
• **অর্ডার শুরু হতে কতক্ষণ লাগে?** ৯৫% সার্ভিস ১-৫ মিনিটের মধ্যে ইনস্ট্যান্ট স্টার্ট হয়ে যায়।
• কোনো অর্ডার আটকে থাকলে সরাসরি আমাদের এডমিন টেলিগ্রাম (@RF2_SMM) বা হোয়াটসঅ্যাপে যোগাযোগ করুন।`;
      } else if (
        lower.includes('রেফার') ||
        lower.includes('refer') ||
        lower.includes('বোনাস') ||
        lower.includes('bonus') ||
        lower.includes('ইনভাইট') ||
        lower.includes('কমিশন')
      ) {
        reply = `🎁 **৫% রেফারেল লাইফটাইম বোনাস:**
• প্রোফাইল থেকে **"রেফারেল ও ৫% বোনাস"** অপশনে যান।
• আপনার পার্সোনাল রেফারেল লিংক কপি করে বন্ধুদের সাথে শেয়ার করুন।
• আপনার রেফারে জয়েন করা বন্ধু যতবার ডিপোজিট করবে, সাথে সাথে ডিপোজিটের **৫% ইনস্ট্যান্ট ক্যাশ কমিশন** আপনার মূল ব্যালেন্সে যোগ হবে!`;
      } else if (
        lower.includes('টাস্ক') ||
        lower.includes('task') ||
        lower.includes('ফ্রি') ||
        lower.includes('free') ||
        lower.includes('ইনকাম') ||
        lower.includes('রিওয়ার্ড')
      ) {
        reply = `🏆 **ডেইলি টাস্ক ও ফ্রি রিওয়ার্ডস:**
• আমাদের প্ল্যাটফর্মে সোশ্যাল টাস্ক কমপ্লিট করে ফ্রিতে টাকা ইনকাম করতে পারবেন।
• টাস্ক অপশনে গিয়ে টাস্ক নির্দেশনা অনুযায়ী কাজ করে স্ক্রিনশট ও ইউজারনেম জমা দিন। এডমিন ভেরিফাই করলেই আপনার ব্যালেন্সে টাকা যোগ হবে!`;
      } else if (
        lower.includes('পাসওয়ার্ড') ||
        lower.includes('password') ||
        lower.includes('লগইন') ||
        lower.includes('login') ||
        lower.includes('ইউজারনেম') ||
        lower.includes('username')
      ) {
        reply = `🔑 **পাসওয়ার্ড ও অ্যাকাউন্ট নিরাপত্তা:**
• প্রোফাইল ট্যাবে গিয়ে **"পাসওয়ার্ড পরিবর্তন"** বা **"ইউজার নাম পরিবর্তন"** বাটনে ক্লিক করে একাউন্ট আপডেট করতে পারেন।
• একাউন্টে কোনো সমস্যা হলে সরাসরি এডমিন সাপোর্টে যোগাযোগ করুন।`;
      } else if (
        lower.includes('এডমিন') ||
        lower.includes('admin') ||
        lower.includes('যোগাযোগ') ||
        lower.includes('human') ||
        lower.includes('whatsapp') ||
        lower.includes('telegram') ||
        lower.includes('কল') ||
        lower.includes('help')
      ) {
        reply = `👨‍💼 **এডমিন ও হিউম্যান লাইভ সাপোর্ট:**
• 📱 **WhatsApp Support:** +8801342163841
• ✈️ **Telegram Admin:** @RF2_SMM
২৪/৭ আমাদের টিম আপনার সহায়তায় নিয়োজিত!`;
      } else {
        reply = `👋 স্বাগতম! আমি **RF SMM লাইভ AI সাপোর্ট সহকারী**। 
আমি আপনাকে ডিপোজিট, অর্ডার ট্র্যাকিং, সোশ্যাল সার্ভিস প্যাকেজ, ৫% রেফারেল বোনাস এবং অ্যাকাউন্ট সংক্রান্ত যেকোনো বিষয়ে সার্বক্ষণিক সাহায্য করতে পারি। 

💡 **আপনি নিচের যেকোনো বিষয়ে প্রশ্ন করতে পারেন:**
১. 💳 বিকাশ/নগদ/রকেটে কীভাবে ডিপোজিট করব?
২. 🚀 অর্ডার দিতে কী কী লাগবে ও কতক্ষণ সময় লাগে?
৩. 🎁 ৫% রেফারেল বোনাস কীভাবে ব্যালেন্সে যোগ হয়?
৪. 👨‍💼 সরাসরি এডমিনের সাথে কীভাবে কথা বলব?`;
      }

      return res.json({
        reply: reply,
        source: 'smart_engine'
      });
    } catch (err: any) {
      console.error('AI Support Handler Error:', err);
      return res.status(500).json({
        error: 'Failed to process AI response',
        details: err.message
      });
    }
  });

  // Telegram Order Live Notification Endpoint (Supports customizable Bot Token, Channels, & Toggle)
  app.post("/api/telegram/order-notify", async (req, res) => {
    try {
      const {
        orderId,
        apiOrderId,
        serviceName,
        category,
        quantity,
        cost,
        link,
        userName,
        userEmail,
        status,
        createdAt,
        siteLogo,
        botToken: customBotToken,
        channels: customChannels,
        enabled,
        miniAppUrl: customMiniAppUrl,
      } = req.body;

      // Check if notification is explicitly disabled
      if (enabled === false) {
        return res.json({
          success: true,
          skipped: true,
          message: "Telegram order notifications are currently disabled.",
          results: [],
        });
      }

      const botToken =
        (customBotToken && typeof customBotToken === "string" && customBotToken.trim()) ||
        process.env.TELEGRAM_BOT_TOKEN ||
        "8417495766:AAEupqJEr6_IyvOcGXhhdWStj95khUdr8MU";

      // Parse target channels from array or comma/newline delimited string
      let targetChannels: string[] = [];
      if (Array.isArray(customChannels) && customChannels.length > 0) {
        targetChannels = customChannels
          .map((c) => String(c).trim())
          .filter((c) => c.length > 0);
      } else if (typeof customChannels === "string" && customChannels.trim()) {
        targetChannels = customChannels
          .split(/[\n,;]+/)
          .map((c) => c.trim())
          .filter((c) => c.length > 0);
      }

      if (targetChannels.length === 0) {
        targetChannels = ["@RF2_SMM", "@FARJU_SMM_PANAL"];
      }

      // Format target channels (ensure @ or ID prefix)
      targetChannels = targetChannels.map((c) => {
        if (!c.startsWith("@") && !c.startsWith("-") && !c.startsWith("https://t.me/")) {
          // If pure alphanumeric username without @
          if (/^[a-zA-Z0-9_]+$/.test(c)) {
            return "@" + c;
          }
        }
        if (c.startsWith("https://t.me/")) {
          return "@" + c.replace("https://t.me/", "").replace("/", "");
        }
        return c;
      });

      // Format date/time
      const dateStr = createdAt
        ? new Date(createdAt).toLocaleString("en-US", {
            timeZone: "Asia/Dhaka",
            dateStyle: "medium",
            timeStyle: "short",
          })
        : new Date().toLocaleString("en-US", {
            timeZone: "Asia/Dhaka",
            dateStyle: "medium",
            timeStyle: "short",
          });

      // Escape HTML helper
      const escapeHtml = (str: any) =>
        String(str || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

      const safeOrderId = escapeHtml(orderId || "ORD-" + Math.floor(100000 + Math.random() * 900000));
      const safeApiId = apiOrderId ? ` (SMM ID: <code>#${escapeHtml(apiOrderId)}</code>)` : "";
      const safeService = escapeHtml(serviceName || "Social Media Service");
      const safeCat = escapeHtml(category || "SMM Package");
      const safeLink = escapeHtml(link || "https://t.me/RF2_SMM");
      const safeQty = Number(quantity || 0).toLocaleString();
      const safeCost = Number(cost || 0).toFixed(2);
      const safeUser = escapeHtml(userName || (userEmail ? userEmail.split("@")[0] : "Verified Client"));
      const safeStatus = escapeHtml(status || "Processing ⚡");

      const captionStyle = req.body.captionStyle || "vip";
      const customHeader = req.body.customHeader ? escapeHtml(req.body.customHeader) : "";
      const customFooter = req.body.customFooter ? escapeHtml(req.body.customFooter) : "";

      let stylishCaption = "";

      if (captionStyle === "minimal") {
        stylishCaption = `📦 <b>Order #${safeOrderId}</b> • <code>SUCCESS</code>
━━━━━━━━━━━━━━━━━━━━━━
• <b>Service:</b> <b>${safeService}</b>
• <b>Target:</b> <code>${safeLink}</code>
• <b>Quantity:</b> <b>${safeQty}</b> | <b>৳${safeCost}</b>
• <b>Client:</b> <code>${safeUser}</code>
• <b>Status:</b> <b>${safeStatus}</b>
• <b>Time:</b> <code>${dateStr}</code>
━━━━━━━━━━━━━━━━━━━━━━
⚡ <i>${customFooter || "RF SMM Automated System"}</i>`;
      } else if (captionStyle === "cyber") {
        stylishCaption = `⚡ <b>DISPATCH: ORDER #${safeOrderId}</b>
━━━━━━━━━━━━━━━━━━━━━━
[SERVICE] <b>${safeService}</b>
[TARGET]  <code>${safeLink}</code>
[AMOUNT]  <b>${safeQty} Units</b> (৳${safeCost})
[CLIENT]  <code>${safeUser}</code>
[STATUS]  ⚡ <b>${safeStatus}</b>
[TIME]    <code>${dateStr}</code>
━━━━━━━━━━━━━━━━━━━━━━
⚡ <i>${customFooter || "RF SMM PANEL • Instant Fast Delivery"}</i>`;
      } else {
        // Default: VIP Executive Sleek Style (Clean, high-end, no awkward slogans)
        const headerTitle = customHeader || "⚡ <b>NEW ORDER PROCESSED</b> ⚡";
        stylishCaption = `${headerTitle}
━━━━━━━━━━━━━━━━━━━━━━
🆔 <b>Order ID  :</b> <code>#${safeOrderId}</code>${safeApiId}
📦 <b>Service   :</b> <b>${safeService}</b>
🏷️ <b>Category  :</b> <code>${safeCat}</code>
🎯 <b>Target    :</b> <code>${safeLink}</code>
🔢 <b>Quantity  :</b> <b>${safeQty}</b>
💰 <b>Price     :</b> <b>৳${safeCost}</b>
👤 <b>Client    :</b> <code>${safeUser}</code>
⚡ <b>Status    :</b> <b>${safeStatus}</b>
📅 <b>Time (BD) :</b> <code>${dateStr}</code>
━━━━━━━━━━━━━━━━━━━━━━
👑 <i>${customFooter || "RF SMM PANEL • Instant Fast Delivery"}</i>`;
      }
      const primaryChannelUrl = targetChannels[0]?.startsWith("@")
        ? `https://t.me/${targetChannels[0].replace("@", "")}`
        : "https://t.me/RF2_SMM";

      const miniAppUrl =
        (customMiniAppUrl && typeof customMiniAppUrl === "string" && customMiniAppUrl.trim()) ||
        process.env.TELEGRAM_MINI_APP_URL ||
        "https://t.me/RF_SMM_PRO_BOT?startapp=8479465879";

      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: "🚀 ওপেন Mini App (অর্ডার করুন)", url: miniAppUrl }
          ],
          [
            { text: "💬 WhatsApp সাপোর্ট", url: "https://wa.me/8801342163841" },
            { text: "📢 অফিসিয়াল চ্যানেল", url: primaryChannelUrl }
          ]
        ]
      };

      // Candidate photo URL or Base64 Buffer
      let isBase64 = false;
      let base64Buffer: Buffer | null = null;
      let mimeType = "image/png";
      let photoUrl = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80";

      if (siteLogo && typeof siteLogo === "string") {
        if (siteLogo.startsWith("http://") || siteLogo.startsWith("https://")) {
          photoUrl = siteLogo;
        } else if (siteLogo.startsWith("data:image/")) {
          try {
            const match = siteLogo.match(/^data:(image\/[a-zA-Z0-9\+\-]+);base64,(.+)$/);
            if (match) {
              mimeType = match[1];
              base64Buffer = Buffer.from(match[2], "base64");
              isBase64 = true;
            }
          } catch (b64Err) {
            console.error("Base64 parsing error:", b64Err);
          }
        }
      }

      const results = [];

      for (const channel of targetChannels) {
        try {
          let photoJson: any = null;

          if (isBase64 && base64Buffer) {
            // Send binary photo via FormData
            try {
              const formData = new FormData();
              formData.append("chat_id", channel);
              formData.append("caption", stylishCaption);
              formData.append("parse_mode", "HTML");
              formData.append("reply_markup", JSON.stringify(inlineKeyboard));
              
              const blob = new Blob([base64Buffer], { type: mimeType });
              formData.append("photo", blob, `logo.${mimeType.split("/")[1] || "png"}`);

              const tgPhotoRes = await fetch(
                `https://api.telegram.org/bot${botToken}/sendPhoto`,
                {
                  method: "POST",
                  body: formData,
                }
              );
              photoJson = await tgPhotoRes.json();
            } catch (formErr) {
              console.warn("FormData send error, trying URL fallback:", formErr);
            }
          }

          if (!photoJson || !photoJson.ok) {
            // Attempt sending with photoUrl via JSON
            const photoPayload = {
              chat_id: channel,
              photo: photoUrl,
              caption: stylishCaption,
              parse_mode: "HTML",
              reply_markup: inlineKeyboard,
            };

            const tgPhotoRes = await fetch(
              `https://api.telegram.org/bot${botToken}/sendPhoto`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(photoPayload),
              }
            );
            photoJson = await tgPhotoRes.json();
          }

          if (photoJson.ok) {
            results.push({ channel, success: true, mode: "photo" });
          } else {
            // Fallback to sendMessage if photo fails
            const msgPayload = {
              chat_id: channel,
              text: stylishCaption,
              parse_mode: "HTML",
              reply_markup: inlineKeyboard,
              disable_web_page_preview: false,
            };

            const tgMsgRes = await fetch(
              `https://api.telegram.org/bot${botToken}/sendMessage`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(msgPayload),
              }
            );

            const msgJson: any = await tgMsgRes.json();
            results.push({ channel, success: !!msgJson.ok, mode: "message", error: msgJson.description });
          }
        } catch (chanErr: any) {
          console.error(`Error sending telegram notify to ${channel}:`, chanErr);
          results.push({ channel, success: false, error: chanErr.message });
        }
      }

      const hasSuccess = results.some((r) => r.success);
      return res.json({ success: hasSuccess, results, totalChannels: targetChannels.length });
    } catch (err: any) {
      console.error("Telegram Order Notify API Error:", err);
      // Return 200 with error details so it never breaks frontend
      return res.json({ success: false, error: err.message, results: [] });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
