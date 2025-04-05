# Celo Telegram Bot

A Telegram bot that enables users to interact with the Celo blockchain directly from their mobile devices. The bot facilitates actions such as checking account balances, viewing transaction histories, and executing transactions.

## Features

- Check Celo balance (both CELO and cUSD)
- View transaction information
- Send CELO and cUSD to other addresses
- Friend list management for easy transfers
- Check current CELO and cUSD prices
- Natural language processing for commands using Deepseek
- Comprehensive logging system
- Deploy ERC20 tokens (coming soon)

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example` and fill in your credentials:
   - Get a Telegram bot token from [@BotFather](https://t.me/BotFather)
   - Get a Deepseek API key
   - Set up a Celo testnet wallet and get its private key
   - Use the default Celo testnet RPC URL or provide your own

4. Create required directories:
   ```bash
   mkdir logs data
   ```

5. Run the bot:
   ```bash
   npm start
   ```

   For development with auto-restart:
   ```bash
   npm run dev
   ```

## Available Commands

- `/start` - Start the bot and see available commands
- `/help` - Show help message
- `/balance` - Check your Celo balance (both CELO and cUSD)
- `/tx_info <hash>` - Get information about a specific transaction
- `/send <amount> <address|friend>` - Send CELO to an address or friend
- `/send_cusd <amount> <address|friend>` - Send cUSD to an address or friend
- `/price` - Get current CELO and cUSD prices
- `/addfriend <name> <address>` - Add a friend's address
- `/removefriend <name>` - Remove a friend
- `/listfriends` - List all your friends

## Friend Management

The bot includes a friend list feature to make sending tokens easier:
- Add friends with `/addfriend <name> <address>`
- Remove friends with `/removefriend <name>`
- List all friends with `/listfriends`
- Send tokens to friends by using their name instead of address

Example:
```
/addfriend alice 0x1234...
/send 1 alice  # Sends 1 CELO to alice's address
```

## Logging

The bot uses Winston for comprehensive logging:
- All logs are stored in the `logs` directory
- `error.log` contains only error messages
- `combined.log` contains all log messages
- Console output is colorized for better readability

## Smart Contracts

The project includes several smart contracts that demonstrate different token implementations and security patterns:

### LegitToken (ERC20)

A legitimate ERC20 token implementation with transparent and secure features:
- Standard ERC20 functionality with OpenZeppelin base
- Fixed maximum supply of 1 million tokens
- Initial supply of 100,000 tokens
- Transparent minting with clear limits
- Standard burn functionality
- Public view functions for token information

### SuspiciousToken (Educational Example)

A demonstration contract showing common malicious patterns in token contracts (for educational purposes only):
- Hidden admin privileges
- Disguised fee mechanisms
- Trading restrictions that can be manipulated
- Backdoor functions
- This contract serves as an educational tool to help users identify potential scam tokens

### Lock Contract

A simple time-lock contract that demonstrates basic Solidity patterns:
- Time-based locking mechanism
- Owner-only withdrawal
- Event emission
- Secure transfer handling

## Smart Contract Development

### Prerequisites
- Hardhat development environment
- OpenZeppelin contracts library
- Solidity ^0.8.20

### Deployment
```bash
npx hardhat compile
npx hardhat deploy
```

### Testing
```bash
npx hardhat test
```

### Contract Verification
The deployment script automatically verifies contracts on the Celo block explorer.

## LLM Integration

The bot features advanced natural language processing capabilities powered by Deepseek's LLM:

### LLM Commands

- `/llm <query>` - Start a new conversation with natural language query
- `/llmnext <query>` - Continue the existing conversation with follow-up query

### LLM Features

1. **Blockchain Analysis**
   - Transaction pattern recognition
   - Smart contract code analysis
   - Token behavior assessment
   - Address activity monitoring

2. **Natural Language Understanding**
   - Understands complex queries about blockchain state
   - Interprets user intentions for blockchain operations
   - Provides context-aware responses
   - Maintains conversation history for coherent interactions

3. **Smart Contract Analysis**
   - Contract type detection (ERC20, ERC721, Proxy, etc.)
   - Security pattern recognition
   - Code verification status checking
   - Activity metrics analysis
   - Token metrics tracking

4. **Transaction Analysis**
   - Detailed transaction breakdowns
   - Gas usage patterns
   - Internal transaction tracking
   - Token transfer analysis
   - Historical activity patterns

### LLM Tools

The bot integrates several blockchain analysis tools that the LLM can use:

1. **Account Analysis**
   - Balance tracking
   - Transaction history
   - Token holdings
   - Smart contract interactions

2. **Token Analysis**
   - Balance checking
   - Transfer history
   - Holder statistics
   - Supply information

3. **Contract Analysis**
   - Code verification
   - Interaction patterns
   - Security assessment
   - Activity metrics

4. **Transaction Analysis**
   - Status tracking
   - Gas usage
   - Method identification
   - Value transfer details

### Conversation Context

The LLM maintains conversation context to provide coherent responses across multiple queries. It understands:
- Previous queries and responses
- User's blockchain context
- Current network state
- Recent transactions and events

## Development Notes

### Project Structure
```
├── contracts/           # Smart contract source files
│   ├── LegitToken.sol
│   ├── SuspiciousToken.sol
│   └── Lock.sol
├── scripts/            # Deployment and utility scripts
├── test/              # Test files
├── src/               # Bot source code
│   ├── index.js       # Main bot logic
│   └── utils/         # Utility functions
│       ├── aiTools.js # LLM integration
│       └── logger.js  # Logging system
```

### Dependencies

The project uses several key dependencies:
- `@celo/contractkit`: Celo blockchain interaction
- `@openzeppelin/contracts`: Secure contract implementations
- `hardhat`: Smart contract development environment
- `node-telegram-bot-api`: Telegram bot functionality
- `openai`: LLM API integration (via Deepseek)
- `viem`: Ethereum/Celo client
- `winston`: Logging system

### Environment Variables

Required environment variables in `.env`:
```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
DEEPSEEK_API_KEY=your_deepseek_api_key
WALLET_PRIVATE_KEY=your_wallet_private_key
CELO_TESTNET_RPC=https://alfajores-forno.celo-testnet.org
```

