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
const { OpenAI } = require('openai');

const { tools, conversationHistory, systemPrompt, localData, aiConfig, saveLocalData, loadLocalData } = require('./utils/aiTools');

const maxFeePerGasNum = 30;
const maxPriorityFeePerGasNum = 2;

// Initialize OpenAI client
openai = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com"
});

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

// Set bot address in local data
localData.botAddress = account.address;
saveLocalData();

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

// AI Command Handlers
bot.onText(/\/llm (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query = match[1];
    const userId = msg.from.id;
    const username = msg.from.username || userId;
    
    logger.info(`[AI] New query from ${username}: ${query}`);
    
    try {
        // Initialize conversation if not exists
        if (!conversationHistory.has(chatId)) {
            logger.info(`[AI] Initializing new conversation for user ${username}`);
            conversationHistory.set(chatId, []);
        }
        
        // Add context about the bot
        const context = `I am analyzing data from the ${aiConfig.environment.network} network. My address is ${localData.botAddress}.`;
        logger.info(`[AI] Adding context: ${context}`);
        
        // Add user message to history
        conversationHistory.get(chatId).push({ role: 'user', content: `${context}\n\n${query}` });
        logger.info(`[AI] Added user message to conversation history`);
        
        // Get AI response
        logger.info(`[AI] Processing query...`);
        const response = await processAIQuery(chatId, userId, query);
        logger.info(`[AI] Response generated: ${response.substring(0, 100)}...`);
        
        // Add AI response to history
        conversationHistory.get(chatId).push({ role: 'assistant', content: response });
        logger.info(`[AI] Added AI response to conversation history`);
        
        await bot.sendMessage(chatId, response);
        logger.info(`[AI] Response sent to user ${username}`);
    } catch (error) {
        logger.error(`[AI] Error processing query for user ${username}:`, error);
        await bot.sendMessage(chatId, `Error processing query: ${error.message}`);
    }
});

bot.onText(/\/llmnext (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query = match[1];
    const userId = msg.from.id;
    const username = msg.from.username || userId;
    
    logger.info(`[AI] Follow-up query from ${username}: ${query}`);
    
    try {
        if (!conversationHistory.has(chatId)) {
            logger.warn(`[AI] No previous conversation found for user ${username}`);
            await bot.sendMessage(chatId, 'No previous conversation found. Please start with /llm command.');
            return;
        }
        
        // Add user message to history
        conversationHistory.get(chatId).push({ role: 'user', content: query });
        logger.info(`[AI] Added follow-up message to conversation history`);
        
        // Get AI response
        logger.info(`[AI] Processing follow-up query...`);
        const response = await processAIQuery(chatId, userId, query);
        logger.info(`[AI] Follow-up response generated: ${response.substring(0, 100)}...`);
        
        // Add AI response to history
        conversationHistory.get(chatId).push({ role: 'assistant', content: response });
        logger.info(`[AI] Added follow-up response to conversation history`);
        
        await bot.sendMessage(chatId, response);
        logger.info(`[AI] Follow-up response sent to user ${username}`);
    } catch (error) {
        logger.error(`[AI] Error processing follow-up for user ${username}:`, error);
        await bot.sendMessage(chatId, `Error processing follow-up: ${error.message}`);
    }
});


async function processAIQuery(chatId, userId, query) {
    // const { OpenAI } = require('openai');
    // const openai = new OpenAI({
    //   apiKey: process.env.DEEPSEEK_API_KEY,
    //   baseURL: "https://api.deepseek.com"
    // });
  
    logger.info('=== Starting AI Query Processing ===');
    logger.info('Query parameters:', { chatId, userId, query });
  
    // Check if query requires tool usage
    const requiresTools = [
      'transaction', 'balance', 'friend', 'address', 'history', 'list'
    ].some(keyword => query.toLowerCase().includes(keyword));
  
    if (requiresTools) {
      logger.info('Query requires tool usage');
    }
  
    // Get conversation history
    const history = conversationHistory.get(chatId) || [];
    logger.info('Conversation history:', history);
  
    // Prepare messages for the AI
    const messages = [
      {
        role: 'system',
        content: `${systemPrompt}\n\nIMPORTANT: For queries about transactions, balances, friends, or addresses, you MUST use the available tools to get real data. Do not make up or hallucinate data.\n\nWhen using tools:\n1. Use function_call to call tools directly\n2. Do not print parameters as JSON\n3. Call tools one at a time and wait for their response\n4. Use the tool response to provide accurate information\n\nExample of correct tool usage:\n{\n  "function_call": {\n    "name": "getTransactionHistory",\n    "arguments": {\n      "address": "0x123...",\n      "limit": 10\n    }\n  }\n}`
      },
      ...history
    ];
    logger.info('Prepared messages for AI:', messages);
  
    // Get AI response
    logger.info('Sending request to OpenAI API...');
    const requestConfig = {
      model: "deepseek-chat",
      messages: messages.map(msg => ({ role: msg.role, content: msg.content })),
      functions: [
        {
          name: "getAccountInfo",
          description: "Get detailed account information including balance, transaction count, and status. REQUIRED for any account analysis queries. Call using function_call with address parameter.",
          parameters: {
            type: "object",
            properties: {
              address: { type: "string" }
            },
            required: ["address"]
          }
        },
        {
          name: "getTokenBalances",
          description: "Get token balances for an address. REQUIRED for any balance queries. Call using function_call with address parameter.",
          parameters: {
            type: "object",
            properties: {
              address: { type: "string" }
            },
            required: ["address"]
          }
        },
        {
          name: "getFriendInfo",
          description: "Get information about a friend from local storage. REQUIRED for any friend-related queries. Call using function_call with userId and name parameters.",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "number" },
              name: { type: "string" }
            },
            required: ["userId", "name"]
          }
        },
        {
          name: "getTransactionDetails",
          description: "Get detailed information about a transaction. REQUIRED for any transaction detail queries. Call using function_call with hash parameter.",
          parameters: {
            type: "object",
            properties: {
              hash: { type: "string" }
            },
            required: ["hash"]
          }
        }
      ],
      tool_choice: requiresTools ? "auto" : undefined
    };
    // logger.info('OpenAI request configuration:', requestConfig);
  
    try {
      const completion = await openai.chat.completions.create(requestConfig);
      logger.info('Raw OpenAI response:', completion);
  
      const response = completion.choices[0].message;
      logger.info('Processed response:', response);
  
      let toolCall = null;
      
      if (response.content && response.content.includes('function_call')) {
        try {
          logger.info('Raw response content:', response.content);
          
          // Helper function to balance braces
          function findMatchingCloseBrace(str, startIndex) {
            let count = 1;
            for (let i = startIndex + 1; i < str.length; i++) {
              if (str[i] === '{') count++;
              if (str[i] === '}') count--;
              if (count === 0) return i;
            }
            return -1;
          }

          // Find the start of the JSON object
          const startIndex = response.content.indexOf('{');
          if (startIndex !== -1) {
            const endIndex = findMatchingCloseBrace(response.content, startIndex);
            if (endIndex !== -1) {
              const jsonContent = response.content.substring(startIndex, endIndex + 1);
              logger.info('Extracted JSON content:', jsonContent);

              try {
                const parsed = JSON.parse(jsonContent);
                logger.info('Successfully parsed JSON:', parsed);

                if (parsed.function_call) {
                  const functionName = parsed.function_call.name;
                  const args = parsed.function_call.arguments;
                  
                  logger.info('Extracted function details:', {
                    name: functionName,
                    arguments: args
                  });
                  
                  // Create toolCall object based on function name
                  toolCall = {
                    id: `generated-${Date.now()}`,
                    name: functionName,
                    arguments: args
                  };
                  
                  logger.info('Created toolCall:', toolCall);
                }
              } catch (parseErr) {
                logger.error('Failed to parse JSON:', parseErr);
              }
            }
          }

          if (!toolCall) {
            logger.warn('No valid function call found in response content');
          }
        } catch (err) {
          logger.error('Error parsing function call from content:', err);
        }
      }
      // Fallback to existing function_call if direct parsing failed
      if (!toolCall && response.function_call) {
        toolCall = response.function_call;
      }
      // Fallback to tool_calls if both above methods failed
      if (!toolCall && response.tool_calls) {
        toolCall = response.tool_calls[0];
      }

      if (!toolCall) {
        throw new Error('Query requires tool usage but no tools were used. The AI must use function_call to call tools directly, not just print their parameters as JSON.');
      }

      // If no id is provided, generate one
      if (!toolCall.id) {
        logger.warn('Assistant function call did not include a tool_call id. Generating one.');
        toolCall.id = `generated-${Date.now()}`;
      }
  
      // Safely parse the arguments: only parse if they are a string.
      const parsedArgs = typeof toolCall.arguments === "string"
        ? JSON.parse(toolCall.arguments)
        : toolCall.arguments;
  
      logger.info('AI requested to use tool:', toolCall);
  
      // Execute the tool with the parsed arguments
      let toolResult;
      if (toolCall.name === 'getTransactionDetails') {
        // For getTransactionDetails, pass just the hash
        toolResult = await tools[toolCall.name](toolCall.arguments.hash);
      } else if (toolCall.name === 'getFriendInfo') {
        // For getFriendInfo, pass userId and name
        toolResult = await tools[toolCall.name](toolCall.arguments.userId, toolCall.arguments.name);
      } else {
        // For other functions that take a single argument like getAccountInfo and getTokenBalances
        toolResult = await tools[toolCall.name](toolCall.arguments.address);
      }
  
      if (!toolResult) {
        throw new Error(`Tool ${toolCall.name} returned no data`);
      }
      
      logger.info('Tool execution result:', toolResult);

    // // Build an assistant message that includes the tool_calls field.
    // // This ensures the subsequent tool message is considered a proper response.
    // const assistantMessage = {
    //     role: 'assistant',
    //     content: response.content,
    //     tool_calls: [toolCall]  // Include the tool call details here.
    // };
    
    // // Build the interpretation request ensuring that the tool message references the same tool_call id.
    // const interpretationRequest = {
    //     model: "deepseek-chat",
    //     messages: [
    //     ...messages,
    //     assistantMessage, // now includes tool_calls
    //     { 
    //         role: 'tool', 
    //         name: toolCall.name, 
    //         content: JSON.stringify(toolResult),
    //         tool_call_id: toolCall.id  // same id as in the assistantMessage's tool_calls
    //     }
    //     ]
    // };
    // logger.info('Interpretation request:', interpretationRequest);
    
    // const interpretation = await openai.chat.completions.create(interpretationRequest);

// Step 1: Ensure all messages have the correct 'type'
const formattedMessages = messages.map(msg => ({
  ...msg,
  type: msg.type || msg.role
}));

// Step 2: Build the assistant message that includes tool_calls
const assistantMessage = {
  role: 'assistant',
  type: 'assistant',
  content: null, // tool-calling assistants always have null content
  tool_calls: [
    {
      id: toolCall.id, // must match tool_call_id in toolMessage
      type: 'function',
      function: {
        name: toolCall.name,
        arguments: JSON.stringify(toolCall.arguments) // must be a JSON string!
      }
    }
  ]
};

// Step 3: Build the tool message with string content (this is where error came from)
const toolMessage = {
  role: 'tool',
  type: 'tool',
  tool_call_id: toolCall.id, // must match assistant tool_calls[].id
  name: toolCall.name,
  content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult) // convert to string if needed
};

// Step 4: Compose the full interpretation request
const interpretationRequest = {
  model: "deepseek-chat",
  messages: [
    ...formattedMessages,
    assistantMessage,
    toolMessage
  ]
};
      
      // logger.info('Interpretation request:', interpretationRequest);
      
      const interpretation = await openai.chat.completions.create(interpretationRequest); 
      if (!interpretation.choices[0]?.message?.content) {
        throw new Error('Invalid interpretation response from OpenAI API');
      }
  
      const finalResponse = interpretation.choices[0].message.content;
      logger.info('Final response:', finalResponse);
  
      return finalResponse;
    } catch (error) {
      logger.error('Error in AI query processing:', error);
      throw error;
    }
  }
  


// bot.on('message', async (msg) => {
//     if (msg.text.startsWith('/')) return; // Skip command messages
    
//     const chatId = msg.chat.id;
//     logger.info(`Natural language query from ${msg.from.username || msg.from.id}: ${msg.text}`);
    
//     try {
//         const completion = await openai.chat.completions.create({
//             model: "deepseek-chat",
//             messages: [
//                 { role: "system", content: "You are a helpful assistant for Celo blockchain operations." },
//                 { role: "user", content: msg.text }
//             ]
//         });
        
//         await bot.sendMessage(chatId, completion.choices[0].message.content);
//         logger.info(`Response sent to user: ${msg.from.username || msg.from.id}`);
//     } catch (error) {
//         logger.error('Error processing message:', error);
//         await bot.sendMessage(chatId, `Error processing message: ${error.message}`);
//     }
// });

logger.info('Bot is running...'); 