# MVCC Snapshot Handler (Multi-Version Concurrency Control)

## 📌 Project Overview

The MVCC Snapshot Handler is a backend system that simulates
Multi-Version Concurrency Control (MVCC). It ensures consistent snapshot
reads while allowing concurrent writes.

## 🚀 Tech Stack

-   Node.js
-   Express.js
-   MongoDB
-   Git
-   Unix Shell Scripts

## 🧠 Core Concept

-   Each write creates a new version
-   Reads always use a consistent snapshot
-   Old versions remain unchanged

## 📂 Project Structure

mvcc-snapshot-handler ├── config/ ├── controllers/ ├── routes/ ├──
models/ ├── mvcc/ ├── scripts/ ├── server.js ├── package.json

## 🔁 API Endpoints

GET /api/records\
POST /api/records

## 🎯 Conclusion

This project demonstrates how MVCC ensures consistency using versioned
data.
