#!/bin/bash
echo "Stopping server..."
pm2 stop liquid-front

echo "Pulling latest code..."
git pull --rebase origin main

echo "Installing dependencies..."
npm install

echo "Building app..."
npm run build

echo "Restarting server..."
pm2 start server.js --name liquid-front
pm2 save

echo "✅ Deployment complete!"

