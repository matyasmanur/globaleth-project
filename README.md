# Celo Telegram Bot

A Telegram bot that enables users to interact with the Celo blockchain directly from their mobile devices. The bot facilitates actions such as checking account balances, viewing transaction histories, and executing transactions.

## Features

- Check Celo balance (both CELO and cUSD)
- View transaction information
- Natural language processing for commands using Deepseek
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

4. Run the bot:
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

## Development Notes

This project uses:
- [@celo/contractkit](https://www.npmjs.com/package/@celo/contractkit) for Celo blockchain interaction
- [node-telegram-bot-api](https://www.npmjs.com/package/node-telegram-bot-api) for Telegram bot functionality
- [OpenAI API](https://openai.com/api/) for natural language processing

## Security Notes

- Never share your private keys
- Keep your `.env` file secure and never commit it to version control
- Use testnet for development and testing

## Contributing

Feel free to submit issues and enhancement requests!