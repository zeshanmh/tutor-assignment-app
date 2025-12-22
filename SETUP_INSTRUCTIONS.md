# Setup Instructions for Winthrop Tutor Assignment System

## Prerequisites

1. **Conda** installed (Miniconda or Anaconda)
2. **Python 3.8+** (will be installed via conda)
3. **Node.js 16+** installed
4. **Google Cloud Project** with Google Sheets API enabled
5. **Service Account** credentials JSON file

## Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Sheets API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"
4. Create a Service Account:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service Account"
   - Fill in the details and create the service account
   - Click on the service account, go to "Keys" tab
   - Click "Add Key" > "Create new key" > "JSON"
   - Download the JSON file and save it securely
5. Share your Google Sheet with the service account email:
   - Open your Google Sheet
   - Click "Share" button
   - Add the service account email (found in the JSON file as `client_email`)
   - Give it "Editor" permissions

## Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a conda environment (choose one method):

**Method 1: Using environment.yml (recommended):**
```bash
conda env create -f environment.yml
conda activate tutor-assignment
```

**Method 2: Manual creation:**
```bash
conda create -n tutor-assignment python=3.10 -y
conda activate tutor-assignment
pip install -r requirements.txt
```

**Note:** To deactivate the conda environment later, use `conda deactivate`. To reactivate it, use `conda activate tutor-assignment`.

4. Create `.env` file:
```bash
cp .env.example .env
```

5. Edit `.env` with your configuration:
```env
SECRET_KEY=your-very-secure-secret-key-here
GOOGLE_SHEETS_ID=your-google-sheet-id-from-url
GOOGLE_CREDENTIALS_PATH=./path/to/service-account-credentials.json
ADMIN_EMAILS=your-email@example.com
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=winthroppremed@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
JWT_SECRET_KEY=your-jwt-secret-key
```

**Important Notes:**
- `GOOGLE_SHEETS_ID`: Extract from your Google Sheet URL: `https://docs.google.com/spreadsheets/d/SHEET_ID/edit`
- `GOOGLE_CREDENTIALS_PATH`: Path to your downloaded service account JSON file
- `EMAIL_PASSWORD`: For Gmail, you need an [App Password](https://support.google.com/accounts/answer/185833)
- `ADMIN_EMAILS`: Comma-separated list of emails that can log in

6. Ensure your Google Sheet has three tabs named exactly:
   - "Students"
   - "Non-Resident Tutors"
   - "Resident Tutors"

7. Set up the column headers in your Google Sheet:

**Students tab:**
- First Name
- Last Name
- Primary Email
- Secondary Email
- Class Year
- NRT Assignment
- RT Assignment

**Non-Resident Tutors tab:**
- Name
- Email
- Status
- Total Students
- <= 2019
- 2020
- 2021
- 2022
- 2023
- 2024
- 2025
- 2026
- 2027
- 2028
- 2029

**Resident Tutors tab:**
- Name
- Email
- Student Count

8. Make sure your conda environment is activated:
```bash
conda activate tutor-assignment
```

9. Run the Flask server:
```bash
python app.py
```

The backend will run on `http://localhost:5000`

## Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (optional, defaults to localhost:5000):
```bash
cp .env.example .env
```

4. Start the development server:
```bash
npm start
```

The frontend will run on `http://localhost:3000`

## Usage

1. Open `http://localhost:3000` in your browser
2. Enter your admin email (must be in `ADMIN_EMAILS`)
3. Check your email for the verification code
4. Enter the code to log in
5. Use the dashboard to manage students, RTs, and NRTs
6. Use the "Start Workflow" button for guided batch operations

## Troubleshooting

### Google Sheets API Errors
- Ensure the service account email has been shared with your Google Sheet
- Verify the Google Sheets API is enabled in your Google Cloud project
- Check that the credentials JSON file path is correct

### Email Sending Issues
- For Gmail, ensure you're using an App Password, not your regular password
- Check that less secure app access is enabled or use App Passwords
- Verify SMTP settings are correct

### CORS Errors
- Ensure the backend is running on port 5000
- Check that Flask-CORS is installed and configured

### Authentication Issues
- Verify your email is in the `ADMIN_EMAILS` list in `.env`
- Check that the email verification code hasn't expired (10 minutes)

## Production Deployment

For production:
1. Use a proper WSGI server (e.g., Gunicorn)
2. Set secure `SECRET_KEY` and `JWT_SECRET_KEY`
3. Use environment variables or a secure secrets manager
4. Enable HTTPS
5. Configure proper CORS settings
6. Use a production database instead of in-memory storage for verification codes
7. Set up proper logging and error tracking

