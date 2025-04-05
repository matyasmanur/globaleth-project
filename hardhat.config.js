require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// const { PRIVATE_KEY } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    celo: {
      url: "https://forno.celo.org", // Celo mainnet RPC
      accounts: [process.env.WALLET_PRIVATE_KEY], // Private key as string (no 0x prefix needed, but it's fine if you include it)
      chainId: 42220
    }
  }
};
