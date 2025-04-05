require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { ContractKit, newKit } = require('@celo/contractkit');
const Web3 = require('web3');

// Initialize Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Initialize Celo Kit
const web3 = new Web3(process.env.CELO_TESTNET_RPC_URL);
const kit = newKit(process.env.CELO_TESTNET_RPC_URL);

// Initialize OpenAI client
const { OpenAI } = require('openai');
const openai = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com"
});

// Command handlers
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = `
Welcome to the Celo Telegram Bot! 🚀

Available commands:
/balance - Check your Celo balance
/tx_info <hash> - Get transaction information
/help - Show this help message
    `;
    await bot.sendMessage(chatId, welcomeMessage);
});

bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const helpText = `
Available commands:
/balance - Check your Celo balance
/tx_info <hash> - Get transaction information
/help - Show this help message
    `;
    await bot.sendMessage(chatId, helpText);
});

bot.onText(/\/balance/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const wallet = kit.web3.eth.accounts.privateKeyToAccount(process.env.WALLET_PRIVATE_KEY);
        kit.addAccount(wallet.privateKey);
        
        const balance = await kit.getTotalBalance(wallet.address);
        const response = `
Your Celo Balance:
CELO: ${balance.CELO.toString()}
cUSD: ${balance.cUSD.toString()}
        `;
        await bot.sendMessage(chatId, response);
    } catch (error) {
        await bot.sendMessage(chatId, `Error getting balance: ${error.message}`);
    }
});

bot.onText(/\/tx_info (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const txHash = match[1];
    
    try {
        const tx = await kit.web3.eth.getTransaction(txHash);
        const receipt = await kit.web3.eth.getTransactionReceipt(txHash);
        
        const response = `
Transaction Information:
Hash: ${txHash}
From: ${tx.from}
To: ${tx.to || 'Contract Creation'}
Value: ${kit.web3.utils.fromWei(tx.value, 'ether')} CELO
Status: ${receipt.status ? 'Success' : 'Failed'}
        `;
        await bot.sendMessage(chatId, response);
    } catch (error) {
        await bot.sendMessage(chatId, `Error getting transaction info: ${error.message}`);
    }
});

// Handle other messages with OpenAI
bot.on('message', async (msg) => {
    if (msg.text.startsWith('/')) return; // Skip command messages
    
    const chatId = msg.chat.id;
    try {
        const completion = await openai.chat.completions.create({
            model: "deepseek-chat",
            messages: [
                { role: "system", content: "You are a helpful assistant for Celo blockchain operations." },
                { role: "user", content: msg.text }
            ]
        });
        
        await bot.sendMessage(chatId, completion.choices[0].message.content);
    } catch (error) {
        await bot.sendMessage(chatId, `Error processing message: ${error.message}`);
    }
});

console.log('Bot is running...'); 