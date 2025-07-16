#!/bin/bash

# TikTok Keyword Search - Batch Runner
# This script runs multiple keyword files through the TikTok search pipeline

set -e

echo "🚀 TikTok Keyword Search - Batch Runner"
echo "======================================"

# Default settings
LIMIT=10
WAIT=120
PORT=3002

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --limit)
      LIMIT="$2"
      shift 2
      ;;
    --wait)
      WAIT="$2"
      shift 2
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --limit <number>    Max profiles per keyword (default: 10)"
      echo "  --wait <seconds>    Wait time between batches (default: 120)"
      echo "  --port <number>     Server port (default: 3002)"
      echo "  --help, -h          Show this help message"
      echo ""
      echo "This script will automatically run all *-keywords.txt files in the current directory"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Check if Node.js script exists
if [ ! -f "scripts/tiktok-keyword-search.js" ]; then
    echo "❌ Error: scripts/tiktok-keyword-search.js not found"
    echo "Make sure you're running this from the app directory"
    exit 1
fi

# Find all keyword files
KEYWORD_FILES=$(find . -name "*-keywords.txt" -o -name "*keywords.txt" | sort)

if [ -z "$KEYWORD_FILES" ]; then
    echo "❌ No keyword files found"
    echo "Expected files like: tech-recruiting-keywords.txt, ai-ml-keywords.txt, etc."
    exit 1
fi

echo "📁 Found keyword files:"
echo "$KEYWORD_FILES" | sed 's/^/  /'
echo ""

# Run each keyword file
TOTAL_FILES=$(echo "$KEYWORD_FILES" | wc -l)
CURRENT=0

for file in $KEYWORD_FILES; do
    CURRENT=$((CURRENT + 1))
    echo "🔄 Processing file $CURRENT/$TOTAL_FILES: $file"
    echo "⚙️  Settings: limit=$LIMIT, wait=$WAIT, port=$PORT"
    echo ""
    
    # Run the keyword search
    if node scripts/tiktok-keyword-search.js "$file" --limit "$LIMIT" --wait "$WAIT" --port "$PORT"; then
        echo "✅ Completed: $file"
    else
        echo "❌ Failed: $file"
        # Continue with next file instead of exiting
    fi
    
    echo ""
    echo "=================================="
    echo ""
    
    # Wait between batches (except for the last one)
    if [ $CURRENT -lt $TOTAL_FILES ]; then
        echo "⏳ Waiting 30 seconds before next batch..."
        sleep 30
    fi
done

echo "🎉 Batch processing completed!"
echo "📊 Processed $TOTAL_FILES keyword files"
echo ""
echo "💡 To view results, check the TikTok profiles database:"
echo "   curl -s http://localhost:$PORT/api/pipeline/tiktok-30d | jq '.profiles | length'"