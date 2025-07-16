#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

import { Command } from 'commander';
import { registerJobDescriptionCommands } from './commands/analysis/job-description';
import { registerRepositoryAnalysisCommands } from './commands/analysis/repository';
import { registerDatabaseCommands } from './commands/db/queries';
import { registerCandidateCommands } from './commands/candidates/operations';
import { registerLetterCommands } from './commands/communication/letter';
import { registerBatchEmailCommands } from './commands/communication';
import { registerEmailCommands } from './commands/email';
import { registerCreatorCommands } from './commands/creators';
import { registerDiscoveryCommands } from './commands/discovery';

const program = new Command();

program
  .name('tiktok-miner')
  .description('CLI tool for TikTok Miner platform')
  .version('0.1.0');

// Register command modules
registerJobDescriptionCommands(program);
registerRepositoryAnalysisCommands(program);
registerDatabaseCommands(program);
registerCandidateCommands(program);
registerLetterCommands(program);
registerBatchEmailCommands(program);
registerEmailCommands(program);
registerCreatorCommands(program);
registerDiscoveryCommands(program);

program.parse();
