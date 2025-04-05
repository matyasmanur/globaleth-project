require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { createPublicClient, createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { celoAlfajores } = require('viem/chains');
const { getContract } = require('viem');
const { registryABI } = require('@celo/abis');
const { goldTokenABI } = require('@celo/abis/GoldToken');
const { stableTokenABI } = require('@celo/abis/StableToken');
const logger = require('./utils/logger');
const friendsManager = require('./utils/friendsManager');

const maxFeePerGasNum = 30;
const maxPriorityFeePerGasNum = 2;

// Initialize Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
logger.info('Telegram bot initialized');

// Initialize viem clients
const publicClient = createPublicClient({
    chain: celoAlfajores,
    transport: http()
});

const walletClient = createWalletClient({
    transport: http(celoAlfajores.rpcUrls.default.http[0]),
    chain: celoAlfajores,
});

// Initialize wallet
let account;
try {
    // Ensure private key starts with 0x and is properly formatted
    const privateKey = process.env.WALLET_PRIVATE_KEY.startsWith('0x') 
        ? process.env.WALLET_PRIVATE_KEY 
        : `0x${process.env.WALLET_PRIVATE_KEY}`;
    account = privateKeyToAccount(privateKey);
    logger.info(`Wallet initialized with address: ${account.address}`);
} catch (error) {
    logger.error('Failed to initialize wallet:', error);
    process.exit(1);
}

// Initialize token contracts
const REGISTRY_CONTRACT_ADDRESS = '0x000000000000000000000000000000000000ce10';
const registryContract = getContract({
    address: REGISTRY_CONTRACT_ADDRESS,
    abi: registryABI,
    client: publicClient,
});

async function getTokenAddresses() {
    const tokens = ['GoldToken', 'StableToken'];
    const addresses = await Promise.all(
        tokens.map(async (token) => {
            const address = await publicClient.readContract({
                address: REGISTRY_CONTRACT_ADDRESS,
                abi: registryABI,
                functionName: 'getAddressForString',
                args: [token]
            });
            return [token, address];
        })
    );
    return Object.fromEntries(addresses);
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
        const tokenAddresses = await getTokenAddresses();
        const celoAddress = tokenAddresses['GoldToken'];
        const cusdAddress = tokenAddresses['StableToken'];

        const [celoBalance, cusdBalance] = await Promise.all([
            publicClient.readContract({
                abi: goldTokenABI,
                address: celoAddress,
                functionName: 'balanceOf',
                args: [account.address],
            }),
            publicClient.readContract({
                abi: stableTokenABI,
                address: cusdAddress,
                functionName: 'balanceOf',
                args: [account.address],
            })
        ]);

        const response = `
Your Celo Balance:
CELO: ${(Number(celoBalance) / 1e18).toFixed(4)}
cUSD: ${(Number(cusdBalance) / 1e18).toFixed(4)}
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
        const tx = await publicClient.getTransaction({ hash: txHash });
        const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
        
        
        
        const response = `
Transaction Information:
Hash: ${txHash}
From: ${tx.from}
To: ${tx.to || 'Contract Creation'}
Value: ${Number(tx.value) / 1e18} CELO
Status: ${receipt.status === 'success' ? 'Success' : 'Failed'}
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
        if (!recipient.startsWith('0x')) {
            toAddress = friendsManager.getFriend(msg.from.id, recipient);
            if (!toAddress) {
                await bot.sendMessage(chatId, `Friend "${recipient}" not found! Please use a valid address or friend name.`);
                return;
            }
        }
        
        const hash = await walletClient.sendTransaction({
            to: toAddress,
            value: BigInt(amount * 1e18),
            account: account,
        });
        
        const response = `
            Transaction sent! 🚀
            Hash: ${hash}
            Amount: ${amount} CELO
            To: ${toAddress}
                    `;
                    await bot.sendMessage(chatId, response);
                    logger.info(`CELO transfer successful: ${hash}`);
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
        if (!recipient.startsWith('0x')) {
            toAddress = friendsManager.getFriend(msg.from.id, recipient);
            if (!toAddress) {
                await bot.sendMessage(chatId, `Friend "${recipient}" not found! Please use a valid address or friend name.`);
                return;
            }
        }
        
        const tokenAddresses = await getTokenAddresses();
        const cusdAddress = tokenAddresses['StableToken'];
        
        const hash = await walletClient.writeContract({
            abi: stableTokenABI,
            address: cusdAddress,
            functionName: 'transfer',
            args: [toAddress, BigInt(amount * 1e18)],
            account: account,
        });
        
        const response = `
Transaction sent! 🚀
Hash: ${hash}
Amount: ${amount} cUSD
To: ${toAddress}
        `;
        await bot.sendMessage(chatId, response);
        logger.info(`cUSD transfer successful: ${hash}`);
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