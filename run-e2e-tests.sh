#!/bin/bash

# Integration test script for OpenMKView

echo "Starting OpenMKView E2E Tests..."

# Change to project directory
cd /home/god/github/openmkview

# Build and start the Rust backend in background
echo "Building and starting Rust backend..."
cargo build --release 2>&1 | tail -5
target/release/openmkview &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Change to frontend directory
cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing npm dependencies..."
  npm install
fi

# Run E2E tests
echo "Running E2E tests..."
npx playwright test

# Capture exit code
TEST_EXIT_CODE=$?

# Stop backend
echo "Stopping backend..."
kill $BACKEND_PID 2>/dev/null

# Report results
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo "✅ All E2E tests passed!"
else
  echo "❌ Some E2E tests failed"
fi

exit $TEST_EXIT_CODE
