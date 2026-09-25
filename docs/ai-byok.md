# AI features (bring your own key)

Almanac's AI can **draft replies** for you to check and send, and can
**answer customers by itself** when you're busy, handing over to a person
when it isn't sure. It learns your business from a short description
and a **knowledge base** of your FAQs, prices and policies.

It works on **your own API key** from OpenAI or Anthropic. This is called
*bring your own key* (BYOK):

- **You pay the AI provider directly, at their price.** No per-seat AI fee,
  no markup. With the suggested fast models, each reply costs a tiny
  fraction of a rupee; the provider's pricing page has exact rates.
- **Your conversations stay yours.** Almanac sends each request from your
  own server straight to the provider. Nothing passes through us.
- **You stay in control.** Set a monthly spending limit with the provider,
  switch models, or remove the key at any time.

## 1. Get an API key (pick one provider)

### OpenAI

1. Sign in at [platform.openai.com](https://platform.openai.com).
2. **Settings → Billing:** add a card and buy a small amount of credit
   (e.g. $5). Keys don't work without credit.
3. **Settings → Limits:** set a monthly budget so you're never surprised.
4. **API keys → Create new secret key.** Name it `almanac`, copy it
   (starts with `sk-`). It's shown only once.

### Anthropic (Claude)

1. Sign in at [console.anthropic.com](https://console.anthropic.com).
2. **Billing:** add credit (e.g. $5).
3. **Limits:** set a monthly spend limit.
4. **API keys → Create key.** Name it `almanac`, copy it (starts with
   `sk-ant-`). It's shown only once.

Either works well. If you're unsure, start with whichever you already
have an account with.

## 2. Add it to Almanac

1. Open **AI Agents → Setup** in the left-hand menu. (Admins and owners
   only.)
2. **Provider:** OpenAI or Anthropic. **Model:** leave the suggested one;
   it's fast and cheap, which is what chat replies need.
3. **API key:** paste it and click **Test key**. You should see *Key
   works*. Almanac stores it encrypted and never shows it again.
4. **Business context:** a few lines about your business and how to
   talk. The better this is, the better the replies. For example:

   > We are Sharma Textiles, a saree shop in Jaipur, open 10am to 8pm,
   > Monday to Saturday. Be warm and brief. Reply in Hindi if the
   > customer writes in Hindi. Never promise delivery dates or discounts;
   > hand over to a person for those. Payment is by UPI to sharmatex@upi.

5. Turn on **Enable AI assistant** and **Save**.

## 3. Teach it your business (knowledge base)

On the same page, **Knowledge base → Add document**. Add one document per
topic: *Price list*, *Delivery and returns*, *Store timings and location*,
*Sizes and care*. Plain text is fine; paste from a WhatsApp note or a
Google Doc.

The assistant looks up the relevant documents before every reply, so it
answers from your facts instead of guessing.

**Optional, smarter search:** add an **Embeddings key** (an OpenAI key;
it can be the same one). The assistant then finds answers by meaning, so
"how much for the blue one" matches your *Price list* even without the
word "price". Click **Reindex** after adding it.

## 4. Try it before customers do

Open **AI Agents → Playground**, type questions the way customers ask
them, and read the answers. Adjust the business context or the
knowledge base until you're happy.

## 5. Use it

- **Draft with AI:** in any chat, tap **✨**. The assistant writes a
  reply from the conversation and your knowledge base. Edit and send.
  Nothing goes out without you.
- **Auto-reply (optional):** turn on **Auto-reply to inbound messages**
  in Setup. The assistant then answers new messages by itself, but only
  when no chatbot flow is handling the chat and no person is assigned.
  - **Max auto-replies per conversation** stops it after a few messages.
  - **Hand off to** chooses who gets the chat when it can't help or hits
    the limit. It leaves a note explaining why.

**AI Agents → Usage** shows how many requests and tokens you've used, so
you can match it against the provider's bill.

## Good habits

- Start with **Draft with AI** for a week before turning on auto-reply.
- Keep the knowledge base current. A wrong price in it becomes a wrong
  price in chat.
- Tell it what *not* to do (discounts, delivery promises, medical or
  legal advice).
- If a key leaks, delete it at the provider, create a new one and paste
  it into Setup.

## Troubleshooting

| You see | Fix |
|---|---|
| "AI isn't set up yet" | Add a key in **AI Agents → Setup** and enable the assistant |
| "The provider rejected the request" | Wrong key, or no credit left. Check billing with the provider |
| "Could not reach the provider" | Your server can't reach the internet, or the provider is down. Try again shortly |
| Replies are generic | Add more to the business context and the knowledge base |
| Auto-reply stays quiet | A person is assigned to the chat, a flow is handling it, or the reply cap was reached |
