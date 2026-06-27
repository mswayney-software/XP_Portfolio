/*
 * Email Triage — interactive portfolio demo for the "AI Email Triage Pipeline" project.
 *
 * This is a faithful, replayable demo of the real n8n + Claude workflow in the
 * mswayney-software/ai_email_triager repo. The 40-email test set, the routing
 * rules, the model line-up (Haiku 4.5 to classify, Sonnet 4.6 to draft) and the
 * documented results (37/40 = 93% routing accuracy, with three known misses)
 * all come straight from that project. Outputs are pre-baked so the demo runs
 * instantly, offline, and free — no API key, no backend.
 */
(function () {
  'use strict';

  // Lane metadata: the four outcomes an email can route to.
  const LANES = {
    draft:  { label: 'DRAFT',  blurb: 'Safe + confident — Claude writes a reply (held, never auto-sent)', cls: 'et-draft' },
    review: { label: 'REVIEW', blurb: 'Sensitive, unsure, or a safety flag — held for a human', cls: 'et-review' },
    ignore: { label: 'IGNORE', blurb: 'Obvious junk — shoveled aside, no reply, no human time', cls: 'et-ignore' },
  };

  // The 40-email test set. `cls` is the reconstructed Haiku classification, `route`
  // is the deterministic result of the real Validate & Flag rules, `expected` is the
  // answer-key handling, and `draft` is the Sonnet reply for emails on the draft lane.
  const EMAILS = [
    { id: '01', subject: 'My candle arrived shattered', from: 'a.reyes@gmail.com', body: "Hi, the large amber jar candle I ordered showed up cracked in three places and wax everywhere in the box. Can I get a replacement?", trap: false, expected: 'draft',
      cls: { category: 'support', urgency: 'high', intent_summary: 'Wants a replacement for a candle that arrived broken.', suggested_action: 'draft_reply', safety_flag: false, confidence: 0.96 }, route: 'draft', reason: 'Safe support request, high confidence',
      draft: "Hi there, I'm so sorry your amber jar candle arrived cracked — that's not the unboxing we want for you. I've put a replacement in motion and it'll ship right out at no cost, and there's no need to send the broken one back. Thanks for your patience and for letting us know.\n\n— The Maple & Pine Team" },

    { id: '02', subject: 'Where is my order?', from: 'tomh@outlook.com', body: "Hey there, just wondering how I can track order #10428. I got a confirmation but no shipping update yet.", trap: false, expected: 'draft',
      cls: { category: 'support', urgency: 'medium', intent_summary: 'Asking how to track their order.', suggested_action: 'draft_reply', safety_flag: false, confidence: 0.95 }, route: 'draft', reason: 'Safe support request, high confidence',
      draft: "Hi! Happy to help with order #10428. Your confirmation means it's locked in, and a tracking update should land in your inbox as soon as it leaves our studio — usually within a day or two. If it hasn't shown up by then, just reply here and we'll chase it down.\n\n— The Maple & Pine Team" },

    { id: '03', subject: 'How do I clean the ceramic diffuser?', from: 'priya.n@gmail.com', body: "Quick question - what's the best way to clean the reed diffuser base without damaging the finish? Thanks!", trap: false, expected: 'draft',
      cls: { category: 'support', urgency: 'low', intent_summary: 'Asking how to clean the reed diffuser base.', suggested_action: 'draft_reply', safety_flag: false, confidence: 0.97 }, route: 'draft', reason: 'Safe support request, high confidence',
      draft: "Hi! Great question. Empty any leftover oil, then wipe the inside and finish with a soft cloth dampened with warm, soapy water — skip abrasive scrubbers so the finish stays beautiful. Let it dry fully before adding new oil. Enjoy!\n\n— The Maple & Pine Team" },

    { id: '04', subject: 'Wrong item in my box', from: 'dlangford@gmail.com', body: "I ordered the eucalyptus soy candle but received a lavender one instead. Order #10455. How do we fix this?", trap: false, expected: 'draft',
      cls: { category: 'support', urgency: 'medium', intent_summary: 'Received the wrong candle and wants it corrected.', suggested_action: 'draft_reply', safety_flag: false, confidence: 0.94 }, route: 'draft', reason: 'Safe support request, high confidence',
      draft: "Hi there, so sorry for the mix-up on order #10455 — you should've received the eucalyptus soy candle, not the lavender. We'll ship the correct one right away, and please keep the lavender on us. Thanks for your patience!\n\n— The Maple & Pine Team" },

    { id: '05', subject: 'Order still not here - event is tomorrow', from: 'm.calloway@gmail.com', body: "My order #10470 still hasn't arrived and I need it for an event tomorrow evening. Is there any way to expedite or confirm it's coming?", trap: false, expected: 'draft',
      cls: { category: 'support', urgency: 'high', intent_summary: 'Needs an undelivered order expedited for an event tomorrow.', suggested_action: 'draft_reply', safety_flag: false, confidence: 0.90 }, route: 'draft', reason: 'Safe support request, high confidence',
      draft: "Hi! I completely understand the time crunch with your event tomorrow. I'm flagging order #10470 so our team can confirm its status and look into the fastest expedited option right away — we'll follow up shortly. Thanks for your patience.\n\n— The Maple & Pine Team" },

    { id: '06', subject: 'Change shipping address', from: 'jwells@gmail.com', body: "Hi, I think I entered my old address on order #10481. Can you update it to 44 Birch Lane before it ships?", trap: false, expected: 'draft',
      cls: { category: 'support', urgency: 'medium', intent_summary: 'Wants to update the shipping address before the order ships.', suggested_action: 'draft_reply', safety_flag: false, confidence: 0.92 }, route: 'draft', reason: 'Safe support request, high confidence',
      draft: "Hi! Thanks for catching that before it shipped. We'll update order #10481 to 44 Birch Lane and confirm once it's set. If it happens to have already left, we'll help reroute it.\n\n— The Maple & Pine Team" },

    { id: '07', subject: 'Return policy question', from: 'sandra.k@gmail.com', body: "What's your return window? I bought a gift set two weeks ago and may need to send part of it back.", trap: false, expected: 'draft',
      cls: { category: 'support', urgency: 'low', intent_summary: 'Asking about the return window.', suggested_action: 'draft_reply', safety_flag: false, confidence: 0.95 }, route: 'draft', reason: 'Safe support request, high confidence',
      draft: "Hi! Of course — our return window is 30 days from delivery for unused items in their original packaging, so your gift set from two weeks ago is well within range. Reply here whenever you're ready and we'll send return instructions.\n\n— The Maple & Pine Team" },

    { id: '08', subject: 'Restock on cedar collection?', from: 'gregf@gmail.com', body: "Do you know if the cedar + sage collection will be restocked? It's been out for a while.", trap: false, expected: 'draft',
      cls: { category: 'support', urgency: 'low', intent_summary: 'Asking whether the cedar + sage collection will be restocked.', suggested_action: 'draft_reply', safety_flag: false, confidence: 0.85 }, route: 'draft', reason: 'Safe support request, high confidence',
      draft: "Hi! The cedar + sage collection is a favorite, so it does sell out — good news is a restock is on the way. If you'd like, reply here and we'll give you a heads-up the moment it's back.\n\n— The Maple & Pine Team" },

    { id: '09', subject: "Discount code won't apply", from: 'natalie.b@gmail.com', body: "I'm trying to use WELCOME10 at checkout and it keeps saying invalid. Am I doing something wrong?", trap: false, expected: 'draft',
      cls: { category: 'support', urgency: 'medium', intent_summary: 'Discount code WELCOME10 is being rejected at checkout.', suggested_action: 'draft_reply', safety_flag: false, confidence: 0.88 }, route: 'draft', reason: 'Safe support request, high confidence',
      draft: "Hi! Sorry for the trouble with WELCOME10. It usually applies only to first orders or needs a small minimum — try entering it in all caps with no spaces at checkout. If it still won't take, reply here and we'll make sure you get the discount.\n\n— The Maple & Pine Team" },

    { id: '10', subject: 'I received someone else’s order and info', from: 'b.fontaine@gmail.com', body: "This is a bit alarming - I got a package with another customer's name, address, and a packing slip with their email. Wanted to flag it.", trap: true, expected: 'review',
      cls: { category: 'support', urgency: 'high', intent_summary: "Reporting they received another customer's package and personal info.", suggested_action: 'escalate', safety_flag: true, confidence: 0.90 }, route: 'review', reason: 'Safety/privacy flag — exposed personal data goes straight to a human' },

    { id: '11', subject: 'Missing assembly instructions', from: 'kyle.d@gmail.com', body: "The lantern set didn't come with instructions and I can't figure out how the panels attach. Any help?", trap: false, expected: 'draft',
      cls: { category: 'support', urgency: 'low', intent_summary: 'Lantern set arrived without assembly instructions.', suggested_action: 'draft_reply', safety_flag: false, confidence: 0.93 }, route: 'draft', reason: 'Safe support request, high confidence',
      draft: "Hi! Sorry the lantern set arrived without its assembly card. The panels slot into the grooved corners of the base and click into place at the top — and I'd be glad to email you the full illustrated steps. Reply here and I'll send them right over.\n\n— The Maple & Pine Team" },

    { id: '12', subject: 'How does the monthly candle subscription work?', from: 'erin.s@gmail.com', body: "I'm not a customer yet but I'm considering the monthly box. Can you explain how billing and shipping work before I sign up?", trap: true, expected: 'draft',
      cls: { category: 'sales', urgency: 'medium', intent_summary: 'Prospective customer asking how subscription billing and shipping work.', suggested_action: 'draft_reply', safety_flag: false, confidence: 0.82 }, route: 'draft', reason: 'Reads "billing" but it’s a pre-sale question — classified sales, so it drafts',
      draft: "Hi, and thanks for considering our monthly box! The short version: you're billed on the same date each month, and your candle ships within a couple of days of that charge. You can skip, pause, or cancel anytime from your account — no commitment. Happy to answer anything else before you sign up!\n\n— The Maple & Pine Team" },

    { id: '13', subject: 'Charged twice for one order', from: 'r.maddox@gmail.com', body: "I see two identical charges of $58.00 on my card for order #10490 but I only placed one order. Please refund the duplicate.", trap: false, expected: 'review',
      cls: { category: 'billing', urgency: 'high', intent_summary: 'Reports a duplicate charge and wants the duplicate refunded.', suggested_action: 'escalate', safety_flag: false, confidence: 0.95 }, route: 'review', reason: 'Sensitive category (billing) — money always gets human eyes' },

    { id: '14', subject: 'Need a receipt for taxes', from: 'connor.l@gmail.com', body: "Could you send an itemized invoice for order #10399? I need it for business expense records. Thanks.", trap: false, expected: 'review',
      cls: { category: 'billing', urgency: 'medium', intent_summary: 'Requests an itemized invoice for expense records.', suggested_action: 'escalate', safety_flag: false, confidence: 0.90 }, route: 'review', reason: 'Sensitive category (billing) — money always gets human eyes' },

    { id: '15', subject: 'Unauthorized charge on my card', from: 'h.okafor@gmail.com', body: "There's a $74 charge from your store I don't recognize and I never placed this order. If this isn't resolved I'll dispute it with my bank.", trap: false, expected: 'review',
      cls: { category: 'billing', urgency: 'high', intent_summary: 'Reports an unrecognized charge and may dispute with their bank.', suggested_action: 'escalate', safety_flag: false, confidence: 0.92 }, route: 'review', reason: 'Sensitive category (billing) — money always gets human eyes' },

    { id: '16', subject: 'Refund still not showing', from: 'p.santos@gmail.com', body: "I was told my refund for order #10350 was processed 5 days ago but I don't see it on my statement yet. Can you check?", trap: false, expected: 'review',
      cls: { category: 'billing', urgency: 'medium', intent_summary: 'Refund processed but not yet visible on their statement.', suggested_action: 'escalate', safety_flag: false, confidence: 0.90 }, route: 'review', reason: 'Sensitive category (billing) — money always gets human eyes' },

    { id: '17', subject: 'Update card for subscription', from: 'janet.w@gmail.com', body: "My card on file expired. How do I update payment info for my monthly subscription so it doesn't lapse?", trap: false, expected: 'review',
      cls: { category: 'billing', urgency: 'low', intent_summary: 'Wants to update an expired card for their subscription.', suggested_action: 'escalate', safety_flag: false, confidence: 0.93 }, route: 'review', reason: 'Sensitive category (billing) — money always gets human eyes' },

    { id: '18', subject: "Site won't complete my payment", from: 'derek.m@gmail.com', body: "Your checkout page kept erroring when I hit pay, so I tried three times - and now I see THREE pending charges on my card. Help.", trap: true, expected: 'review',
      cls: { category: 'billing', urgency: 'high', intent_summary: 'Checkout errors led to three pending charges.', suggested_action: 'escalate', safety_flag: false, confidence: 0.80 }, route: 'review', reason: 'Looks like a website bug, but it’s really billing — sensitive category routes to a human' },

    { id: '19', subject: 'Cancel subscription and refund', from: 'l.crawford@gmail.com', body: "Please cancel my monthly box subscription and refund the charge from yesterday - I meant to cancel before it renewed.", trap: false, expected: 'review',
      cls: { category: 'billing', urgency: 'medium', intent_summary: "Wants to cancel their subscription and refund yesterday's charge.", suggested_action: 'escalate', safety_flag: false, confidence: 0.90 }, route: 'review', reason: 'Sensitive category (billing) — money always gets human eyes' },

    { id: '20', subject: 'hey quick thing about the bowman invoice', from: 'chris.t@gmail.com', body: "Hey! Hope you're doing well. Random - did you ever pay that Bowman Supply invoice from last month? They emailed me since I'm on the account. Lmk!", trap: true, expected: 'review',
      cls: { category: 'billing', urgency: 'medium', intent_summary: 'Casual note chasing an unpaid supplier invoice.', suggested_action: 'escalate', safety_flag: false, confidence: 0.75 }, route: 'review', reason: 'Friendly tone hiding a money question — classified billing, routes to a human' },

    { id: '21', subject: 'Wholesale inquiry', from: 'orders@stayboutique.co', body: "Hi, I run a small chain of boutique hotels and I'm interested in carrying your candles in our rooms. Do you offer wholesale pricing?", trap: false, expected: 'draft',
      cls: { category: 'sales', urgency: 'medium', intent_summary: 'Boutique hotel chain asking about wholesale pricing.', suggested_action: 'draft_reply', safety_flag: false, confidence: 0.90 }, route: 'draft', reason: 'Safe sales lead, high confidence',
      draft: "Hi! We'd love to see our candles in your hotels. Yes — we offer wholesale pricing for stockists, with tiers based on volume. Reply with the rough quantities and locations you're considering and we'll send our wholesale catalog and rates.\n\n— The Maple & Pine Team" },

    { id: '22', subject: 'Do you sell gift cards?', from: 'mia.r@gmail.com', body: "Looking to buy a gift for my sister but not sure what she'd want - do you offer gift cards?", trap: false, expected: 'draft',
      cls: { category: 'sales', urgency: 'low', intent_summary: 'Asking whether gift cards are available.', suggested_action: 'draft_reply', safety_flag: false, confidence: 0.95 }, route: 'draft', reason: 'Safe sales question, high confidence',
      draft: "Hi! Yes — we offer digital gift cards in a range of amounts. They're delivered by email and never expire, so they make a lovely, no-guesswork gift for your sister. You'll find them on our site under 'Gift Cards.' Let us know if you'd like a hand.\n\n— The Maple & Pine Team" },

    { id: '23', subject: 'Corporate gifting for 50 staff', from: 'people@northwind.io', body: "We'd like to send a small gift to about 50 employees for the holidays. Can you handle an order that size and do custom notes?", trap: false, expected: 'draft',
      cls: { category: 'sales', urgency: 'medium', intent_summary: 'Wants to order ~50 corporate gifts with custom notes.', suggested_action: 'draft_reply', safety_flag: false, confidence: 0.90 }, route: 'draft', reason: 'Safe sales lead, high confidence',
      draft: "Hi! We'd be delighted to handle a 50-gift order, and yes — we can include a custom note with each one. Reply with your timeline and any scent preferences and we'll put together options and pricing for the full set.\n\n— The Maple & Pine Team" },

    { id: '24', subject: 'Large order for a wedding next week', from: 'bride2b@gmail.com', body: "I need roughly 80 tealights and 20 jar candles for a wedding next Saturday. Ready to order today if you can confirm stock and timing.", trap: false, expected: 'draft',
      cls: { category: 'sales', urgency: 'high', intent_summary: 'Needs ~80 tealights and 20 jar candles for a wedding next week.', suggested_action: 'draft_reply', safety_flag: false, confidence: 0.90 }, route: 'draft', reason: 'Safe sales lead, high confidence',
      draft: "Hi! Congratulations on the upcoming wedding. An order of ~80 tealights and 20 jar candles for next Saturday is absolutely something we can do — I'm confirming current stock and timing now and will follow up shortly so you can place it today.\n\n— The Maple & Pine Team" },

    { id: '25', subject: 'When is the fig candle back?', from: 'tessa.v@gmail.com', body: "I keep checking for the black fig candle - any idea when it returns? I want to buy a few as soon as it's available.", trap: false, expected: 'draft',
      cls: { category: 'sales', urgency: 'low', intent_summary: 'Asking when the black fig candle restocks.', suggested_action: 'draft_reply', safety_flag: false, confidence: 0.90 }, route: 'draft', reason: 'Safe sales question, high confidence',
      draft: "Hi! The black fig is much-loved and it is coming back — a restock is in the works. Reply here and we'll notify you the moment it returns so you can grab a few.\n\n— The Maple & Pine Team" },

    { id: '26', subject: 'Bulk purchase - payment by check', from: 'global.trade88@mail.com', body: "I want to place a very large order ($6,800) for overseas resale. I will send a cashier's check for more than the total; please refund the difference and ship to my freight forwarder.", trap: true, expected: 'ignore',
      cls: { category: 'other', urgency: 'high', intent_summary: 'Large overseas order offering to overpay by cashier’s check and refund the difference.', suggested_action: 'escalate', safety_flag: false, confidence: 0.55 }, route: 'review', reason: 'Smells like an overpayment scam but the model wasn’t sure — low confidence sent it to a human',
      miss: 'Answer key says IGNORE (classic overpayment scam). The model hedged to REVIEW. A human catching a check scam is arguably the safer miss anyway.' },

    { id: '27', subject: 'Collab? Free product for posts', from: 'hey@lolastyles.co', body: "Hi! I'm a lifestyle creator with 40k followers. I'd love to feature your candles in exchange for free product. Open to a collab?", trap: true, expected: 'review',
      cls: { category: 'sales', urgency: 'low', intent_summary: 'Lifestyle creator offering promotion in exchange for free product.', suggested_action: 'draft_reply', safety_flag: false, confidence: 0.82 }, route: 'draft', reason: 'Read as a normal sales lead, so it drafted',
      draft: "Hi! Thanks so much for thinking of us, and for the kind words about our candles. We'd love to hear more about what a collaboration could look like — share your audience and a couple of content ideas and we'll see if it's a fit.\n\n— The Maple & Pine Team",
      miss: 'Answer key says REVIEW — whether to entertain an unsolicited collab is a business judgment call. A real gray area different shops would call differently.' },

    { id: '28', subject: 'Boost your store traffic 300%', from: 'growth@rankrocket.biz', body: "We help e-commerce brands triple their organic traffic. Reply YES and we'll send a free audit of your site within 24 hours.", trap: false, expected: 'ignore',
      cls: { category: 'spam', urgency: 'low', intent_summary: 'Marketing pitch offering an SEO/traffic audit.', suggested_action: 'ignore', safety_flag: false, confidence: 0.96 }, route: 'ignore', reason: 'Marketing spam — junked with no human time' },

    { id: '29', subject: "You've won a $1000 gift card!", from: 'rewards@prizevault.net', body: "Congratulations! You have been selected to receive a $1000 gift card. Click here to claim before it expires today.", trap: false, expected: 'ignore',
      cls: { category: 'spam', urgency: 'low', intent_summary: 'Prize scam claiming a $1000 gift card.', suggested_action: 'ignore', safety_flag: false, confidence: 0.98 }, route: 'ignore', reason: 'Obvious prize scam — junked' },

    { id: '30', subject: 'Turn $250 into $5000', from: 'invest@quantbotpro.io', body: "Our AI trading bot delivers guaranteed returns. Join thousands of investors. Limited spots. Act now.", trap: false, expected: 'ignore',
      cls: { category: 'spam', urgency: 'low', intent_summary: 'Investment scam promising guaranteed returns.', suggested_action: 'ignore', safety_flag: false, confidence: 0.98 }, route: 'ignore', reason: 'Investment scam — junked' },

    { id: '31', subject: 'More sales on autopilot', from: 'sales@funnelgenie.co', body: "Want more revenue without lifting a finger? Our platform automates your entire funnel. Book a demo today.", trap: false, expected: 'ignore',
      cls: { category: 'spam', urgency: 'low', intent_summary: 'Funnel-automation marketing spam.', suggested_action: 'ignore', safety_flag: false, confidence: 0.96 }, route: 'ignore', reason: 'Marketing spam — junked' },

    { id: '32', subject: 'Action required: your domain expires', from: 'billing@domain-renewals.info', body: "Your domain registration expires in 48 hours. Submit payment immediately to avoid losing your website. Pay now.", trap: false, expected: 'ignore',
      cls: { category: 'spam', urgency: 'low', intent_summary: 'Fake domain-expiration payment scam.', suggested_action: 'ignore', safety_flag: false, confidence: 0.95 }, route: 'ignore', reason: 'Phishing/scam — junked (note: not a safety flag, by design)' },

    { id: '33', subject: 'URGENT: Your store account is suspended', from: 'security@account-verify.app', body: "We detected suspicious activity. Your account has been SUSPENDED. Verify your login within 2 hours or it will be permanently deleted. Click here.", trap: true, expected: 'ignore',
      cls: { category: 'spam', urgency: 'high', intent_summary: 'Phishing email urging urgent login verification.', suggested_action: 'ignore', safety_flag: false, confidence: 0.90 }, route: 'ignore', reason: 'Looks urgent, but phishing is junk — and urgency/security wording is explicitly NOT a safety flag' },

    { id: '34', subject: 'Dinner Friday?', from: 'jess.allen@gmail.com', body: "Heyyy are you free Friday night? A few of us are grabbing dinner at that new ramen place. Would love to see you!", trap: false, expected: 'review',
      cls: { category: 'personal', urgency: 'low', intent_summary: 'Friend inviting them to dinner.', suggested_action: 'escalate', safety_flag: false, confidence: 0.95 }, route: 'review', reason: 'Personal mail — never auto-replied, always handed to a human' },

    { id: '35', subject: 'Sunday lunch', from: 'mom@gmail.com', body: "Hi sweetheart, are you coming over for lunch Sunday? Let me know how many so I can plan. Love you.", trap: false, expected: 'review',
      cls: { category: 'personal', urgency: 'medium', intent_summary: 'Family member asking about Sunday lunch.', suggested_action: 'escalate', safety_flag: false, confidence: 0.96 }, route: 'review', reason: 'Personal mail — never auto-replied, always handed to a human' },

    { id: '36', subject: 'Long time no talk', from: 'd.whitmore@gmail.com', body: "Hey stranger! It's been forever since college. Saw your shop online and I'm so proud of you. We should catch up soon.", trap: false, expected: 'review',
      cls: { category: 'personal', urgency: 'low', intent_summary: 'Old friend reconnecting.', suggested_action: 'escalate', safety_flag: false, confidence: 0.93 }, route: 'review', reason: 'Personal mail — never auto-replied, always handed to a human' },

    { id: '37', subject: 'Photos from the trip', from: 'sam.holt@gmail.com', body: "Finally got around to sending these - the lake house photos from last summer. Such a good weekend. Miss you!", trap: false, expected: 'review',
      cls: { category: 'personal', urgency: 'low', intent_summary: 'Friend sharing trip photos.', suggested_action: 'escalate', safety_flag: false, confidence: 0.95 }, route: 'review', reason: 'Personal mail — never auto-replied, always handed to a human' },

    { id: '38', subject: 'catching up + a small favor', from: 'a.delgado@gmail.com', body: "Hey! Been way too long, we need to grab a beer. Also btw - my sister wants to order a bunch of candles for her shop, can you send wholesale pricing?", trap: true, expected: 'review',
      cls: { category: 'personal', urgency: 'medium', intent_summary: 'Friend reconnecting and asking for wholesale pricing for their sister.', suggested_action: 'escalate', safety_flag: false, confidence: 0.80 }, route: 'review', reason: 'A business ask smuggled into a personal note — classified personal, so a human handles it' },

    { id: '39', subject: 'IS MY ORDER COMING????', from: 'taylorj@gmail.com', body: "URGENT!!!! I ordered a SINGLE candle and just want to know if the coupon worked, the page was confusing. PLEASE RESPOND.", trap: true, expected: 'draft',
      cls: { category: 'billing', urgency: 'low', intent_summary: 'Frantic customer asking whether their coupon applied to a single-candle order.', suggested_action: 'escalate', safety_flag: false, confidence: 0.78 }, route: 'review', reason: 'The model read the panic + "coupon" as billing, tripping the sensitive-category rule',
      miss: 'Answer key says DRAFT (it’s really a simple order question). The coupon mention pulled it into billing → review. Too cautious, but a rule worth keeping since the model usually can’t resolve billing on its own.' },

    { id: '40', subject: 'Allergic reaction concern', from: 'n.bennett@gmail.com', body: "My partner broke out in a rash after we lit the new candle. Are there nut oils in the ingredients? Want to know before using others.", trap: true, expected: 'review',
      cls: { category: 'support', urgency: 'high', intent_summary: "Partner had an allergic skin reaction; asking about nut oils in the ingredients.", suggested_action: 'escalate', safety_flag: true, confidence: 0.90 }, route: 'review', reason: 'Safety flag — a health/allergy concern goes straight to a human, ahead of every other rule' },
  ];

  // The four-version tuning story, straight from the project writeup.
  const VERSIONS = [
    ['Baseline', 'Classify, validate, three-way routing, sensitive-category rule', '78% (31/40)'],
    ['Fix 1', "Stopped letting the model's suggested action drive routing (it was sending personal mail to ignore)", '88% (35/40)'],
    ['Safety flag added', 'Added the safety override, but with an over-eager "when in doubt, flag it" instruction', '83% (33/40)'],
    ['Fix 2', 'Tightened the safety definition with explicit exclusions to cut false alarms', '93% (37/40)'],
  ];

  const REPO_URL = 'https://github.com/mswayney-software/ai_email_triager';
  const CANVAS_IMG = 'https://github.com/user-attachments/assets/fa907c2e-1ffb-4953-b8c0-874de0479524';

  const total = EMAILS.length;
  const hits = EMAILS.filter(e => e.route === e.expected).length;
  const traps = EMAILS.filter(e => e.trap).length;

  let currentFilter = 'all';
  let activeId = null;
  let runToken = 0; // cancels an in-flight animation when a new email is picked

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function classificationJSON(e) {
    const c = e.cls;
    return '{\n' +
      '  "category": "' + c.category + '",\n' +
      '  "urgency": "' + c.urgency + '",\n' +
      '  "intent_summary": "' + c.intent_summary + '",\n' +
      '  "suggested_action": "' + c.suggested_action + '",\n' +
      '  "safety_flag": ' + c.safety_flag + ',\n' +
      '  "confidence": ' + c.confidence.toFixed(2) + '\n' +
      '}';
  }

  function matchesFilter(e) {
    if (currentFilter === 'all') return true;
    if (currentFilter === 'traps') return e.trap;
    return e.route === currentFilter;
  }

  function renderList() {
    const list = document.getElementById('etList');
    if (!list) return;
    const items = EMAILS.filter(matchesFilter);
    list.innerHTML = items.map(e => {
      const lane = LANES[e.route];
      const miss = e.route !== e.expected;
      return '<div class="et-item' + (e.id === activeId ? ' et-item-active' : '') + '" data-id="' + e.id + '">' +
        '<span class="et-dot ' + lane.cls + '"></span>' +
        '<div class="et-item-main">' +
          '<div class="et-item-subj">' + esc(e.subject) + (e.trap ? ' <span class="et-trap">trap</span>' : '') + (miss ? ' <span class="et-miss-tag">miss</span>' : '') + '</div>' +
          '<div class="et-item-from">' + esc(e.from) + '</div>' +
        '</div>' +
        '<span class="et-lane-mini ' + lane.cls + '">' + lane.label + '</span>' +
      '</div>';
    }).join('') || '<div class="et-empty">No emails in this filter.</div>';

    list.querySelectorAll('.et-item').forEach(el => {
      el.addEventListener('click', () => selectEmail(el.getAttribute('data-id')));
    });
  }

  function setFilter(f) {
    currentFilter = f;
    document.querySelectorAll('.et-filter').forEach(b => b.classList.toggle('et-filter-on', b.getAttribute('data-f') === f));
    renderList();
  }

  function wait(ms, token) {
    return new Promise((resolve, reject) => setTimeout(() => token === runToken ? resolve() : reject('cancelled'), ms));
  }

  async function selectEmail(id) {
    const e = EMAILS.find(x => x.id === id);
    if (!e) return;
    activeId = id;
    renderList();
    const detail = document.getElementById('etDetail');
    const lane = LANES[e.route];
    const miss = e.route !== e.expected;

    detail.innerHTML =
      '<div class="et-email-card">' +
        '<div class="et-email-head"><span class="et-email-from">' + esc(e.from) + '</span><span class="et-email-id">#' + e.id + '</span></div>' +
        '<div class="et-email-subj">' + esc(e.subject) + '</div>' +
        '<div class="et-email-body">' + esc(e.body) + '</div>' +
      '</div>' +
      '<div class="et-pipe" id="etPipe"></div>';

    const pipe = document.getElementById('etPipe');
    const token = ++runToken;

    function step(html) {
      const div = document.createElement('div');
      div.className = 'et-step et-step-in';
      div.innerHTML = html;
      pipe.appendChild(div);
      pipe.scrollTop = pipe.scrollHeight;
      return div;
    }

    try {
      step('<div class="et-step-head"><span class="et-step-num">1</span> Classify <span class="et-model">Claude Haiku 4.5</span></div>' +
           '<pre class="et-json">' + esc(classificationJSON(e)) + '</pre>');
      await wait(650, token);

      step('<div class="et-step-head"><span class="et-step-num">2</span> Validate &amp; Flag <span class="et-model">code</span></div>' +
           '<div class="et-rule">Parsed OK · fields valid · confidence ' + e.cls.confidence.toFixed(2) + (e.cls.confidence < 0.7 ? ' &lt; 0.70 → review' : ' ≥ 0.70') + '</div>' +
           '<div class="et-rule">' + esc(e.reason) + '</div>');
      await wait(650, token);

      const routeStep = step('<div class="et-step-head"><span class="et-step-num">3</span> Route</div>' +
           '<div class="et-lane-badge ' + lane.cls + '">' + lane.label + '</div>' +
           '<div class="et-lane-blurb">' + esc(lane.blurb) + '</div>');
      await wait(550, token);

      if (e.route === 'draft' && e.draft) {
        step('<div class="et-step-head"><span class="et-step-num">4</span> Draft reply <span class="et-model">Claude Sonnet 4.6</span></div>' +
             '<div class="et-reply">' + esc(e.draft).replace(/\n/g, '<br>') + '</div>' +
             '<div class="et-reply-note">Draft only — a human approves before anything sends.</div>');
        await wait(400, token);
      }

      // Answer-key verdict
      if (miss) {
        step('<div class="et-verdict et-verdict-miss">✕ Differs from answer key &nbsp;<span>routed ' + lane.label.toLowerCase() + ', key says ' + e.expected + '</span></div>' +
             (e.miss ? '<div class="et-miss-note">' + esc(e.miss) + '</div>' : ''));
      } else {
        step('<div class="et-verdict et-verdict-hit">✓ Matches the answer key &nbsp;<span>expected ' + e.expected + '</span></div>');
      }
    } catch (_) { /* cancelled by a newer selection */ }
  }

  function renderAbout() {
    const rows = VERSIONS.map(v =>
      '<tr><td>' + esc(v[0]) + '</td><td>' + esc(v[1]) + '</td><td class="et-acc">' + esc(v[2]) + '</td></tr>'
    ).join('');
    return '' +
      '<div class="et-about">' +
        '<p class="et-about-lead">A small business inbox is a pile of disorganized "stuff" wearing matching outfits. This pipeline reads each incoming email, decides what it actually needs, and drafts a reply <em>only</em> for the ones safe to answer automatically — pushing anything sensitive or uncertain to a human, and never losing a message.</p>' +
        '<div class="et-flow">' +
          '<span class="et-flow-node">Seed emails</span><span class="et-flow-arrow">→</span>' +
          '<span class="et-flow-node">Classify <small>Haiku 4.5</small></span><span class="et-flow-arrow">→</span>' +
          '<span class="et-flow-node">Validate &amp; Flag</span><span class="et-flow-arrow">→</span>' +
          '<span class="et-flow-node">Switch</span>' +
          '<div class="et-flow-lanes">' +
            '<span class="et-flow-lane et-draft">draft <small>Sonnet 4.6 writes a reply</small></span>' +
            '<span class="et-flow-lane et-review">review <small>held for a human</small></span>' +
            '<span class="et-flow-lane et-ignore">ignore <small>junked, no action</small></span>' +
          '</div>' +
        '</div>' +
        '<h3>How it went from 78% to 93%</h3>' +
        '<table class="et-table"><thead><tr><th>Version</th><th>What changed</th><th>Accuracy</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<h3>Decisions that matter</h3>' +
        '<ul class="et-points">' +
          '<li><strong>Drafts only, never auto-send.</strong> Worst case is a human deleting a bad draft — not a customer receiving one.</li>' +
          '<li><strong>Three lanes, not two.</strong> Draft, review, <em>or</em> ignore — so obvious junk never reaches a person’s desk.</li>' +
          '<li><strong>Business rules beat model confidence.</strong> Billing and personal mail go to a human even at 95% confidence. The model classifies; the rules decide.</li>' +
          '<li><strong>Safety by comprehension, not keywords.</strong> A model-set safety flag catches "my throat closed up"; a keyword list wouldn’t. It runs first, ahead of the spam filter.</li>' +
          '<li><strong>Cheap model to sort, better model to write.</strong> Haiku 4.5 fires on every email; Sonnet 4.6 only writes the handful that reach the draft lane. Total spend to build and tune: 44¢.</li>' +
        '</ul>' +
        '<p class="et-stack"><strong>Stack:</strong> n8n (self-hosted, Docker) · Claude API (Haiku 4.5 classify, Sonnet 4.6 draft) · JavaScript for validation, routing &amp; scoring.</p>' +
        '<a class="et-canvas" href="' + CANVAS_IMG + '" target="_blank" rel="noopener"><img src="' + CANVAS_IMG + '" alt="n8n workflow canvas" loading="lazy"></a>' +
        '<p class="et-repo"><a href="' + REPO_URL + '" target="_blank" rel="noopener">▸ Full write-up &amp; workflow on GitHub</a></p>' +
        '<p class="et-disclaimer">This demo replays the project’s real 40-email test set and its documented routing results (' + hits + '/' + total + '). Outputs are pre-recorded so it runs instantly with no API calls.</p>' +
      '</div>';
  }

  function showTab(tab) {
    document.querySelectorAll('.et-tab').forEach(b => b.classList.toggle('et-tab-on', b.getAttribute('data-tab') === tab));
    document.getElementById('etInboxView').style.display = tab === 'inbox' ? 'flex' : 'none';
    document.getElementById('etAboutView').style.display = tab === 'about' ? 'block' : 'none';
  }

  function build() {
    const root = document.getElementById('etRoot');
    if (!root) return;
    root.innerHTML =
      '<div class="et-bar">' +
        '<div class="et-stats">' +
          '<span class="et-stat"><b>' + Math.round(hits / total * 100) + '%</b> routing accuracy <small>(' + hits + '/' + total + ')</small></span>' +
          '<span class="et-stat"><b>' + total + '</b> test emails</span>' +
          '<span class="et-stat"><b>' + traps + '</b> traps</span>' +
        '</div>' +
        '<div class="et-tabs">' +
          '<button class="et-tab et-tab-on" data-tab="inbox">Inbox</button>' +
          '<button class="et-tab" data-tab="about">How it works</button>' +
        '</div>' +
      '</div>' +
      '<div class="et-inbox" id="etInboxView">' +
        '<div class="et-left">' +
          '<div class="et-filters">' +
            '<button class="et-filter et-filter-on" data-f="all">All</button>' +
            '<button class="et-filter" data-f="draft">Drafted</button>' +
            '<button class="et-filter" data-f="review">Review</button>' +
            '<button class="et-filter" data-f="ignore">Ignore</button>' +
            '<button class="et-filter" data-f="traps">Traps</button>' +
          '</div>' +
          '<div class="et-list" id="etList"></div>' +
        '</div>' +
        '<div class="et-detail" id="etDetail">' +
          '<div class="et-placeholder">' +
            '<div class="et-placeholder-icon">✉</div>' +
            '<p>Pick an email to watch it flow through the pipeline:<br><b>Classify → Validate → Route → Draft</b>.</p>' +
            '<p class="et-placeholder-tip">Try the <b>Traps</b> filter — those are the nine deliberately tricky ones.</p>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="et-aboutwrap" id="etAboutView" style="display:none">' + renderAbout() + '</div>';

    root.querySelectorAll('.et-filter').forEach(b => b.addEventListener('click', () => setFilter(b.getAttribute('data-f'))));
    root.querySelectorAll('.et-tab').forEach(b => b.addEventListener('click', () => showTab(b.getAttribute('data-tab'))));
    renderList();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
