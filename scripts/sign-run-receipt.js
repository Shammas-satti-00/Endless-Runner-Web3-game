import { readFile } from 'node:fs/promises';
import { Wallet, getAddress, isAddress } from 'ethers';
import { buildRunReceiptTypedData } from '../src/web3/rushContracts.js';

const [inputPath] = process.argv.slice(2);
if (!inputPath) {
  throw new Error(
    'Usage: npm run contracts:sign-receipt -- contracts/examples/run-receipt.example.json',
  );
}

const privateKey = process.env.RUSH_REWARD_SIGNER_PRIVATE_KEY?.trim();
if (!privateKey) {
  throw new Error(
    'RUSH_REWARD_SIGNER_PRIVATE_KEY is required. Keep this script on the protected reward service.',
  );
}

const input = JSON.parse(await readFile(inputPath, 'utf8'));
if (!isAddress(input.vaultAddress)) {
  throw new Error('vaultAddress must be a valid deployed RunRewardVault address.');
}
if (!input.chainId || !input.receipt) {
  throw new Error('The receipt file must include chainId and receipt fields.');
}

const wallet = new Wallet(privateKey);
if (
  input.expectedSigner &&
  getAddress(input.expectedSigner) !== getAddress(wallet.address)
) {
  throw new Error(
    `Loaded signer ${wallet.address} does not match expectedSigner ${input.expectedSigner}.`,
  );
}

const typedData = buildRunReceiptTypedData(
  input.chainId,
  getAddress(input.vaultAddress),
  input.receipt,
);
const signature = await wallet.signTypedData(
  typedData.domain,
  typedData.types,
  typedData.message,
);

console.log(
  JSON.stringify(
    {
      signer: wallet.address,
      domain: typedData.domain,
      receipt: typedData.message,
      signature,
    },
    null,
    2,
  ),
);
