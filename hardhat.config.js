import { fileURLToPath } from 'node:url';
import hardhatEthers from '@nomicfoundation/hardhat-ethers';
import hardhatEthersChaiMatchers from '@nomicfoundation/hardhat-ethers-chai-matchers';
import hardhatMocha from '@nomicfoundation/hardhat-mocha';
import hardhatNetworkHelpers from '@nomicfoundation/hardhat-network-helpers';
import { configVariable, defineConfig } from 'hardhat/config';

const localSolc = fileURLToPath(new URL('./node_modules/solc/soljson.js', import.meta.url));

const compiler = {
  version: '0.8.28',
  path: localSolc,
  settings: {
    evmVersion: 'cancun',
    optimizer: {
      enabled: true,
      runs: 500,
    },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode', 'metadata'],
      },
    },
  },
};

export default defineConfig({
  plugins: [
    hardhatEthers,
    hardhatEthersChaiMatchers,
    hardhatMocha,
    hardhatNetworkHelpers,
  ],
  paths: {
    sources: './contracts',
    tests: {
      mocha: './test/contracts',
    },
    cache: './cache',
    artifacts: './artifacts',
  },
  solidity: {
    profiles: {
      default: compiler,
      production: {
        ...compiler,
        settings: {
          ...compiler.settings,
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 1_000,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: 'edr-simulated',
      chainType: 'l1',
    },
    hardhatOp: {
      type: 'edr-simulated',
      chainType: 'op',
    },
    sepolia: {
      type: 'http',
      chainType: 'l1',
      url: configVariable('SEPOLIA_RPC_URL'),
      accounts: [configVariable('DEPLOYER_PRIVATE_KEY')],
    },
    baseSepolia: {
      type: 'http',
      chainType: 'op',
      url: configVariable('BASE_SEPOLIA_RPC_URL'),
      accounts: [configVariable('DEPLOYER_PRIVATE_KEY')],
    },
  },
  test: {
    mocha: {
      timeout: 40_000,
    },
  },
  coverage: {
    skipFiles: ['contracts/mocks/**'],
  },
});
