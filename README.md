# MVCC Todo App

This project implements a Multi-Version Concurrency Control (MVCC) based Todo system.

## Features
- Create Todo
- Update with versioning (no overwrite)
- Delete using soft delete (MVCC)
- View history of all versions
- Snapshot read (time-based)

## Tech Stack
- Node.js
- Express
- MongoDB
- React

## How to Run

### Backend
cd server
npm install
npm run dev

### Frontend
cd client
npm install
npm run dev