# Winthrop House Tutor Assignment System

A web application for managing student assignments to Resident Tutors (RTs) and Non-Resident Tutors (NRTs) at Winthrop House.

## Features

- **Secure Authentication**: Email-based login with verification codes
- **Google Sheets Integration**: Real-time sync with Google Sheets for data storage
- **Student Management**: Add, update, and delete students with undo capability
- **Tutor Management**: Manage RTs and NRTs with status tracking
- **Assignment System**: Drag-and-drop interface for assigning students to tutors
- **Workflow Mode**: Guided 7-step workflow for batch operations
- **Email Notifications**: Send assignment emails to students with RT/NRT CC'd

## Setup

### Prerequisites

- Conda (Miniconda or Anaconda)
- Python 3.8+ (installed via conda)
- Node.js 16+
- Google Cloud Project with Sheets API enabled
- Service account credentials JSON file

### Backend Setup

1. Create and activate conda environment:
```bash
cd backend
conda env create -f environment.yml
conda activate tutor-assignment
```

Or manually:
```bash
conda create -n tutor-assignment python=3.10 -y
conda activate tutor-assignment
pip install -r requirements.txt
```

**Note:** See `SETUP_INSTRUCTIONS.md` for detailed setup steps.

2. Create `.env` file:
```env
SECRET_KEY=your-secret-key-here
GOOGLE_SHEETS_ID=your-google-sheet-id
GOOGLE_CREDENTIALS_PATH=path/to/service-account-credentials.json
ADMIN_EMAILS=admin1@example.com,admin2@example.com
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=winthroppremed@gmail.com
EMAIL_PASSWORD=your-app-password
```

2. Create `.env` file (see SETUP_INSTRUCTIONS.md for details)

3. Run the Flask server (make sure conda environment is activated):
```bash
conda activate tutor-assignment
python app.py
```

### Frontend Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Start the development server:
```bash
npm start
```

The app will be available at `http://localhost:3000`

## Project Structure

```
tutor-assignment-app/
├── backend/
│   ├── app.py                 # Flask application with all API endpoints
│   ├── config.py              # Configuration settings
│   ├── google_sheets.py       # Google Sheets integration
│   ├── auth.py                # Authentication logic with email verification
│   ├── models.py              # Data models (Student, NRT, RT)
│   ├── email_service.py       # Email functionality for notifications
│   ├── requirements.txt       # Python dependencies
│   └── .env.example           # Example environment configuration
├── frontend/
│   ├── src/
│   │   ├── App.js             # Main app component with routing
│   │   ├── components/        # React components
│   │   │   ├── Login.js       # Login page
│   │   │   ├── Dashboard.js   # Main dashboard
│   │   │   ├── StudentsView.js
│   │   │   ├── NRTsView.js
│   │   │   ├── RTsView.js
│   │   │   ├── Workflow.js    # Workflow orchestrator
│   │   │   └── WorkflowSteps/ # Individual workflow steps
│   │   ├── contexts/          # React contexts (AuthContext)
│   │   └── services/          # API service layer
│   └── package.json
├── README.md
└── SETUP_INSTRUCTIONS.md      # Detailed setup guide
```

## Usage

1. Log in with an authorized admin email
2. Choose between individual operations or workflow mode
3. Manage students, RTs, and NRTs
4. Assign students to tutors using drag-and-drop
5. Send notification emails when assignments are complete

