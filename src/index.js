require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { ContractKit, newKit } = require('@celo/contractkit');
const Web3 = require('web3');
const logger = require('./utils/logger');
const friendsManager = require('./utils/friendsManager');

// Initialize Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
logger.info('Telegram bot initialized');

// Initialize Celo Kit
const web3 = new Web3(process.env.CELO_TESTNET_RPC_URL);
const kit = newKit(process.env.CELO_TESTNET_RPC_URL);
logger.info('Celo Kit initialized');

// Initialize OpenAI client
const { OpenAI } = require('openai');
const openai = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com"
});
logger.info('OpenAI client initialized');

// Initialize wallet
let wallet;
try {
    wallet = kit.web3.eth.accounts.privateKeyToAccount(process.env.WALLET_PRIVATE_KEY);
    kit.addAccount(wallet.privateKey);
    logger.info(`Wallet initialized with address: ${wallet.address}`);
} catch (error) {
    logger.error('Failed to initialize wallet:', error);
    process.exit(1);
}

// Command handlers
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    logger.info(`New user started bot: ${msg.from.username || msg.from.id}`);
    
    const welcomeMessage = `
Welcome to the Celo Telegram Bot! 🚀

Available commands:
/balance - Check your Celo balance
/tx_info <hash> - Get transaction information
/send <amount> <address|friend> - Send CELO to an address or friend
/send_cusd <amount> <address|friend> - Send cUSD to an address or friend
/price - Get current CELO and cUSD prices
/addfriend <name> <address> - Add a friend's address
/removefriend <name> - Remove a friend
/listfriends - List all your friends
/help - Show this help message
    `;
    await bot.sendMessage(chatId, welcomeMessage);
});

bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    logger.info(`Help requested by: ${msg.from.username || msg.from.id}`);
    
    const helpText = `
Available commands:
/balance - Check your Celo balance
/tx_info <hash> - Get transaction information
/send <amount> <address|friend> - Send CELO to an address or friend
/send_cusd <amount> <address|friend> - Send cUSD to an address or friend
/price - Get current CELO and cUSD prices
/addfriend <name> <address> - Add a friend's address
/removefriend <name> - Remove a friend
/listfriends - List all your friends
/help - Show this help message
    `;
    await bot.sendMessage(chatId, helpText);
});

bot.onText(/\/balance/, async (msg) => {
    const chatId = msg.chat.id;
    logger.info(`Balance check requested by: ${msg.from.username || msg.from.id}`);
    
    try {
        const balance = await kit.getTotalBalance(wallet.address);
        const response = `
Your Celo Balance:
CELO: ${balance.CELO.toString()}
cUSD: ${balance.cUSD.toString()}
        `;
        await bot.sendMessage(chatId, response);
        logger.info(`Balance sent to user: ${msg.from.username || msg.from.id}`);
    } catch (error) {
        logger.error('Error getting balance:', error);
        await bot.sendMessage(chatId, `Error getting balance: ${error.message}`);
    }
});

bot.onText(/\/tx_info (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const txHash = match[1];
    logger.info(`Transaction info requested for hash: ${txHash} by: ${msg.from.username || msg.from.id}`);
    
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
Gas Used: ${receipt.gasUsed}
        `;
        await bot.sendMessage(chatId, response);
        logger.info(`Transaction info sent to user: ${msg.from.username || msg.from.id}`);
    } catch (error) {
        logger.error('Error getting transaction info:', error);
        await bot.sendMessage(chatId, `Error getting transaction info: ${error.message}`);
    }
});

bot.onText(/\/addfriend (.+) (0x[a-fA-F0-9]{40})/, async (msg, match) => {
    const chatId = msg.chat.id;
    const name = match[1].trim();
    const address = match[2];
    logger.info(`Add friend request: ${name} - ${address} by: ${msg.from.username || msg.from.id}`);
    
    try {
        friendsManager.addFriend(msg.from.id, name, address);
        await bot.sendMessage(chatId, `Friend "${name}" added successfully!`);
        logger.info(`Friend added: ${name} - ${address}`);
    } catch (error) {
        logger.error('Error adding friend:', error);
        await bot.sendMessage(chatId, `Error adding friend: ${error.message}`);
    }
});

bot.onText(/\/removefriend (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const name = match[1].trim();
    logger.info(`Remove friend request: ${name} by: ${msg.from.username || msg.from.id}`);
    
    try {
        if (friendsManager.removeFriend(msg.from.id, name)) {
            await bot.sendMessage(chatId, `Friend "${name}" removed successfully!`);
            logger.info(`Friend removed: ${name}`);
        } else {
            await bot.sendMessage(chatId, `Friend "${name}" not found!`);
        }
    } catch (error) {
        logger.error('Error removing friend:', error);
        await bot.sendMessage(chatId, `Error removing friend: ${error.message}`);
    }
});

bot.onText(/\/listfriends/, async (msg) => {
    const chatId = msg.chat.id;
    logger.info(`List friends requested by: ${msg.from.username || msg.from.id}`);
    
    try {
        const friends = friendsManager.listFriends(msg.from.id);
        if (Object.keys(friends).length === 0) {
            await bot.sendMessage(chatId, "You don't have any friends added yet!");
            return;
        }
        
        let response = "Your friends:\n\n";
        for (const [name, address] of Object.entries(friends)) {
            response += `${name}: ${address}\n`;
        }
        
        await bot.sendMessage(chatId, response);
        logger.info(`Friends list sent to user: ${msg.from.username || msg.from.id}`);
    } catch (error) {
        logger.error('Error listing friends:', error);
        await bot.sendMessage(chatId, `Error listing friends: ${error.message}`);
    }
});

// Modified send commands to support friends
bot.onText(/\/send (\d+(?:\.\d+)?) (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const amount = match[1];
    const recipient = match[2].trim();
    logger.info(`Send CELO request: ${amount} to ${recipient} by: ${msg.from.username || msg.from.id}`);
    
    try {
        let toAddress = recipient;
        // Check if recipient is a friend name
        if (!recipient.startsWith('0x')) {
            toAddress = friendsManager.getFriend(msg.from.id, recipient);
            if (!toAddress) {
                await bot.sendMessage(chatId, `Friend "${recipient}" not found! Please use a valid address or friend name.`);
                return;
            }
        }
        
        const goldToken = await kit.contracts.getGoldToken();
        const tx = await goldToken.transfer(
            toAddress,
            kit.web3.utils.toWei(amount, 'ether')
        ).send({ 
            from: wallet.address,
            type: 2, // EIP-1559 transaction type
            maxFeePerGas: kit.web3.utils.toWei('0.1', 'gwei'),
            maxPriorityFeePerGas: kit.web3.utils.toWei('0.01', 'gwei')
        });
        
        const response = `
Transaction sent! 🚀
Hash: ${tx.hash}
Amount: ${amount} CELO
To: ${toAddress}
        `;
        await bot.sendMessage(chatId, response);
        logger.info(`CELO transfer successful: ${tx.hash}`);
    } catch (error) {
        logger.error('Error sending CELO:', error);
        await bot.sendMessage(chatId, `Error sending CELO: ${error.message}`);
    }
});

bot.onText(/\/send_cusd (\d+(?:\.\d+)?) (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const amount = match[1];
    const recipient = match[2].trim();
    logger.info(`Send cUSD request: ${amount} to ${recipient} by: ${msg.from.username || msg.from.id}`);
    
    try {
        let toAddress = recipient;
        // Check if recipient is a friend name
        if (!recipient.startsWith('0x')) {
            toAddress = friendsManager.getFriend(msg.from.id, recipient);
            if (!toAddress) {
                await bot.sendMessage(chatId, `Friend "${recipient}" not found! Please use a valid address or friend name.`);
                return;
            }
        }
        
        const stableToken = await kit.contracts.getStableToken();
        const tx = await stableToken.transfer(
            toAddress,
            kit.web3.utils.toWei(amount, 'ether')
        ).send({ 
            from: wallet.address,
            type: 2, // EIP-1559 transaction type
            maxFeePerGas: kit.web3.utils.toWei('0.1', 'gwei'),
            maxPriorityFeePerGas: kit.web3.utils.toWei('0.01', 'gwei')
        });
        
        const response = `
Transaction sent! 🚀
Hash: ${tx.hash}
Amount: ${amount} cUSD
To: ${toAddress}
        `;
        await bot.sendMessage(chatId, response);
        logger.info(`cUSD transfer successful: ${tx.hash}`);
    } catch (error) {
        logger.error('Error sending cUSD:', error);
        await bot.sendMessage(chatId, `Error sending cUSD: ${error.message}`);
    }
});

// Handle other messages with OpenAI
bot.on('message', async (msg) => {
    if (msg.text.startsWith('/')) return; // Skip command messages
    
    const chatId = msg.chat.id;
    logger.info(`Natural language query from ${msg.from.username || msg.from.id}: ${msg.text}`);
    
    try {
        const completion = await openai.chat.completions.create({
            model: "deepseek-chat",
            messages: [
                { role: "system", content: "You are a helpful assistant for Celo blockchain operations." },
                { role: "user", content: msg.text }
            ]
        });
        
        await bot.sendMessage(chatId, completion.choices[0].message.content);
        logger.info(`Response sent to user: ${msg.from.username || msg.from.id}`);
    } catch (error) {
        logger.error('Error processing message:', error);
        await bot.sendMessage(chatId, `Error processing message: ${error.message}`);
    }
});

logger.info('Bot is running...'); 