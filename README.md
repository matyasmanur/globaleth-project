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

## Development Notes

This project uses:
- [@celo/contractkit](https://www.npmjs.com/package/@celo/contractkit) for Celo blockchain interaction
- [node-telegram-bot-api](https://www.npmjs.com/package/node-telegram-bot-api) for Telegram bot functionality
- [OpenAI API](https://openai.com/api/) for natural language processing
- [Winston](https://www.npmjs.com/package/winston) for logging

## Security Notes

- Never share your private keys
- Keep your `.env` file secure and never commit it to version control
- Use testnet for development and testing
- Monitor logs for suspicious activity
- Friend addresses are stored locally and are not encrypted

## Contributing

Feel free to submit issues and enhancement requests!