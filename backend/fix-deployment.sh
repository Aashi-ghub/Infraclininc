#!/bin/bash

# Fix deployment issues - Clean rebuild

echo "🧹 Cleaning build cache..."
rm -rf .serverless
rm -rf node_modules/.cache

echo "📦 Verifying dependencies..."
npm install

echo "✅ Ready to deploy. Run: serverless deploy"
