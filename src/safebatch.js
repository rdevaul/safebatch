// safebatch multisig Safe transaction batching for ERC20 tokens
// Created on 20 July 2023 by Richard W. DeVaul
// Licensed under the terms of the MIT license

const ethers = require('ethers');
const csv = require('csv-parser');
const fs = require('fs');
const multi = require('@0x0proxy/multi');

// Load environment variables
require('dotenv').config({path: '.env.local'})

// Config
const alchemyApiKey = process.env.ALCHEMY_API_KEY;
const safeAddress = process.env.SAFE_ADDRESS;

const alchemyUrl = `https://eth-mainnet.alchemyapi.io/v2/${alchemyApiKey}`;
const provider = new ethers.providers.JsonRpcProvider(alchemyUrl);

// This is the full ERC20 ABI, which is overkill.
const ERC20_ABI = [
  {
    "constant": true,
    "inputs": [],
    "name": "name",
    "outputs": [
      {
        "name": "",
        "type": "string"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "_spender",
        "type": "address"
      },
      {
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "approve",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "totalSupply",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "_from",
        "type": "address"
      },
      {
        "name": "_to",
        "type": "address"
      },
      {
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "transferFrom",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [
      {
        "name": "",
        "type": "uint8"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "_owner",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "name": "balance",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [
      {
        "name": "",
        "type": "string"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "_to",
        "type": "address"
      },
      {
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "transfer",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "_owner",
        "type": "address"
      },
      {
        "name": "_spender",
        "type": "address"
      }
    ],
    "name": "allowance",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "payable": true,
    "stateMutability": "payable",
    "type": "fallback"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "owner",
        "type": "address"
      },
      {
        "indexed": true,
        "name": "spender",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "value",
        "type": "uint256"
      }
    ],
    "name": "Approval",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "from",
        "type": "address"
      },
      {
        "indexed": true,
        "name": "to",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "value",
        "type": "uint256"
      }
    ],
    "name": "Transfer",
    "type": "event"
  }
]

// subset of the Gnosis Safe ABI used in this code
const SAFE_ABI = [
  {
    "constant": true, 
    "inputs": [], 
    "name": "getOwners",
    "outputs": [
      {
        "name": "",
        "type": "address[]"
      }
    ],
    "payable": false, 
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "nonce", 
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,  
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "to",
        "type": "address"
      },
      {
        "name": "value",
        "type": "uint256"
      },
      {
        "name": "data",
        "type": "bytes"
      },
      {
        "name": "operation",
        "type": "uint256"
      },
      {
        "name": "safeTxGas",
        "type": "uint256"
      },
      {
        "name": "baseGas",
        "type": "uint256"
      },
      {
        "name": "gasPrice",
        "type": "uint256"
      },
      {
        "name": "gasToken",
        "type": "address"
      },
      {
        "name": "refundReceiver",
        "type": "address"
      },
      {
        "name": "signatures",
        "type": "bytes"
      }  
    ],
    "name": "execTransaction",
    "outputs": [
      {
        "name": "success",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  }
]

async function loadTransfersCSV() {

  const transfers = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream('transfers.csv')
      .pipe(csv())
      .on('data', (data) => {
        transfers.push({
          token: data.token,
          to: data.to,
          // Convert ETH amount to wei 
          amount: ethers.utils.parseEther(data.amount) 
        });
      })
      .on('end', () => {
        resolve(transfers);
      });
  });
}

async function generateTransferTx(transfer, signer) {
  const [tokenAddress, to, amountWei] = transfer;

  const tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, provider);

  const data = tokenContract.interface.encodeFunctionData('transfer', [
    to, 
    ethers.utils.parseEther(amountWei) 
  ]);

  const tx = {
    to: tokenAddress,
    value: 0,
    data: data,
    operation: 0,
    safeTxGas: 0,
    baseGas: 0,
    gasPrice: 0,
    gasToken: '0x0000000000000000000000000000000000000000',
    refundReceiver: '0x0000000000000000000000000000000000000000',
    nonce: await safe.nonce() 
  };
  
  // Set "from" as current signer
  tx.from = signer.address;

  return tx;
}

async function signTransaction(tx, privateKey) {

  // Create wallet instance from private key
  const wallet = new ethers.Wallet(privateKey);

  // Sign transaction
  const signedTx = await wallet.signTransaction(tx);

  // Extract signature
  const signature = ethers.utils.splitSignature(signedTx.rawSignature);

  return signature;
}

async function submitSignatures(proposedTxs, signatures) {

  // Create Safe contract instance
  const safe = new ethers.Contract(safeAddress, safeABI, provider);

  // Submit each signature
  for(let i=0; i<proposedTxs.length; i++) {

    const tx = proposedTxs[i];
    const sigs = signatures[i];

    // Estimate gas 
    const gasEstimate = await safe.estimateGas.execTransaction(
      tx.to, 
      tx.value,
      tx.data,
      tx.operation,
      tx.safeTxGas,
      tx.baseGas,
      tx.gasPrice,
      tx.gasToken,
      tx.refundReceiver,
      sigs
    );

    // Submit signature
    const txResponse = await safe.execTransaction(
      tx.to,
      tx.value,
      tx.data,  
      tx.operation,
      tx.safeTxGas,
      tx.baseGas,
      tx.gasPrice,
      tx.gasToken,
      tx.refundReceiver,
      sigs,
      {gasLimit: gasEstimate} 
    );

    console.log(`Submitted sig for tx${i}: ${txResponse.hash}`);
  }
}

async function main() {
    const safe = new ethers.Contract(safeAddress, safeABI, provider);

    // Get list of owners
    const owners = await safe.getOwners();

    // Load and parse CSV

    const transfers = await loadTransfersCSV(); 

    // Generate proposed transactions
    const proposedTxs = [];
    for(let transfer of transfers) {
	const tx = await generateTransferTx(transfer, signer);
	proposedTxs.push(tx); 
    }

    // Signer info
    const signer = {
	address: process.env.SIGNER_ADDRESS, 
	privateKey: process.env.SIGNER_PRIVATE_KEY 
    };


    // Sign transactions 
    const signatures = [];
    for(let tx of proposedTxs) {
	// Sign with current signer
	const signature = await signTransaction(tx, signer.privateKey);
	signatures.push(signature);
    }


    // Send signatures to relayer/Safe
    await submitSignatures(proposedTxs, signatures);

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

