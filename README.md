# WebMonitor 🚀

[![Live Demo](https://img.shields.io/badge/Live-Demo-blue)](https://webmonitor-owjq.onrender.com/)  
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)  
[![Python](https://img.shields.io/badge/Backend-Python-blue)](https://www.python.org/)  
[![React](https://img.shields.io/badge/Frontend-React-blueviolet)](https://reactjs.org/)  

**WebMonitor** is a lightweight website monitoring tool that periodically checks the availability and response time of websites. It provides insights and visualizations through an interactive frontend. Ideal for developers, site admins, or anyone who wants to track website performance.  

**Live Demo:** [https://webmonitor-owjq.onrender.com/](https://webmonitor-owjq.onrender.com/)

---

## Features ✨

- Monitor multiple websites simultaneously  
- Add multiple websites easily  
- Track uptime and response time  
- Interactive charts for website metrics  
- Configurable monitoring interval  
- Lightweight, easy to set up  
- Sound / desktop notifications for downtime or status changes  
- Error handling for unreachable websites
  

---

## Tech Stack 🛠️

- **Frontend:** React.js, Tailwind CSS  
- **Backend:** Python (Flask)  
- **Data Storage:** JSON file (`websites.json`)  
- **Charts & Visualization:** Chart.js / Recharts  

---

## Architecture 🏗️

+----------------+        +----------------+        +----------------+
|                |        |                |        |                |
|   React UI     | <----> |   Flask API    | <----> | websites.json  |
|  (Frontend)    |        |  (Backend)     |        |  (Data Storage)|
|                |        |                |        |                |
+----------------+        +----------------+        +----------------+


- **Frontend** handles user interactions and visualizations.  
- **Backend** handles periodic website checks, uptime tracking, and serves API endpoints.  
- **JSON storage** keeps website configuration and monitoring intervals.  

---

## Getting Started ⚡

### 1. Clone the Repository

```bash
git clone https://github.com/the-amansharma/webMonitor.git
cd webMonitor
```

### 2. Backend Setup
```
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Backend runs on http://127.0.0.1:5000.

### 3. Frontend Setup
```
cd frontend
npm install
npm start
```

Frontend runs on http://localhost:3000 and connects to the backend.

### 4. Configuration

All monitored websites are stored in websites.json:
```
[
  {
    "id": 1,
    "name": "Example Site",
    "url": "https://example.com",
    "interval": 60
  }
]
```

interval = monitoring frequency in seconds.

## Production Deployment 🚀

Live URL: https://webmonitor-owjq.onrender.com/

Ensure websites.json exists in backend root.

Use Gunicorn for production Flask deployment:
```
gunicorn app:app --bind 0.0.0.0:5000
```

Build React frontend:
```
npm run build
```

## Future Improvements 🌟

- Persistent database storage (PostgreSQL / MongoDB)

- User authentication and dashboards

- Alerts via email/SMS for downtime

- Historical trends and analytics
