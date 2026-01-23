const NETWORKS = {
    1: {
        name: 'Ethereum Mainnet',
        hex: '0x1',
        rpcUrls: ['https://ethereum-rpc.publicnode.com'],
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        explorer: 'https://etherscan.io',
    },
    8453: {
        name: 'Base Mainnet',
        hex: '0x2105',
        rpcUrls: ['https://mainnet.base.org'],
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        explorer: 'https://basescan.org',
    },
    137: {
        name: 'Polygon Mainnet',
        hex: '0x89',
        rpcUrls: ['https://polygon-rpc.com'],
        nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
        explorer: 'https://polygonscan.com',
    },
};
const initialState = () => ({
    connected: false,
    connecting: false,
    address: null,
    chainId: null,
    chainName: 'Guest Mode',
    balance: '0.0000 ETH',
    connectionType: null,
    error: null,
});
export class WalletManager {
    provider = null;
    state = initialState();
    listeners = new Set();
    accountListener = (accounts) => {
        const list = Array.isArray(accounts) ? accounts.filter((item) => typeof item === 'string') : [];
        void this.handleAccounts(list);
    };
    chainListener = (chainId) => {
        void this.handleChain(chainId);
    };
    disconnectListener = () => {
        this.clearConnection();
    };
    subscribe(listener) {
        this.listeners.add(listener);
        listener({ ...this.state });
        return () => this.listeners.delete(listener);
    }
    getState() {
        return { ...this.state };
    }
    async restore() {
        if (!window.ethereum)
            return;
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length === 0)
                return;
            this.attachProvider(window.ethereum, 'injected');
            await this.syncState(accounts[0] ?? null);
        }
        catch (error) {
            console.warn('Wallet restore failed.', error);
        }
    }
    async connectInjected() {
        const provider = window.ethereum;
        if (!provider) {
            this.patch({ error: 'No browser wallet detected. Install MetaMask, Rabby, Coinbase Wallet, or another EIP-1193 wallet.' });
            throw new Error(this.state.error ?? 'No browser wallet detected.');
        }
        this.patch({ connecting: true, error: null });
        try {
            const accounts = await provider.request({ method: 'eth_requestAccounts' });
            this.attachProvider(provider, 'injected');
            await this.syncState(accounts[0] ?? null);
        }
        catch (error) {
            const message = this.errorMessage(error, 'Browser wallet connection was cancelled or failed.');
            this.patch({ connecting: false, error: message });
            throw new Error(message);
        }
    }
    async connectWalletConnect() {
        const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim();
        if (!projectId) {
            const message = 'WalletConnect needs VITE_WALLETCONNECT_PROJECT_ID in your .env file.';
            this.patch({ error: message });
            throw new Error(message);
        }
        this.patch({ connecting: true, error: null });
        try {
            const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
            const provider = await EthereumProvider.init({
                projectId,
                chains: [1],
                optionalChains: [8453, 137],
                showQrModal: true,
                metadata: {
                    name: 'Subway Rush',
                    description: 'Cinematic Web3 endless runner',
                    url: window.location.origin,
                    icons: [`${window.location.origin}/favicon.svg`],
                },
                methods: ['eth_sendTransaction', 'personal_sign', 'eth_signTypedData_v4', 'wallet_switchEthereumChain', 'wallet_addEthereumChain'],
                events: ['chainChanged', 'accountsChanged'],
            });
            await provider.connect();
            this.attachProvider(provider, 'walletconnect');
            const accountResponse = await provider.request({ method: 'eth_accounts' });
            const accounts = Array.isArray(accountResponse)
                ? accountResponse.filter((item) => typeof item === 'string')
                : [];
            await this.syncState(accounts[0] ?? null);
        }
        catch (error) {
            const message = this.errorMessage(error, 'WalletConnect connection was cancelled or failed.');
            this.patch({ connecting: false, error: message });
            throw new Error(message);
        }
    }
    async disconnect() {
        const provider = this.provider;
        this.detachProvider();
        try {
            await provider?.disconnect?.();
        }
        catch (error) {
            console.warn('Wallet disconnect returned an error.', error);
        }
        this.clearConnection();
    }
    async switchNetwork(chainId) {
        if (!this.provider)
            throw new Error('Connect a wallet first.');
        const network = NETWORKS[chainId];
        if (!network)
            throw new Error('Unsupported network.');
        try {
            await this.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: network.hex }] });
        }
        catch (error) {
            const code = this.errorCode(error);
            if (code !== 4902)
                throw new Error(this.errorMessage(error, `Could not switch to ${network.name}.`));
            await this.provider.request({
                method: 'wallet_addEthereumChain',
                params: [{
                        chainId: network.hex,
                        chainName: network.name,
                        rpcUrls: network.rpcUrls,
                        nativeCurrency: network.nativeCurrency,
                        blockExplorerUrls: [network.explorer],
                    }],
            });
        }
        await this.syncState(this.state.address);
    }
    async signRun(score, distance, coins) {
        if (!this.provider || !this.state.address)
            throw new Error('Connect a wallet before signing the run.');
        const message = [
            'Subway Rush Run Verification',
            `Score: ${Math.floor(score)}`,
            `Distance: ${Math.floor(distance)}m`,
            `Coins: ${coins}`,
            `Timestamp: ${new Date().toISOString()}`,
            `Origin: ${window.location.origin}`,
        ].join('\n');
        return this.provider.request({ method: 'personal_sign', params: [message, this.state.address] });
    }
    attachProvider(provider, connectionType) {
        this.detachProvider();
        this.provider = provider;
        this.provider.on?.('accountsChanged', this.accountListener);
        this.provider.on?.('chainChanged', this.chainListener);
        this.provider.on?.('disconnect', this.disconnectListener);
        this.patch({ connectionType });
    }
    detachProvider() {
        this.provider?.removeListener?.('accountsChanged', this.accountListener);
        this.provider?.removeListener?.('chainChanged', this.chainListener);
        this.provider?.removeListener?.('disconnect', this.disconnectListener);
        this.provider = null;
    }
    async handleAccounts(accounts) {
        if (accounts.length === 0) {
            this.clearConnection();
            return;
        }
        await this.syncState(accounts[0] ?? null);
    }
    async handleChain(chainId) {
        const parsed = this.parseChainId(chainId);
        this.patch({ chainId: parsed, chainName: this.networkName(parsed) });
        await this.refreshBalance();
    }
    async syncState(address) {
        if (!this.provider || !address) {
            this.clearConnection();
            return;
        }
        const chainRaw = await this.provider.request({ method: 'eth_chainId' });
        const chainId = this.parseChainId(chainRaw);
        this.patch({
            connected: true,
            connecting: false,
            address,
            chainId,
            chainName: this.networkName(chainId),
            error: null,
        });
        await this.refreshBalance();
    }
    async refreshBalance() {
        if (!this.provider || !this.state.address)
            return;
        try {
            const value = await this.provider.request({ method: 'eth_getBalance', params: [this.state.address, 'latest'] });
            const wei = BigInt(value);
            const integer = wei / 10n ** 18n;
            const fraction = (wei % 10n ** 18n).toString().padStart(18, '0').slice(0, 4);
            const symbol = NETWORKS[this.state.chainId ?? 1]?.nativeCurrency.symbol ?? 'ETH';
            this.patch({ balance: `${integer}.${fraction} ${symbol}` });
        }
        catch (error) {
            console.warn('Balance lookup failed.', error);
            this.patch({ balance: 'BALANCE UNAVAILABLE' });
        }
    }
    clearConnection() {
        this.detachProvider();
        this.state = initialState();
        this.emit();
    }
    patch(patch) {
        this.state = { ...this.state, ...patch };
        this.emit();
    }
    emit() {
        const snapshot = { ...this.state };
        this.listeners.forEach((listener) => listener(snapshot));
    }
    parseChainId(value) {
        if (typeof value === 'number' && Number.isFinite(value))
            return value;
        if (typeof value === 'string') {
            const parsed = value.startsWith('0x') ? Number.parseInt(value, 16) : Number.parseInt(value, 10);
            return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
    }
    networkName(chainId) {
        if (chainId === null)
            return 'Unknown Network';
        return NETWORKS[chainId]?.name ?? `Chain ${chainId}`;
    }
    errorCode(error) {
        if (typeof error !== 'object' || error === null || !('code' in error))
            return null;
        const code = error.code;
        return typeof code === 'number' ? code : null;
    }
    errorMessage(error, fallback) {
        if (error instanceof Error && error.message)
            return error.message;
        if (typeof error === 'object' && error !== null && 'message' in error) {
            const message = error.message;
            if (typeof message === 'string' && message.trim())
                return message;
        }
        return fallback;
    }
}
