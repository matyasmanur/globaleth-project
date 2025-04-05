const { createPublicClient, http } = require('viem');
const { celoAlfajores } = require('viem/chains');
const { getContract } = require('viem');
const { registryABI } = require('@celo/abis');
const { goldTokenABI } = require('@celo/abis/GoldToken');
const { stableTokenABI } = require('@celo/abis/StableToken');
const friendsManager = require('./friendsManager');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { default: axios } = require('axios');

// Load AI configuration
logger.info('=== Loading AI Configuration ===');
const configPath = path.join(__dirname, '../config/aiConfig.json');
logger.info(`Configuration file path: ${configPath}`);

if (!fs.existsSync(configPath)) {
    logger.error('Configuration file not found!');
    throw new Error('AI configuration file not found');
}

const configContent = fs.readFileSync(configPath, 'utf8');
logger.info('Raw configuration content:', configContent);

const aiConfig = JSON.parse(configContent);
logger.info('Parsed configuration:', aiConfig);

// Initialize viem client with configured RPC URL
logger.info('=== Initializing Viem Client ===');
logger.info(`Using RPC URL: ${aiConfig.environment.rpcUrl}`);

const publicClient = createPublicClient({
    chain: celoAlfajores,
    transport: http(aiConfig.environment.rpcUrl)
});

logger.info('Viem client initialized with config:', {
    chain: celoAlfajores,
    transport: { url: aiConfig.environment.rpcUrl }
});

// Initialize registry contract
logger.info('=== Initializing Registry Contract ===');
const REGISTRY_CONTRACT_ADDRESS = '0x000000000000000000000000000000000000ce10';
logger.info(`Registry contract address: ${REGISTRY_CONTRACT_ADDRESS}`);

const registryContract = getContract({
    address: REGISTRY_CONTRACT_ADDRESS,
    abi: registryABI,
    client: publicClient,
});

const BASE_URL = 'https://celo-alfajores.blockscout.com/api';


// logger.info('Registry contract initialized with config:', {
//     address: REGISTRY_CONTRACT_ADDRESS,
//     abi: registryABI,
//     client: { chain: celoAlfajores, transport: { url: aiConfig.environment.rpcUrl } }
// });

// Conversation history storage
const conversationHistory = new Map();

// Local data storage with TTL cache
const localData = {
    botAddress: null,
    cache: {
        transactions: new Map(),  // Map<hash, {timestamp: number, data: object}>
        addresses: new Map(),     // Map<address, {timestamp: number, data: object}>
        friends: new Map()        // Map<userId_name, {timestamp: number, data: object}>
    }
};

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

// Save local data to file
function saveLocalData() {
    logger.info('Saving local data...');
    const dataPath = path.join(__dirname, '../data/localData.json');
    const dataDir = path.dirname(dataPath);
    
    if (!fs.existsSync(dataDir)) {
        logger.info('Creating data directory...');
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Clean expired cache entries before saving
    const now = Date.now();
    for (const [key, cache] of Object.entries(localData.cache)) {
        for (const [id, entry] of cache.entries()) {
            if (now - entry.timestamp > CACHE_TTL) {
                cache.delete(id);
            }
        }
    }
    
    const dataToSave = {
        botAddress: localData.botAddress,
        cache: {
            transactions: Array.from(localData.cache.transactions.entries()),
            addresses: Array.from(localData.cache.addresses.entries()),
            friends: Array.from(localData.cache.friends.entries())
        }
    };
    
    fs.writeFileSync(dataPath, JSON.stringify(dataToSave, null, 2));
    logger.info('Local data saved successfully');
}

// Load local data from file
function loadLocalData() {
    logger.info('Loading local data...');
    const dataPath = path.join(__dirname, '../data/localData.json');
    if (fs.existsSync(dataPath)) {
        const savedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        localData.botAddress = savedData.botAddress;
        
        // Load cache with TTL check
        const now = Date.now();
        if (savedData.cache) {
            localData.cache.transactions = new Map(
                savedData.cache.transactions?.filter(([_, entry]) => now - entry.timestamp <= CACHE_TTL) || []
            );
            localData.cache.addresses = new Map(
                savedData.cache.addresses?.filter(([_, entry]) => now - entry.timestamp <= CACHE_TTL) || []
            );
            localData.cache.friends = new Map(
                savedData.cache.friends?.filter(([_, entry]) => now - entry.timestamp <= CACHE_TTL) || []
            );
        }
        logger.info('Local data loaded successfully');
    } else {
        logger.info('No local data file found, starting with empty data');
    }
}

// Helper function to get/set cache with TTL
function getCacheEntry(cacheType, key) {
    const cache = localData.cache[cacheType];
    const entry = cache.get(key);
    if (!entry) return null;
    
    // Check if entry is expired
    if (Date.now() - entry.timestamp > CACHE_TTL) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}

function setCacheEntry(cacheType, key, data) {
    localData.cache[cacheType].set(key, {
        timestamp: Date.now(),
        data
    });
    saveLocalData();
}

// Helper: Convert from Wei to CELO
const fromWei = (value) => parseFloat(value) / 1e18;

// Get CELO balance
async function getBalance(address) {
  const url = `${BASE_URL}?module=account&action=balance&address=${address}`;
  const response = await axios.get(url);
  return fromWei(response.data.result);
}

// Get normal transactions
async function getTransactions(address) {
  const url = `${BASE_URL}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc`;
  const response = await axios.get(url);
  return response.data.result || [];
}

// Get token holdings
async function getTokenHoldings(address) {
  const url = `${BASE_URL}?module=account&action=tokenlist&address=${address}`;
  const response = await axios.get(url);
  return response.data.result || [];
}

// Get internal transactions
async function getInternalTxs(address) {
  const url = `${BASE_URL}?module=account&action=txlistinternal&address=${address}`;
  const response = await axios.get(url);
  return response.data.result || [];
}

// Check if the address is a contract
async function checkIfContract(address) {
  const url = `${BASE_URL}?module=contract&action=getsourcecode&address=${address}`;
  const response = await axios.get(url);
  const result = response.data.result?.[0];
  return result?.ABI !== 'Contract source code not verified';
}

// Get NFT transfers
async function getNFTTransfers(address) {
  const url = `${BASE_URL}?module=account&action=tokennfttx&address=${address}`;
  const response = await axios.get(url);
  return response.data.result || [];
}

// Initialize local data
loadLocalData();

// AI Tools
const tools = {
    async getAccountInfo(address) {
        logger.info('[AI Tool] getAccountInfo - Starting');
        logger.info('[AI Tool] Parameters:', { address });

        const [balance, transactions, tokens, internalTxs, isContract, nftTransfers] = await Promise.all([
            getBalance(address),
            getTransactions(address),
            getTokenHoldings(address),
            getInternalTxs(address),
            checkIfContract(address),
            getNFTTransfers(address)
          ]);
        
        logger.info('[AI Tool] Got all data from axios');
        
        const totalTxs = transactions.length;
        const outgoing = transactions.filter(tx => tx.from.toLowerCase() === address.toLowerCase()).length;
        const incoming = totalTxs - outgoing;
        const gasUsed = transactions.reduce((sum, tx) => sum + (parseInt(tx.gasUsed) * parseInt(tx.gasPrice)), 0);
        const gasInCELO = fromWei(gasUsed.toString());
        const firstActivity = transactions.length ? new Date(transactions[transactions.length - 1].timeStamp * 1000).toLocaleDateString() : null;
        const lastActivity = transactions.length ? new Date(transactions[0].timeStamp * 1000).toLocaleDateString() : null;

        // Format the last 15 transactions
        const latestTransactions = transactions.slice(0, 15).map(tx => ({
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: fromWei(tx.value),
            timestamp: new Date(Number(tx.timeStamp) * 1000).toISOString(),
            gasUsed: tx.gasUsed,
            gasPrice: tx.gasPrice,
            status: tx.isError === '0' ? 'success' : 'failed'
        }));

        // Format token holdings
        const tokenHoldings = tokens.map(token => ({
            name: token.name,
            symbol: token.symbol,
            balance: fromWei(token.balance),
            contractAddress: token.contractAddress
        }));

        // Format NFT holdings
        const nftHoldings = nftTransfers.reduce((holdings, transfer) => {
            const key = `${transfer.tokenName}_${transfer.tokenID}`;
            if (!holdings.has(key)) {
                holdings.set(key, {
                    name: transfer.tokenName,
                    tokenId: transfer.tokenID,
                    contractAddress: transfer.contractAddress
                });
            }
            return holdings;
        }, new Map());

        const accountInfo = {
            address,
            balance: {
                celo: balance,
                wei: (balance * 1e18).toString(),
                usdEstimate: `~$${(balance * 0.45).toFixed(2)}` // Rough CELO price estimate
            },
            transactions: {
                total: totalTxs,
                outgoing,
                incoming,
                gasUsed: gasInCELO,
                latest: latestTransactions
            },
            tokens: tokenHoldings,
            nfts: Array.from(nftHoldings.values()),
            internalTransactions: {
                total: internalTxs.length,
                latest: internalTxs.slice(0, 5).map(tx => ({
                    from: tx.from,
                    to: tx.to,
                    value: fromWei(tx.value),
                    timestamp: new Date(Number(tx.timeStamp) * 1000).toISOString()
                }))
            },
            accountType: isContract ? 'Contract' : 'Wallet',
            accountStatus: {
                isActive: totalTxs > 0,
                firstActivity,
                lastActivity
            }
        };

        logger.info('[AI Tool] Account info generated:', accountInfo);
        return accountInfo;
    },

    async getTokenBalances(address) {
        logger.info('[AI Tool] getTokenBalances - Starting');
        logger.info('[AI Tool] Parameters:', JSON.stringify({ address }, null, 2));
        
        logger.info('[AI Tool] Fetching token addresses from registry...');
        const tokenAddresses = await getTokenAddresses();
        logger.info('[AI Tool] Token addresses:', JSON.stringify(tokenAddresses, null, 2));
        
        logger.info('[AI Tool] Fetching CELO balance...');
        const celoRequest = {
            abi: goldTokenABI,
            address: tokenAddresses['GoldToken'],
            functionName: 'balanceOf',
            args: [address],
        };
        logger.info('[AI Tool] CELO balance request:', JSON.stringify(celoRequest, null, 2));
        const celoBalance = await publicClient.readContract(celoRequest);
        logger.info('[AI Tool] Raw CELO balance response:', JSON.stringify(celoBalance, null, 2));
        
        logger.info('[AI Tool] Fetching cUSD balance...');
        const cusdRequest = {
            abi: stableTokenABI,
            address: tokenAddresses['StableToken'],
            functionName: 'balanceOf',
            args: [address],
        };
        logger.info('[AI Tool] cUSD balance request:', JSON.stringify(cusdRequest, null, 2));
        const cusdBalance = await publicClient.readContract(cusdRequest);
        logger.info('[AI Tool] Raw cUSD balance response:', JSON.stringify(cusdBalance, null, 2));
        
        const balances = {
            celo: Number(celoBalance) / 1e18,
            cusd: Number(cusdBalance) / 1e18,
            raw: {
                celo: celoBalance.toString(),
                cusd: cusdBalance.toString()
            }
        };
        
        logger.info('[AI Tool] Formatted balances:', JSON.stringify(balances, null, 2));
        
        // Store analyzed address
        const addressInfo = {
            lastChecked: new Date().toISOString(),
            balances,
            rawBalances: {
                celo: celoBalance.toString(),
                cusd: cusdBalance.toString()
            }
        };
        localData.cache.addresses.set(address, addressInfo);
        logger.info('[AI Tool] Storing address info:', JSON.stringify({
            address,
            info: addressInfo
        }, null, 2));
        saveLocalData();
        
        return balances;
    },

    async getFriendInfo(userId, name) {
        logger.info('=== Starting getFriendInfo ===');
        logger.info('Parameters:', { userId, name });
        
        const address = friendsManager.getFriend(userId, name);
        logger.info('Raw friend data from storage:', { address });
        
        if (!address) {
            return null;
        }
        
        const balances = await this.getTokenBalances(address);
        logger.info('Raw token balances:', balances);
        
        const info = {
            address,
            balances,
            name,
            lastChecked: new Date().toISOString(),
            userId
        };
        
        localData.cache.friends.set(`${userId}_${name}`, info);
        saveLocalData();
        
        return info;
    },

    async getTransactionDetails(hash) {
        logger.info('[AI Tool] getTransactionDetails - Starting');
        logger.info('[AI Tool] Parameters:', hash);
        
        logger.info('[AI Tool] Fetching transaction...');
        const txRequest = { hash };
        logger.info('[AI Tool] Transaction request:', txRequest);
        const tx = await publicClient.getTransaction(txRequest);
        
        // Process transaction for logging - convert BigInts to strings
        const loggableTx = {
            ...tx,
            blockNumber: tx.blockNumber?.toString(),
            gas: tx.gas?.toString(),
            gasPrice: tx.gasPrice?.toString(),
            maxFeePerGas: tx.maxFeePerGas?.toString(),
            maxPriorityFeePerGas: tx.maxPriorityFeePerGas?.toString(),
            v: tx.v?.toString(),
            value: tx.value?.toString()
        };
        // logger.info('[AI Tool] Raw transaction:', loggableTx);
        
        logger.info('[AI Tool] Fetching transaction receipt...');
        const receiptRequest = { hash };
        const receipt = await publicClient.getTransactionReceipt(receiptRequest);
        
        // Process receipt for logging - convert BigInts to strings
        const loggableReceipt = receipt ? {
            ...receipt,
            blockNumber: receipt.blockNumber?.toString(),
            gasUsed: receipt.gasUsed?.toString(),
            cumulativeGasUsed: receipt.cumulativeGasUsed?.toString(),
            effectiveGasPrice: receipt.effectiveGasPrice?.toString()
        } : null;
        // logger.info('[AI Tool] Transaction receipt:', loggableReceipt);
        
        // Return processed data for response
        const details = {
            transaction: loggableTx,
            receipt: loggableReceipt
        };
        
        // Store transaction details
        if (tx.from) {
            const addressTxs = localData.cache.transactions.get(tx.from) || [];
            const loggableDetails = {
                from: tx.from,
                transactionCount: addressTxs.length + 1,
                latestTransaction: {
                    hash: tx.hash,
                    to: tx.to,
                    value: tx.value?.toString()
                }
            };
            addressTxs.push(details);
            localData.cache.transactions.set(tx.from, addressTxs);
            logger.info('[AI Tool] Storing transaction details:', loggableDetails);
            saveLocalData();
        }
        
        return details;
    }
};

async function getTokenAddresses() {
    logger.info('[AI Tool] getTokenAddresses - Starting');
    const tokens = ['GoldToken', 'StableToken'];
    logger.info('[AI Tool] Fetching addresses for tokens:', JSON.stringify(tokens, null, 2));
    
    const addresses = await Promise.all(
        tokens.map(async (token) => {
            logger.info(`[AI Tool] Fetching address for ${token}...`);
            const request = {
                address: REGISTRY_CONTRACT_ADDRESS,
                abi: registryABI,
                functionName: 'getAddressForString',
                args: [token]
            };
            logger.info(`[AI Tool] Request for ${token}:`, JSON.stringify(request, null, 2));
            const address = await publicClient.readContract(request);
            logger.info(`[AI Tool] ${token} address response:`, JSON.stringify(address, null, 2));
            return [token, address];
        })
    );
    
    const result = Object.fromEntries(addresses);
    logger.info('[AI Tool] All token addresses:', JSON.stringify(result, null, 2));
    return result;
}

// Enhanced system prompt with configuration
const systemPrompt = `${aiConfig.role.description}

Network: ${aiConfig.environment.network}
Explorer: ${aiConfig.environment.explorerUrl}

Capabilities:
${aiConfig.role.capabilities.map(cap => `- ${cap}`).join('\n')}

Limitations:
${aiConfig.role.limitations.map(lim => `- ${lim}`).join('\n')}

Available Tools:
${Object.entries(aiConfig.tools).map(([name, tool]) => 
    `- ${name}: ${tool.description}\n  Method: ${tool.method}\n  Parameters: ${tool.parameters.join(', ')}`
).join('\n')}

When analyzing data, consider:
1. Transaction patterns and frequency
2. Balance changes and trends
3. Interaction with smart contracts
4. Gas usage patterns
5. Time-based analysis
6. Relationship between addresses

Always provide clear, concise explanations and highlight any interesting patterns or anomalies you notice.`;

module.exports = {
    tools,
    conversationHistory,
    systemPrompt,
    localData,
    aiConfig,
    saveLocalData,
    loadLocalData
}; 