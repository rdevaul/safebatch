# safebatch
Batch a series of ERC20 transfer transactions for processing by Gnosis Safe

## overview

The goal of this code is to provide a straightforward mechanism by
which a series of ERC token transfer transactions can be batched and
seperately approved by Gnosis Safe signers. The workflow is as follows:

 * Alice generates a set of proposed transactions in the form of a CSV
   file. The format is the following:
 
	 TOKEN_CONTRACT_ADDRESS, AMOUNT_IN_ETH, RECIPIENT_ADDRESS, "comment string"
	 
 * After careful review, Alice processes the CSV with the safebatch
   script, generating proposed transactions for other Safe signers to
   approve.
   
 * Bob, a Safe signer, has the option of manually reviewing and
   approving each transaction individually throug the Safe web
   interface or app, *or*
   
 * Bob, a Safe signer, reviews Alice's CSV file and, agreeing that all
   transactions are correct, proceses the CSV with the safebatch
   script, adding his signature to each proposed transaction.
   
   If two signatures are required to approve, then after Bob's
   signature all that is left is execution.
   
 * Carol, a Safe signer, has the same options as Bob if the necessary
   number number of signatures is not yet met. Or, if it has been met,
   then she (or Bob or Alice) will have the option of processing
   Alice's CSV with safebatch to execute all fully signed transactions.
   
## dependencies

This code requires node.js, ethers, and an Alchemy API key.

	npm install ethers
	npm install dotenv
	 
