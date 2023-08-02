// safebatch multisig Safe transaction batching for ERC20 tokens
// Created on 20 July 2023 by Richard W. DeVaul
// Licensed under the terms of the MIT license

const ethers = require('ethers');
//import fetch from 'node-fetch';
//const fetch = require('node-fetch').default;
const https = require('https');
const csv = require('csv-parser');
const fs = require('fs');
const multi = require('@0x0proxy/multi');

// Load environment variables
require('dotenv').config({path: '.env.local'})

// Config
const network = process.env.NETWORK.toLowerCase();
const alchemyUrl = process.env[`${network.toUpperCase()}_API_URL`];
const safeAddress = process.env[`SAFE_ADDRESS_${network.toUpperCase()}`];

const signer = {
    address: process.env.SIGNER_ADDRESS, 
    privateKey: process.env.SIGNER_PRIVATE_KEY 
};

const provider = new ethers.JsonRpcProvider(alchemyUrl);
// This is the full ERC20 ABI, which is overkill.
const ERC20_ABI = multi.readjson('src/erc20abi.json');

// subset of the Gnosis Safe ABI used in this code
const SAFE_ABI = multi.readjson('src/safeABI.json');
      
async function getGasPrices() {

    const url = 'https://gasstation-mainnet.matic.network';
  
    const request = https.get(url, response => {
	let data = '';
	
	response.on('data', chunk => {
	    data += chunk; 
	});
	
	response.on('end', () => {
	    const prices = JSON.parse(data);
	    console.log(prices);
	    return prices;
	});
	
    });

    request.end();
    
}

// async function getGasPrices() {

//   const response = await fetch('https://gasstation-mainnet.matic.network');
//   const data = await response.json();

//   return {
//     fast: data.fast, // Gwei
//     standard: data.standard,
//     slow: data.slow
//   }

// }


async function loadTransfersCSV() {

  const transfers = [];

  return new Promise((resolve, reject) => {
      fs.createReadStream('transfers.csv')
	  .on('error', (err) => {
	      multi.redlog(`got error ${err} trying to read CSV file`);
	      process.exit(1);
	  })
	  .pipe(csv())
	  .on('data', (row) => {
	      console.log(row);
              transfers.push({
		  token: row.TOKEN.trim(),
		  to: row.TO.trim(),
		  // Convert ETH amount to wei 
		  amount: ethers.parseEther(row.AMOUNT.trim()) 
              });
	  })
	  .on('end', () => {
              resolve(transfers);
	  });
  });
}

async function generateTransferTx(transfer, signer,nonce) {
    const [tokenAddress, to, amountWei] = [transfer.token,transfer.to,transfer.amount];

    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

    const data = tokenContract.interface.encodeFunctionData('transfer', [
	to, 
	amountWei
    ]);

    multi.bluelog(`genTX: ${JSON.stringify(data)}`);

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
	nonce: nonce
    };
    
    // Set "from" as current signer
    tx.from = signer.address;
    
    return tx;
}

async function signTransaction(tx, privateKey) {

    // Create wallet instance from private key
    const wallet = new ethers.Wallet(privateKey, provider);

    // Sign transaction
    const signedTx = await wallet.signTransaction(tx);
    multi.amberlog(`signedTx: ${signedTx}`);
    // Extract signature
    //const signature = ethers.splitSignature(signedTx.rawSignature);
    //const signature = signedTx.signature;
    const signature = signedTx;
    
    return signature;
}

async function submitSignatures(hotSafe, proposedTxs, signatures,gasPrice) {

    const safe = new ethers.Contract(safeAddress, SAFE_ABI, provider);
    // hotSafe is a signer-enabled instance of the SAFE contract
    
    // Submit each signature
    for(let i=0; i<proposedTxs.length; i++) {

	const tx = proposedTxs[i];
	const sig = signatures[i];
	

	// Estimate gas
	//multi.amberlog('calling gasEstimate method');
	//const gasEstimate = await hotSafe.requiredTxGas(
	//    tx.to, 
	//    tx.value,
	//    tx.data,
	//    tx.operation);

	const gasEstimate = 40000
	multi.amberlog(`gas estimate: ${gasEstimate}`);
	// Submit signature
	const txResponse = await hotSafe.execTransaction(
	    tx.to,
	    tx.value,
	    tx.data,  
	    tx.operation,
	    gasEstimate,
	    gasEstimate,
	    0,
	    '0x0000000000000000000000000000000000000000',
	    signer.address,
	    sig,
	    {gasLimit: gasEstimate} 
	);
	
	console.log(`Submitted sig for tx${i}: ${txResponse.hash}`);
    }
}

async function main() {
    multi.greenlog("***************************************************************");
    multi.greenlog("  safebatch.js — process a series of GNOSIS Safe transactions");
    multi.greenlog("**************************************************************");

    if (network == undefined) {
	console.log(multi.amber('no network set') +
		    ': please set evironment variable NETWORK before running');
	process.exit(1);
    }
    // Signer info

    if (signer.address == undefined || signer.privateKey == undefined) {
	console.log(multi.amber('bad signer information') +
		    ': please set evironment variables SIGNER_ADDRESS and SIGNER_PRIVATE_KEY before running');
	process.exit(1);
    }

    multi.bluelog(`network: ${network}`);
    multi.bluelog(`signer address: ${signer.address}`);
    multi.bluelog(`safe address: ${safeAddress}`);
    
    //const safe = new ethers.Contract(safeAddress, SAFE_ABI, provider);
    const sgnr = new ethers.Wallet(signer.privateKey, provider);
    const safe = new ethers.Contract(safeAddress, SAFE_ABI, sgnr);

    // Get list of owners
    console.log('getting owners of SAFE');
    const owners = await safe.getOwners();
    for (let i=0; i < owners.length; i++) {
	console.log(`==> owner ${i}: ${multi.green(owners[i])}`);
    }
    // Load and parse CSV

    console.log('loading CSV');
    const transfers = await loadTransfersCSV(); 
    console.log(` ==> loaded ${transfers.length} token transfers`);
    for (let i=0; i < transfers.length; i++) {
	let t=transfers[i];
	console.log(`==> ==> ${multi.amber(i)}: ${t.token} ${t.to} ${t.amount}`);
    }
    // Generate proposed transactions
    console.log('generating proposed transactions');
    const proposedTxs = [];
    for(let transfer of transfers) {
	const nonce = await safe.nonce();
	const tx = await generateTransferTx(transfer, signer, nonce);
	multi.amberlog(`tx data: ${JSON.stringify(tx.data)}`);
	proposedTxs.push(tx); 
    }

    console.log('signing transactions');
    // Sign transactions 
    const signatures = [];
    for(let tx of proposedTxs) {
	// Sign with current signer
	const signature = await signTransaction(tx, signer.privateKey);
	multi.amberlog(`signature: ${JSON.stringify(signature)}`);
	signatures.push(signature);
    }

    console.log('looking up gas price');
    
    const prices = 0.075;
    
    console.log('got prices: ' + prices);

    const gasPrice =  prices.fast * 1000000000 // convert Gwei to Wei

    console.log('sending signed transactions to SAFE');
    // Send signatures to relayer/Safe
    // const sgnr = new ethers.Wallet(signer.privateKey, provider);
    const hotSafe = new ethers.Contract(safeAddress, SAFE_ABI, sgnr);

    await submitSignatures(hotSafe,proposedTxs, signatures,gasPrice);

    multi.greenlog('done');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

