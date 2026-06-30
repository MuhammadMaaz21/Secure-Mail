const path = require('path');
const fs = require('fs');
const { loadLedger } = require('../src/utils/blockchain');

// View blockchain ledger
const viewLedger = () => {
  try {
    const ledger = loadLedger();
    
    console.log('\n' + '='.repeat(80));
    console.log('BLOCKCHAIN LEDGER VIEWER');
    console.log('='.repeat(80));
    
    console.log(`\n📊 Total Blocks: ${ledger.length}`);
    console.log(`📁 Ledger File: ${path.join(__dirname, '../data/email_ledger.json')}`);
    
    if (ledger.length === 0) {
      console.log('\n⚠️  Ledger is empty');
      return;
    }
    
    // Show genesis block
    if (ledger[0]) {
      console.log('\n' + '-'.repeat(80));
      console.log('GENESIS BLOCK (Index 0)');
      console.log('-'.repeat(80));
      console.log(JSON.stringify(ledger[0], null, 2));
    }
    
    // Show last 5 blocks
    const lastBlocks = ledger.slice(-5);
    console.log('\n' + '-'.repeat(80));
    console.log(`LAST ${lastBlocks.length} BLOCKS:`);
    console.log('-'.repeat(80));
    
    lastBlocks.forEach((block, idx) => {
      const actualIdx = ledger.length - lastBlocks.length + idx;
      console.log(`\n📦 Block ${block.index} (Position ${actualIdx + 1} of ${ledger.length}):`);
      console.log(`   Timestamp: ${block.timestamp}`);
      console.log(`   Previous Hash: ${block.previousHash.substring(0, 16)}...`);
      console.log(`   Block Hash: ${block.hash.substring(0, 16)}...`);
      
      if (block.data && block.data.emailId) {
        console.log(`   Email ID: ${block.data.emailId}`);
        console.log(`   Subject: ${block.data.subject || 'N/A'}`);
        console.log(`   Sender ID: ${block.data.senderId || 'N/A'}`);
        console.log(`   Recipients: ${(block.data.recipientIds || []).length} recipient(s)`);
        console.log(`   Content Hash: ${block.data.contentHash ? block.data.contentHash.substring(0, 16) + '...' : 'N/A'}`);
        console.log(`   Body Hash: ${block.data.bodyHash ? block.data.bodyHash.substring(0, 16) + '...' : 'N/A'}`);
      } else {
        console.log(`   Data: ${JSON.stringify(block.data)}`);
      }
    });
    
    // Chain integrity check
    console.log('\n' + '-'.repeat(80));
    console.log('CHAIN INTEGRITY CHECK:');
    console.log('-'.repeat(80));
    
    let chainValid = true;
    for (let i = 1; i < ledger.length; i++) {
      const currentBlock = ledger[i];
      const previousBlock = ledger[i - 1];
      
      if (currentBlock.previousHash !== previousBlock.hash) {
        console.log(`❌ Chain broken at block ${i}!`);
        console.log(`   Expected previousHash: ${previousBlock.hash.substring(0, 16)}...`);
        console.log(`   Got previousHash: ${currentBlock.previousHash.substring(0, 16)}...`);
        chainValid = false;
        break;
      }
    }
    
    if (chainValid) {
      console.log('✅ Chain integrity: VALID');
      console.log(`   All ${ledger.length} blocks are properly linked`);
    }
    
    // Statistics
    const emailBlocks = ledger.filter(b => b.data && b.data.emailId);
    console.log('\n' + '-'.repeat(80));
    console.log('STATISTICS:');
    console.log('-'.repeat(80));
    console.log(`   Total Blocks: ${ledger.length}`);
    console.log(`   Email Blocks: ${emailBlocks.length}`);
    console.log(`   Genesis Block: 1`);
    
    // Show full ledger option
    console.log('\n' + '-'.repeat(80));
    console.log('OPTIONS:');
    console.log('-'.repeat(80));
    console.log('To view full ledger:');
    console.log('  cat backend/data/email_ledger.json | jq');
    console.log('\nTo view specific block:');
    console.log('  node -e "const {loadLedger} = require(\'./backend/src/utils/blockchain\'); const l = loadLedger(); console.log(JSON.stringify(l[BLOCK_INDEX], null, 2));"');
    
  } catch (error) {
    console.error('Error viewing ledger:', error);
    process.exit(1);
  }
};

viewLedger();

