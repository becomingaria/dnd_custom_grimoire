#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GrimoireStack } from '../lib/grimoire-stack';

const app = new cdk.App();

new GrimoireStack(app, 'GrimoireStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
  description: 'DnD Custom Grimoire — Spell & Character Management',
  tags: {
    Project: 'grimoire',
    Environment: 'production',
  },
});

app.synth();
