@echo off
REM Ridesathi - Quick Start Guide for Windows
REM This batch script helps you quickly set up and start the application

echo.
echo ======================================
echo   RIDESATHI - QUICK START (Windows)
echo ======================================
echo.

REM Step 1: Check Node.js
echo 1. Checking Node.js...
node --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo X Node.js is not installed
    echo   Download from: https://nodejs.org/
    pause
    exit /b 1
)
echo OK Node.js is installed

echo.

REM Step 2: Install backend dependencies
echo 2. Installing backend dependencies...
cd backend
call npm install
if %ERRORLEVEL% neq 0 (
    echo X Error installing dependencies
    pause
    exit /b 1
)
echo OK Backend dependencies installed

echo.

REM Step 3: Start backend server
echo 3. Starting backend server...
echo   Backend will run on: http://localhost:5000
echo   Press Ctrl+C to stop
echo.

call npm start

pause
